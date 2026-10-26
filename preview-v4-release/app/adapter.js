/* ================================================================
   Lumo 4.0 Stage 3 — СЕРВИСНЫЙ АДАПТЕР к движку v3.5.3.
   ТЗ 05/06 §3.1: вторая реализация поиска/идентификации/обогащения
   ЗАПРЕЩЕНА. Этот файл НЕ содержит бизнес-логики: он только
   (а) обеспечивает изоляцию хранилища (override-ключ установлен
       до загрузки движка; рабочий ключ не читается/не пишется),
   (б) мостит UI-примитивы движка (toast/confirmBox) в видимый слой
       Stage 3 (движок смонтирован в скрытом техническом host'е),
   (в) даёт интерфейсу типизированные точки входа в ПРОВЕРЕННЫЕ
       функции движка (search/identity/enrich/CRM/backup).
   Все алгоритмы (оценка достоверности, resolver идентичности,
   анти-каскад контактов, STOP-правила, бэкап-валидация) — движка.
   ================================================================ */
(function () {
  'use strict';

  var PROD_KEY = window.LUMO_PROD_KEY || 'ai_client_scout_v1';
  var TEST_KEY = window.LUMO_STORAGE_KEY_OVERRIDE || 'lumo4_stage3_v1';

  /* ---- (б) мост UI-примитивов: движковые toast/confirmBox → видимый слой S3 ----
     Движок смонтирован в #engine-host[hidden]; его тосты/модалки невидимы.
     Перехватываем глобальные функции (function declarations переопределяемы),
     сохраняя семантику: confirmBox(title, text, onYes, yesLabel). */
  var engineToast = window.toast;
  var engineConfirm = window.confirmBox;
  window.toast = function (msg, kind, ms) {
    if (window.S3 && S3.toast) S3.toast(msg, kind);
    else if (engineToast) engineToast(msg, kind, ms);
  };
  window.confirmBox = function (title, text, onYes, yesLabel) {
    if (window.S3 && S3.confirm) S3.confirm(title, text, onYes, yesLabel);
    else if (engineConfirm) engineConfirm(title, text, onYes, yesLabel);
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var Lumo = {
    meta: {
      app: 'Lumo 4.0 Stage 3', engine: 'v3.5.3 (сервисный слой, единственная правка — LS_KEY override)',
      prodKey: PROD_KEY, testKey: TEST_KEY,
    },

    /* ВАЖНО: DB/APP — лексические глобалы движка (let/const), проверяем bare-идентификаторами */
    ready: function () { try { return typeof DB !== 'undefined' && Array.isArray(DB.leads) && typeof addLead === 'function'; } catch (e) { return false; } },
    engineLSKey: function () { try { return LS_KEY; } catch (e) { return null; } },

    /* ---------- хранилище / защита рабочей базы ---------- */
    storageInfo: function () {
      var raw = '';
      try { raw = localStorage.getItem(TEST_KEY) || ''; } catch (e) { }
      return { testKey: TEST_KEY, bytes: raw.length, prodKey: PROD_KEY, leads: DB.leads.length, tasks: (DB.tasks || []).length };
    },

    /* ---------- CRM-ядро ---------- */
    leads: function () { return DB.leads.slice(); },
    activeLeads: function () { return activeLeads(); },
    lead: function (id) { return leadById(id); },
    addCompany: function (data) { var l = addLead(data); save(); return l; },
    update: function (id, patch, ht, hd) { updateLead(id, patch, ht, hd); return leadById(id); },
    setArchived: function (id, v) { setArchived(id, !!v, true); },
    history: function (id) { var l = leadById(id); return l ? (l.history || []).slice() : []; },
    setStage: function (id, stage, note) { setStage(id, stage, note || ''); return leadById(id); },
    markOutcome: function (id, outcome, note) {
      /* исход — отдельное поле модели (WON/LOST/STOP); движковая история пишется updateLead */
      updateLead(id, { outcome: outcome }, 'Коммерческий исход: ' + outcome, note || '');
      return leadById(id);
    },
    setNextStep: function (id, nextStep, date) {
      updateLead(id, { nextStep: nextStep || '', nextStepDate: date || null }, 'Следующий шаг', nextStep || '');
      return leadById(id);
    },

    /* ---------- задачи ---------- */
    tasksOf: function (id) { return tasksOf(id); },
    openTasks: function () { return openTasks(); },
    allTasks: function () { return (DB.tasks || []).slice(); },
    addTask: function (id, t) { var r = addTask(id, t); save(); return r; },
    updateTask: function (id, patch) { var r = updateTask(id, patch); save(); return r; },
    taskKinds: function () { return TASK_KINDS; },
    taskStatuses: function () { return TASK_STATUS; },

    /* ---------- стадии: 19 реальных значений + визуальные группы (отображение, НЕ замена) ---------- */
    stages: function () { return PIPELINE_C.map(function (s) { return { id: s.id, ru: s.ru, short: s.short, group: s.group }; }); },
    stageRu: function (s) { return stageRu(s); },
    STAGE_GROUPS: [
      { id: 'new', label: 'Новые', stages: ['DISCOVERY', 'QUALIFICATION'] },
      { id: 'research', label: 'Исследование', stages: ['BUSINESS_ANALYSIS', 'DIGITAL_DISCOVERY', 'CONTENT_AUDIT', 'CONTENT_GAP', 'BUYING_SIGNALS'] },
      { id: 'decision', label: 'Решение', stages: ['LEAD_SCORE', 'WHY_NOW', 'PRIMARY_OFFER', 'OFFER_EVIDENCE', 'LPR_DISCOVERY', 'CONTACT_VERIFICATION'] },
      { id: 'gate', label: 'Барьеры', stages: ['LEGAL_ENTITY', 'RISK', 'SCOPE_PRICING', 'OUTREACH_READINESS'] },
      { id: 'contact', label: 'Контакт', stages: ['OUTREACH', 'FEEDBACK_LOOP'] },
      { id: 'won', label: 'Сделка', outcome: 'WON', stages: [] },
      { id: 'closed', label: 'Закрыто', outcomeIn: ['LOST', 'STOP'], stages: [] },
    ],
    groupOf: function (l) {
      if (!l) return null;
      if (l.outcome === 'WON') return 'won';
      if (l.outcome === 'LOST' || l.outcome === 'STOP') return 'closed';
      for (var i = 0; i < Lumo.STAGE_GROUPS.length; i++) {
        var g = Lumo.STAGE_GROUPS[i];
        if (g.stages.indexOf(l.stage) >= 0) return g.id;
      }
      return 'new';
    },
    groupLabel: function (gid) {
      for (var i = 0; i < Lumo.STAGE_GROUPS.length; i++) if (Lumo.STAGE_GROUPS[i].id === gid) return Lumo.STAGE_GROUPS[i].label;
      return gid;
    },

    /* ---------- поиск организаций: ТОЛЬКО функции движка ---------- */
    dadataReady: function () { return dadataReady(); },
    dadataUsed: function () { try { return dadataUsed(); } catch (e) { return null; } },
    setDadataToken: function (t) { dadataSetToken(t); },
    regions: function () { return REGIONS.map(function (r) { return { id: r.id, label: r.label, cities: r.cities.slice() }; }); },
    industries: function () { return Object.keys(INDUSTRIES).map(function (k) { return { id: k, label: INDUSTRIES[k].label }; }); },
    industryLabel: function (k) { try { return IND(k || 'services').label; } catch (e) { return k || '—'; } },
    cityPool: function (regions) { try { return ddCityPool(regions || []).map(function (k) { return { key: k, name: cityOf(k).name }; }); } catch (e) { return []; } },
    cityName: function (k) { try { return cityOf(k).name; } catch (e) { return k; } },
    searchPlanPreview: function (o) {
      var p = dadataSearchPlan(o || {});
      return { steps: p.length, meta: p.meta, queries: p.slice(0, 8).map(function (s) { return s.query; }) };
    },
    search: function (o) { return runDadataSearch(o || {}); },          /* async → {ok, items, ...} */
    parsePasted: function (text, region) { return dadataParsePasted(text, region); },

    /* ---------- идентичность: 3 состояния (ТЗ §4 «Дубликаты») ---------- */
    identityOf: function (cand) {
      var f = dadataFindInBase(clone(cand));
      return { verdict: f.verdict, reason: f.reason, leadId: f.lead ? f.lead.id : null, leadName: f.lead ? f.lead.name : null };
    },
    addFromCandidate: function (cand, opts) {
      /* resolver движка решает; «уже в базе» — только при match (правило v3.5.2/04B) */
      var f = dadataFindInBase(clone(cand));
      if (f.verdict === 'match') return { action: 'exists', leadId: f.lead.id, reason: f.reason };
      if (f.verdict === 'ambiguous' && !(opts && opts.force === 'different'))
        return { action: 'needs-decision', leadId: f.lead ? f.lead.id : null, reason: f.reason };
      var data = dadataCandidateLeadData(clone(cand));
      if (opts && opts.force === 'different') {
        data.facts = data.facts || { events: [], risks: [], social: [], hiringRoles: [], notes: '' };
        data.facts.notes = ((data.facts.notes || '') + ' Добавлено решением пользователя: организация отличается от похожей записи «' + (f.lead ? f.lead.name : '') + '».').trim();
      }
      var l = addLead(data);
      save();
      return { action: 'added', leadId: l.id, reason: f.reason };
    },
    candidateActualCity: function (c) { try { return actualCityName(c); } catch (e) { return ''; } },

    /* ---------- обогащение: preview движка + apply через его же guard'ы ---------- */
    enrich: function (id, mode) { return enrichLead(id, mode); },      /* async → E (preview) */
    enrichMetaOf: function (id) { var l = leadById(id); return l ? (l.enrichment && l.enrichment.meta) || {} : {}; },
    enrichLastOf: function (id) { var l = leadById(id); return l ? (l.enrichment && l.enrichment.last) || null : null; },
    enrichOpenApply: function (id) {
      /* движок рендерит чекбоксы apply в служебный #modal-root (скрытый host) —
         приём proven бенчмарком v3.5.0; Stage 3 показывает их своим списком */
      enrichPreviewModal(id);
      return Lumo.enrichOptions();
    },
    enrichOptions: function () {
      var boxes = Array.prototype.slice.call(document.querySelectorAll('#modal-root input[data-enr]'));
      return boxes.map(function (b) {
        var tr = b.closest('tr') || b.parentElement;
        return { key: b.getAttribute('data-enr'), checked: !!b.checked, label: tr ? tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : b.getAttribute('data-enr') };
      });
    },
    enrichApply: function (id, keys) {
      /* keys=null → оставить выбор движка по умолчанию; иначе — явный выбор пользователя.
         Запись выполняет enrichApplySel (все guard'ы движка: conf<55, manual_confirmed, LOW-список). */
      var boxes = Array.prototype.slice.call(document.querySelectorAll('#modal-root input[data-enr]'));
      if (keys) boxes.forEach(function (b) { b.checked = keys.indexOf(b.getAttribute('data-enr')) >= 0; });
      enrichApplySel(id);
      try { closeModal(); } catch (e) { }
      save();
      return leadById(id);
    },
    enrichCloseApply: function () { try { closeModal(); } catch (e) { } },

    /* ---------- здоровье поиска ---------- */
    searchHealth: function () { return SEARCH_PROVIDER.health(); },    /* async */
    helperUrl: function () { return enrichHelperUrl(); },
    setHelperUrl: function (u) { enrichCfg().helperUrl = String(u || '').trim(); enrichCfg().status = null; save(); },

    /* ---------- резервные копии: штатные функции движка ---------- */
    exportJson: function () { return exportBackupJson(); },
    /* движковый validateBackup БРОСАЕТ исключение при отказе и возвращает объект копии при успехе —
       нормализуем в {ok, counts, errors} для UI (семантика валидации — движка) */
    validateBackup: function (obj) {
      try {
        var b = validateBackup(obj);
        var d = (b && b.data) || {};
        return { ok: true, counts: { leads: (d.leads || []).length, tasks: (d.tasks || []).length }, errors: [], warnings: [] };
      } catch (e) { return { ok: false, counts: null, errors: [String(e && e.message || e)], warnings: [] }; }
    },
    importBackup: function (obj, confirmed) { return importBackup(obj, !!confirmed); },
    /* движковый parseLeadsFile принимает РАЗОБРАННЫЙ объект (массив/{leads}/бэкап);
       текст парсим здесь, ошибки валидации движка пробрасываем как Error */
    parseLeadsText: function (text) {
      var obj;
      try { obj = JSON.parse(String(text || '')); } catch (e) { throw new Error('Файл не является JSON: ' + e.message); }
      return parseLeadsFile(obj);
    },
    mergePreview: function (arr) { return previewLeadsMerge(arr); },
    mergeImport: function (arr, confirmed) { return mergeLeadsImport(arr, !!confirmed); },
    backupVersion: function () { return BACKUP_VERSION; },

    /* ---------- анализ/оценки (только чтение реальных данных движка) ---------- */
    analysisOf: function (id) { var l = leadById(id); return l ? (l.analysis || recalc(l)) : null; },
    actualCityName: function (o) { try { return actualCityName(o); } catch (e) { return ''; } },
    isClosed: function (l) { return isClosed(l); },
    offers: function () { return OFFERS; },

    /* ---------- безопасность рендера (функции движка) ---------- */
    esc: function (s) { return esc(s); },
    safeUrl: function (u) { return safeHttpUrl(u); },
    safeMailto: function (m) { try { return safeMailto(m); } catch (e) { return ''; } },

    /* ---------- служебное ---------- */
    resetTestDb: function () { resetAll('empty'); },
    save: function () { save(); },
    engineVersionString: function () {
      var m = document.querySelector('#engine-host');
      return 'v3.5.3';
    },
  };

  window.Lumo = Lumo;
})();
