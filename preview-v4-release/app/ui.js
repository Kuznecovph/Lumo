/* ================================================================
   Lumo 4.0 FINAL — единый интерфейс (визуальный эталон Stage 2,
   логика — сервисный адаптер window.Lumo поверх движка v3.5.3).
   Разделы: Главная · Поиск · Компании · Карточка · Задачи · Данные.
   Без iframe, без второго поиска, без второй базы: единственный
   источник истины — DB движка в тестовом ключе lumo4_stage3_v1.
   Правило безопасности: ЛЮБЫЕ внешние строки — только через
   Lumo.esc(); ссылки — через Lumo.safeUrl(); почта — Lumo.safeMailto().
   Никаких «декоративных» кнопок: каждое действие вызывает реальную
   функцию движка через адаптер.
   ================================================================ */
window.S3 = (function () {
  'use strict';

  /* ---------------- состояние ---------------- */
  var state = {
    view: 'search', cardId: null,
    results: null, resultsQuery: '', searchBusy: false,
    companyFilter: { q: '', group: '', archived: false },
    taskFilter: 'open',
    searchForm: { regions: ['udmurtia'], industry: 'manufacturing', query: '', cities: [], count: 20, okved: true, mode: 'api', pastedRegion: 'udmurtia' },
    lastEnrich: null, health: null,
  };

  var VIEWS = { home: 'Главная', search: 'Поиск', companies: 'Компании', card: 'Карточка', tasks: 'Задачи', data: 'Данные' };
  var NAV = [['home', 'Главная', 'home'], ['search', 'Поиск', 'search'], ['companies', 'Компании', 'companies'], ['tasks', 'Задачи', 'tasks'], ['data', 'Данные', 'settings']];

  /* ---------------- иконки (inline-SVG, Stage 2) ---------------- */
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-8h6v8"/>',
    companies: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 5 5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.3 3a8 8 0 0 0-1.7 1l-2.4-1-2 3.5L5 11a7 7 0 0 0 0 2l-1.9 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.3 3h5l.3-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    alert: '<path d="m12 3 10 18H2L12 3zM12 9v5M12 18h.01"/>',
    x: '<path d="M5 5l14 14M19 5 5 19"/>',
    download: '<path d="M12 3v13m-4-4 4 4 4-4M4 18v3h16v-3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
    cash: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 9h1m12 6h1"/>',
    trash: '<path d="M4 7h16M10 4h4M6 7l1 14h10l1-14M10 11v6m4-6v6"/>',
    spark: '<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
    shield: '<path d="M12 2 20 6v6c0 5.1-3 8.2-8 10-5-1.8-8-4.9-8-10V6z"/><path d="m9 12 2 2 4-4"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M14 7h2M9 11h2M14 11h2M10 21v-5h4v5"/>',
    tasks: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 11 2.2 2.2L16 8M8 17h8"/>',
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.circle) + '</svg>'; }

  /* ---------------- утилиты ---------------- */
  function esc(s) { return Lumo.esc(s == null ? '' : String(s)); }
  function el(id) { return document.getElementById(id); }
  function isoDate(offset) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + (offset || 0)); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); }
  function fmtDate(v, opt) { if (!v) return 'Нет даты'; var d = new Date(String(v).length <= 10 ? v + 'T12:00:00' : v); return isNaN(d) ? 'Нет даты' : new Intl.DateTimeFormat('ru-RU', opt || { day: 'numeric', month: 'long' }).format(d); }
  function shortDate(v) { return fmtDate(v, { day: 'numeric', month: 'short' }); }
  function todayStr() { return isoDate(0); }

  function header(title, sub, actionsHtml) {
    return '<div class="heading"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p class="sub">' + esc(sub) + '</p>' : '') + '</div>' +
      (actionsHtml ? '<div class="actions">' + actionsHtml + '</div>' : '') + '</div>';
  }
  function simpleEmpty(title, text, extra) {
    return '<div class="empty">' + icon('info') + '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (extra || '') + '</div>';
  }

  /* группы → визуальные классы бейджей Stage 2 (7 значимых цветов) */
  var GROUP_BADGE = { 'new': 'found', research: 'research', decision: 'ready', gate: 'offer', contact: 'contact', won: 'won', closed: 'closed' };
  function groupBadge(gid) { return '<span class="badge ' + (GROUP_BADGE[gid] || 'neutral') + '">' + esc(Lumo.groupLabel(gid)) + '</span>'; }
  function stageBadgeOf(l) { return groupBadge(Lumo.groupOf(l)); }

  function dueInfo(t) {
    if (t.status === 'DONE') return ['done', 'Выполнена'];
    if (t.status === 'CANCELED') return ['closed', 'Отменена'];
    if (!t.dueAt) return ['neutral', 'Без срока'];
    var d = String(t.dueAt).slice(0, 10), today = todayStr();
    if (d < today) return ['overdue', 'Просрочена'];
    if (d === today) return ['today', 'Сегодня'];
    return ['neutral', shortDate(d)];
  }

  /* ---------------- тосты/диалоги (видимый слой; используются адаптером) ---------------- */
  function toast(msg, kind) {
    var box = el('s3-toasts'); if (!box) return;
    var d = document.createElement('div');
    d.className = 'toast ' + (kind === 'ok' ? 'ok' : kind === 'warn' ? 'warn' : kind === 'err' || kind === 'error' ? 'err' : '');
    d.textContent = String(msg == null ? '' : msg);
    box.appendChild(d);
    setTimeout(function () { try { d.remove(); } catch (e) { } }, 4200);
  }
  function dialog(html, onMount) {
    var root = el('s3-modal-root');
    root.innerHTML = '<div class="overlay" data-act="dlg-close-bg"><section class="modal" role="dialog" aria-modal="true">' + html + '</section></div>';
    if (onMount) onMount(root);
  }
  function closeDialog() { var r = el('s3-modal-root'); if (r) r.innerHTML = ''; }
  /* семантика движкового confirmBox(title, text, onYes, yesLabel) */
  function confirm(title, text, onYes, yesLabel) {
    dialog('<div class="modal-head"><div><h3>' + esc(title) + '</h3></div>' +
      '<button class="icon-btn" data-act="dlg-close" aria-label="Закрыть окно">' + icon('x') + '</button></div>' +
      '<div class="small">' + text + '</div>' +
      '<div class="modal-footer"><button class="btn" data-act="dlg-close">Отмена</button>' +
      '<button class="btn primary" data-act="dlg-yes">' + esc(yesLabel || 'Да') + '</button></div>',
      function (root) {
        root.querySelector('[data-act="dlg-yes"]').addEventListener('click', function () {
          closeDialog(); if (typeof onYes === 'function') onYes();
        });
      });
  }

  /* ---------------- навигация (hash-роутинг Stage 2) ---------------- */
  function hashOf(view, cardId) { return '#/' + (view === 'card' ? 'company/' + encodeURIComponent(cardId || '') : view); }
  function go(view, params) {
    if (params && params.cardId !== undefined) state.cardId = params.cardId;
    if (params && params.results !== undefined) state.results = params.results;
    state.view = view;
    var h = hashOf(view, view === 'card' ? state.cardId : null);
    try { if (location.hash !== h) location.hash = h; } catch (e) { }
    render();
    try { window.scrollTo(0, 0); } catch (e) { }
  }
  function syncRoute() {
    var hash;
    try { hash = decodeURIComponent((location.hash || '').replace(/^#\//, '')); } catch (e) { hash = ''; }
    if (!hash) return false;
    var parts = hash.split('/');
    var view = parts[0];
    if (view === 'company') { state.view = 'card'; state.cardId = parts[1] || null; return true; }
    if (VIEWS[view]) { state.view = view; return true; }
    return false;
  }

  function renderNav() {
    function items(mobile) {
      return NAV.map(function (it) {
        var active = state.view === it[0] || (state.view === 'card' && it[0] === 'companies');
        return '<a href="' + hashOf(it[0]) + '" class="navbtn' + (active ? ' active' : '') + '" data-act="nav" data-view="' + it[0] + '"' +
          (active ? ' aria-current="page"' : '') + ' title="' + esc(it[1]) + '">' + icon(it[2]) + '<span>' + esc(it[1]) + '</span></a>';
      }).join('');
    }
    el('s3-nav').innerHTML = items(false);
    var mn = el('s3-mnav'); if (mn) mn.innerHTML = items(true);
  }
  function renderStatus() {
    var st = el('s3-status'); if (!st) return;
    var h = state.health;
    var hDot = h === null ? '<span class="dot n"></span>'
      : h.ok ? '<span class="dot g"></span>'
        : (h.helper ? '<span class="dot y"></span>' : '<span class="dot r"></span>');
    var hTitle = h === null ? 'поиск-сервис: проверка…'
      : h.ok ? 'поиск-сервис доступен (helper + SearXNG)'
        : (h.helper ? 'helper работает, SearXNG недоступен — SERP-поиск выключен' : 'локальный поиск-сервис недоступен — нужен helper/SearXNG на вашем Mac');
    var dd = Lumo.dadataReady();
    var si = Lumo.storageInfo();
    st.innerHTML =
      '<span class="badge outline" title="' + esc(hTitle) + '">' + hDot + 'поиск-сервис</span>' +
      '<span class="badge outline" title="DaData Suggestions: ' + (dd ? 'ключ указан' : 'ключ не указан — реальный ЕГРЮЛ-поиск недоступен, доступен режим «JSON вручную»') + '">' +
      (dd ? '<span class="dot g"></span>' : '<span class="dot n"></span>') + 'DaData</span>' +
      '<span class="demo-badge" title="Рабочая база v3.5.3 не читается и не пишется">' + si.leads + ' комп. · тест-ключ</span>' +
      '<span class="top-date">' + esc(fmtDate(todayStr(), { day: 'numeric', month: 'long', year: 'numeric' })) + '</span>';
  }
  function refreshHealth() {
    Lumo.searchHealth().then(function (h) { state.health = h; renderStatus(); }).catch(function () { state.health = { ok: false }; renderStatus(); });
  }

  /* ---------------- раздел «Главная» ---------------- */
  function renderHome() {
    var leads = Lumo.activeLeads();
    var all = Lumo.leads();
    var open = Lumo.openTasks();
    var today = todayStr();
    var overdue = open.filter(function (t) { return t.dueAt && String(t.dueAt).slice(0, 10) < today; });
    var won = all.filter(function (l) { return l.outcome === 'WON'; });
    var inWork = all.filter(function (l) { return !l.archived && Lumo.groupOf(l) !== 'closed'; });

    var recent = leads.slice().sort(function (a, b) { return String(b.createdAt || b.id).localeCompare(String(a.createdAt || a.id)); }).slice(0, 4);
    var recentHtml = recent.map(function (l) {
      return '<article class="card lead"><div><div class="lead-meta">' + stageBadgeOf(l) +
        '<span class="badge outline">' + esc(Lumo.industryLabel(l.industry)) + '</span></div>' +
        '<h3>' + esc(l.name) + '</h3>' +
        '<p>' + esc(Lumo.actualCityName(l) || 'НП не определён') + ' · ' + esc((l.geo && l.geo.regionName) || '') + '</p></div>' +
        '<div class="lead-right">' + (l.website ? '<span class="badge blue">сайт</span>' : '<span class="badge neutral">нет сайта</span>') +
        '<button class="link-text" data-act="open-card" data-id="' + esc(l.id) + '">Открыть →</button></div></article>';
    }).join('');

    var tasksHtml = open.slice().sort(function (a, b) { return String(a.dueAt || '9999').localeCompare(String(b.dueAt || '9999')); }).slice(0, 5).map(function (t) {
      var l = Lumo.lead(t.leadId);
      var di = dueInfo(t);
      return '<div class="task-line"><div class="task-main"><button data-act="task-done" data-t="' + esc(t.id) + '" title="Выполнено" aria-label="Выполнено">' + icon('circle') + '</button>' +
        '<div style="min-width:0"><strong>' + esc(t.title) + '</strong><span>' + esc(l ? l.name : 'без компании') + (t.dueAt ? ' · до ' + esc(shortDate(t.dueAt)) : '') + '</span></div></div>' +
        '<span class="badge ' + di[0] + '">' + esc(di[1]) + '</span></div>';
    }).join('');

    /* последняя активность — только реальная история движка */
    var acts = [];
    all.forEach(function (l) { (l.history || []).slice(-3).forEach(function (h) { acts.push({ at: h.at || '', title: h.title || h.type || '', detail: h.detail || '', name: l.name, id: l.id }); }); });
    acts.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    var actHtml = acts.slice(0, 5).map(function (a) {
      return '<div class="event-small"><div class="datebox"><b>' + esc(String(a.at).slice(8, 10) || '—') + '</b><small>' + esc(fmtDate(String(a.at).slice(0, 10) || null, { month: 'short' })) + '</small></div>' +
        '<div style="min-width:0"><div style="font-size:12px;font-weight:690">' + esc(a.title) + '</div>' +
        '<div class="tiny">' + esc(a.name) + '</div>' +
        '<button class="link-text mt8" data-act="open-card" data-id="' + esc(a.id) + '">Открыть →</button></div></div>';
    }).join('');

    return header('Главная', 'Что в работе, какие задачи открыты и что недавно произошло. Все данные — из единой базы движка v3.5.3.',
      '<button class="btn primary" data-act="nav" data-view="search">' + icon('plus') + ' Найти компанию</button>') +
      '<section class="stat-grid" aria-label="Ключевые показатели">' +
      '<article class="card stat-card"><div class="stat-label">Компании в работе ' + icon('companies') + '</div><div class="stat-number">' + inWork.length + '</div><div class="stat-foot">Из ' + all.length + ' в базе</div></article>' +
      '<article class="card stat-card"><div class="stat-label">Открытые задачи ' + icon('tasks') + '</div><div class="stat-number">' + open.length + '</div><div class="stat-foot"><a href="#/tasks" data-act="nav" data-view="tasks">Посмотреть задачи →</a></div></article>' +
      '<article class="card stat-card"><div class="stat-label">Просроченные ' + icon('clock') + '</div><div class="stat-number" style="color:var(--danger)">' + overdue.length + '</div><div class="stat-foot">Требуют переноса или закрытия</div></article>' +
      '<article class="card stat-card"><div class="stat-label">Сделки WON ' + icon('cash') + '</div><div class="stat-number">' + won.length + '</div><div class="stat-foot">Реальный коммерческий исход</div></article>' +
      '</section>' +
      '<div class="split"><section><div class="card-header"><h2>Недавно добавленные</h2><button class="link-text" data-act="nav" data-view="companies">Все компании →</button></div>' +
      '<div class="lead-list">' + (recentHtml || simpleEmpty('Пусто', 'Найдите первую организацию в разделе «Поиск» или импортируйте резервную копию v3.5.3 в разделе «Данные».')) + '</div></section>' +
      '<div class="col">' +
      '<section class="card stack-card"><div class="card-header"><h2>Мои задачи</h2><button class="link-text" data-act="nav" data-view="tasks">Все →</button></div>' +
      (tasksHtml || '<p class="muted small">Открытых задач нет.</p>') + '</section>' +
      '<section class="card stack-card"><div class="card-header"><h2>Последняя активность</h2></div>' +
      (actHtml || '<p class="muted small">История пока пуста — действия появятся после работы с карточками.</p>') + '</section>' +
      '</div></div>';
  }

  /* ---------------- раздел «Поиск» ---------------- */
  function identityBadge(c) {
    var idt = c._s3id;
    if (!idt) return '';
    if (idt.verdict === 'match') return '<span class="badge blue" title="' + esc(idt.reason) + '">совпадение подтверждено — уже в базе</span>';
    if (idt.verdict === 'ambiguous') return '<span class="badge review" title="' + esc(idt.reason) + '">возможен дубль — нужно решение</span>';
    return '<span class="badge done" title="' + esc(idt.reason) + '">отличается от существующих</span>';
  }
  function renderSearch() {
    var f = state.searchForm;
    var regions = Lumo.regions();
    var inds = Lumo.industries();
    var cityPool = Lumo.cityPool(f.regions);
    var tokenReady = Lumo.dadataReady();

    var regionOpts = regions.map(function (r) {
      return '<option value="' + esc(r.id) + '"' + (f.regions.indexOf(r.id) >= 0 ? ' selected' : '') + '>' + esc(r.label) + '</option>';
    }).join('');
    var cityOpts = cityPool.map(function (c) {
      return '<option value="' + esc(c.key) + '"' + (f.cities.indexOf(c.key) >= 0 ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var indOpts = inds.map(function (i) {
      return '<option value="' + esc(i.id) + '"' + (f.industry === i.id ? ' selected' : '') + '>' + esc(i.label) + '</option>';
    }).join('');

    var apiPanel =
      '<div class="select-grid">' +
      '<div class="field"><label for="s3-regions">Регионы (можно несколько)</label><select class="input" id="s3-regions" multiple size="7">' + regionOpts + '</select></div>' +
      '<div class="field"><label for="s3-cities">Города/населённые пункты (необязательно — иначе весь регион, включая деревни)</label><select class="input" id="s3-cities" multiple size="7">' + (cityOpts || '<option disabled>выберите регионы</option>') + '</select></div>' +
      '</div>' +
      '<div class="select-grid-3 mt12">' +
      '<div class="field"><label for="s3-industry">Отрасль</label><select class="input" id="s3-industry">' + indOpts + '</select></div>' +
      '<div class="field"><label for="s3-query">Запрос (название/основание, необязательно)</label><input class="input" type="text" id="s3-query" value="' + esc(f.query) + '" placeholder="например: агрофирма"></div>' +
      '<div class="field"><label for="s3-count">Результатов, не более</label><input class="input" type="number" id="s3-count" min="1" max="60" value="' + esc(f.count) + '"></div>' +
      '</div>' +
      '<label class="checkbox-line mt12"><input type="checkbox" id="s3-okved"' + (f.okved ? ' checked' : '') + '> фильтр по групповым кодам ОКВЭД отрасли</label>' +
      (tokenReady ? '' : '<div class="notice warn mt12">' + icon('alert') + '<div><strong>Ключ DaData не указан.</strong> Реальный ЕГРЮЛ-поиск выполняется только с вашим ключом (бесплатный тариф: 10 000 запросов/день). Укажите ключ в разделе «Данные» или используйте режим «JSON вручную». Без ключа результаты НЕ имитируются. Ключ хранится только в тестовом хранилище этой сборки.</div></div>') +
      '<div class="actions mt18"><button class="btn primary" data-act="search-run"' + (state.searchBusy ? ' disabled' : '') + '>' + (state.searchBusy ? 'Поиск…' : 'Найти организации (DaData)') + '</button>' +
      '<button class="btn" data-act="search-plan">Показать план запросов</button><span class="tiny muted">движок v3.5.3 · бюджет шагов ограничен</span></div>';

    var manualPanel =
      '<div class="field"><label for="s3-pasted">Вставьте ответ DaData Suggestions (JSON с массивом «suggestions») — штатный ручной режим движка, без ключа и сети</label>' +
      '<textarea class="input mono" id="s3-pasted" placeholder=\'{"suggestions":[ ... ]}\'></textarea></div>' +
      '<div class="select-grid mt12"><div class="field"><label for="s3-pasted-region">Регион карточки</label><select class="input" id="s3-pasted-region">' +
      regions.map(function (r) { return '<option value="' + esc(r.id) + '"' + (f.pastedRegion === r.id ? ' selected' : '') + '>' + esc(r.label) + '</option>'; }).join('') +
      '</select></div><div class="field" style="justify-content:flex-end"><label>&nbsp;</label><button class="btn primary" data-act="search-parse">Разобрать и проверить идентичность</button></div></div>';

    var results = '';
    if (state.results && state.results.items && state.results.items.length) {
      results = '<div class="card table-card mt18"><div class="table-top"><div><h2 class="section-title">Результаты' + (state.resultsQuery ? ' · ' + esc(state.resultsQuery) : '') + '</h2>' +
        '<div class="table-count mt8">' + state.results.items.length + ' организаций · проверка идентичности выполнена движком</div></div></div>' +
        resultsTable(state.results.items) +
        '<div class="table-bottom"><span>«Уже в базе» — только при подтверждённом совпадении; спорные случаи требуют явного решения.</span><span>Показано: ' + state.results.items.length + '</span></div></div>';
    } else if (state.results && state.results.ok === false) {
      results = '<div class="notice warn mt18" style="background:var(--danger-bg);border-color:#f3d4d0;color:#8c2f26">' + icon('alert') +
        '<div><strong>Поиск не выполнен:</strong> ' + esc(state.results.error || '') + (state.results.hint ? '<div class="small mt8">' + esc(state.results.hint) + '</div>' : '') + '</div></div>';
    } else if (state.results) {
      results = '<div class="card mt18">' + simpleEmpty('Пусто', 'Попробуйте другой запрос/регион или режим «JSON вручную».') + '</div>';
    }

    return header('Поиск организаций', 'Реальный ЕГРЮЛ-поиск движком v3.5.3: вся Удмуртия, Татарстан, Башкирия и Пермский край, включая деревни и посёлки без порога населения.') +
      '<div class="card search-panel">' +
      '<div class="region-pills" style="margin-top:0">' +
      '<button type="button" class="pill' + (f.mode === 'api' ? ' active' : '') + '" data-act="mode" data-mode="api" aria-pressed="' + (f.mode === 'api') + '">DaData API (реальный ЕГРЮЛ)</button>' +
      '<button type="button" class="pill' + (f.mode === 'manual' ? ' active' : '') + '" data-act="mode" data-mode="manual" aria-pressed="' + (f.mode === 'manual') + '">JSON вручную (без ключа)</button>' +
      '</div>' + (f.mode === 'api' ? apiPanel : manualPanel) + '</div>' + results;
  }
  function resultsTable(items) {
    var rows = items.map(function (c, i) {
      var city = Lumo.candidateActualCity(c) || '—';
      var approx = c.cityApprox || (c.geo && c.geo.approx);
      var inn = (c.entity && c.entity.inn) || c._inn || '';
      return '<tr>' +
        '<td><strong>' + esc(c.name) + '</strong>' + (approx ? ' <span class="badge neutral" title="Населённый пункт вне словаря — приблизительный ключ, фактическое название сохранено">approx</span>' : '') +
        '<small>' + esc(c.addressFull || '') + '</small></td>' +
        '<td>' + esc(city) + '<small>' + esc(Lumo.industryLabel(c.industry)) + '</small></td>' +
        '<td class="mono">' + esc(inn || '—') + '</td>' +
        '<td>' + identityBadge(c) + '</td>' +
        '<td><div class="row">' + rowActions(c, i) + '</div></td>' +
        '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table class="company-table"><colgroup><col style="width:30%"><col style="width:18%"><col style="width:13%"><col style="width:22%"><col style="width:17%"></colgroup>' +
      '<thead><tr><th>Организация</th><th>Населённый пункт</th><th>ИНН</th><th>Статус в базе</th><th>Действия</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function rowActions(c, i) {
    var idt = c._s3id;
    var a = '<button class="btn sm" data-act="cand-details" data-i="' + i + '">Детали</button>';
    if (idt && idt.verdict === 'match') a += '<button class="btn sm" data-act="open-card" data-id="' + esc(idt.leadId) + '">Открыть в базе</button>';
    else if (idt && idt.verdict === 'ambiguous') a += '<button class="btn sm primary" data-act="cand-decide" data-i="' + i + '">Решить…</button>';
    else a += '<button class="btn sm primary" data-act="cand-add" data-i="' + i + '">Добавить</button>';
    return a;
  }
  function withIdentities(items) {
    (items || []).forEach(function (c) { try { c._s3id = Lumo.identityOf(c); } catch (e) { c._s3id = { verdict: 'distinct', reason: 'проверка не выполнена: ' + e }; } });
    return items;
  }

  /* ---------------- раздел «Компании» ---------------- */
  function siteBadge(l) {
    var ks = (l.enrichment && l.enrichment.last && l.enrichment.last.knownSite) || null;
    if (ks) {
      if (ks.status === 'OK') return '<span class="badge done" title="' + esc((ks.reasons || []).join('; ')) + '">сайт подтверждён</span>';
      if (ks.status === 'STALE') return '<span class="badge danger" title="' + esc((ks.reasons || []).join('; ')) + '">сайт устарел</span>';
      return '<span class="badge review" title="' + esc((ks.reasons || []).join('; ')) + '">сайт не подтверждён</span>';
    }
    return l.website ? '<span class="badge neutral">сайт не проверен</span>' : '<span class="badge neutral">нет сайта</span>';
  }
  function renderCompanies() {
    var flt = state.companyFilter;
    var groups = Lumo.STAGE_GROUPS;
    var leads = Lumo.leads().filter(function (l) { return flt.archived ? !!l.archived : !l.archived; });
    if (flt.q) {
      var q = flt.q.toLowerCase();
      leads = leads.filter(function (l) {
        return (l.name || '').toLowerCase().indexOf(q) >= 0 ||
          ((l.entity && l.entity.inn) || '').indexOf(q) >= 0 ||
          (Lumo.actualCityName(l) || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (flt.group) leads = leads.filter(function (l) { return Lumo.groupOf(l) === flt.group; });

    var chips = '<button type="button" class="pill' + (!flt.group ? ' active' : '') + '" data-act="grp" data-g="" aria-pressed="' + (!flt.group) + '">Все<span class="pill-n">' + Lumo.leads().filter(function (l) { return flt.archived ? !!l.archived : !l.archived; }).length + '</span></button>' +
      groups.map(function (g) {
        var n = Lumo.leads().filter(function (l) { return (flt.archived ? !!l.archived : !l.archived) && Lumo.groupOf(l) === g.id; }).length;
        return '<button type="button" class="pill' + (flt.group === g.id ? ' active' : '') + '" data-act="grp" data-g="' + g.id + '" aria-pressed="' + (flt.group === g.id) + '">' + esc(g.label) + '<span class="pill-n">' + n + '</span></button>';
      }).join('');

    var rows = leads.map(function (l) {
      var a = l.analysis || {};
      var conf = a.conf && (a.conf.level || a.conf.value) ? a.conf : null;
      return '<tr data-act="open-card" data-id="' + esc(l.id) + '">' +
        '<td><button class="link-text one-line" data-act="open-card" data-id="' + esc(l.id) + '" style="font-size:13px">' + esc(l.name) + '</button>' +
        (l.archived ? ' <span class="badge neutral">архив</span>' : '') +
        '<small>' + esc(Lumo.actualCityName(l) || 'НП не определён') + ((l.cityApprox || (l.geo && l.geo.approx)) ? ' · approx' : '') + ' · ' + esc((l.geo && l.geo.regionName) || '') + '</small>' +
        '<small>' + esc(Lumo.industryLabel(l.industry)) + ((l.entity && l.entity.inn) ? ' · ИНН ' + esc(l.entity.inn) : '') + '</small></td>' +
        '<td>' + stageBadgeOf(l) + '<small>реальная стадия: ' + esc(Lumo.stageRu(l.stage)) + '</small></td>' +
        '<td>' + siteBadge(l) + '</td>' +
        '<td>' + (conf ? '<span class="badge outline" title="достоверность данных карточки">' + esc(String(conf.level || conf.value)) + '</span>' : '<span class="tiny muted">—</span>') + '</td>' +
        '<td><button class="link-text" data-act="open-card" data-id="' + esc(l.id) + '">Открыть →</button></td>' +
        '</tr>';
    }).join('');

    return header('Компании', 'Единая тестовая база движка v3.5.3. Местоположение помогает фильтровать, но не понижает ценность: деревни и посёлки — полноценные записи.') +
      '<div class="card" style="padding:20px 22px"><div class="toolbar" style="margin:0">' +
      '<div class="field grow"><label for="s3-cq">Поиск по компаниям</label><input class="input" type="text" id="s3-cq" placeholder="Название, ИНН или населённый пункт" value="' + esc(flt.q) + '"></div>' +
      '<div class="field" style="justify-content:flex-end"><label>&nbsp;</label><label class="checkbox-line"><input type="checkbox" id="s3-arch"' + (flt.archived ? ' checked' : '') + '> архив</label></div>' +
      '</div></div>' +
      '<div class="region-pills">' + chips + '</div>' +
      '<div class="card table-card"><div class="table-top"><div><h2 class="section-title">Список компаний</h2>' +
      '<div class="table-count mt8">' + leads.length + ' записей · поиск существующих записей — только здесь</div></div></div>' +
      (rows ? '<div class="tbl-wrap"><table class="company-table"><colgroup><col style="width:34%"><col style="width:20%"><col style="width:18%"><col style="width:13%"><col style="width:15%"></colgroup>' +
        '<thead><tr><th>Компания</th><th>Этап (группа)</th><th>Сайт</th><th>Достоверность</th><th>Действие</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : simpleEmpty('Пусто', 'Найдите и добавьте организацию в разделе «Поиск» или импортируйте резервную копию v3.5.3 в разделе «Данные».')) +
      '<div class="table-bottom"><span>Группы — только отображение; в модели хранятся реальные 19 стадий v3.5.3.</span><span>Показано: ' + leads.length + '</span></div></div>';
  }

  /* ---------------- карточка компании ---------------- */
  function kv(k, v) { return '<dt>' + k + '</dt><dd>' + (v == null || v === '' ? '<span class="faint">—</span>' : v) + '</dd>'; }
  function metricRow(label, val, max, hint) {
    var pct = (typeof val === 'number' && max) ? Math.max(0, Math.min(100, Math.round(val / max * 100))) : null;
    return '<div class="metric"><span title="' + esc(hint || '') + '">' + esc(label) + '</span><b>' + esc(val == null ? '—' : String(val)) + '</b></div>' +
      (pct !== null ? '<div class="meter"><i style="width:' + pct + '%"></i></div>' : '');
  }
  /* читаемое представление объектов-оценок движка (НЕ [object Object]) */
  function readinessText(r) { if (!r) return ''; if (typeof r === 'string') return r; return r.label || r.state || r.level || JSON.stringify(r).slice(0, 60); }
  function gapText(g) {
    if (!g) return 'не оценена движком (нет фактов)';
    if (typeof g === 'string') return g;
    if (g.level || g.state) return String(g.level || g.state);
    if (Array.isArray(g.items) && g.items.length) {
      return g.items.slice(0, 3).map(function (it) { return String(it.scope || it.kind || '').trim(); }).filter(Boolean).join('; ') + (g.items.length > 3 ? ' …' : '');
    }
    return JSON.stringify(g).slice(0, 120);
  }
  function buyingText(b) {
    if (b == null) return '—';
    if (typeof b === 'number' || typeof b === 'string') return String(b);
    if (b.level != null) return String(b.level);
    if (b.score != null) return String(b.score);
    return JSON.stringify(b).slice(0, 60);
  }
  function srcLabel(s) {
    var m = { OFFICIAL_SITE: 'официальный сайт', OFFICIAL_SITE_LINK: 'ссылка на официальном сайте', OFFICIAL_SITE_CONTACTS: 'страница контактов сайта', KNOWN_CARD: 'сайт карточки', SEARCH_RESULT: 'поисковая выдача', registry: 'ЕГРЮЛ (DaData)', manual: 'введено вручную', AI: 'ИИ-анализ (гипотеза)' };
    return m[s] || s || 'источник не указан';
  }
  function renderCard() {
    var l = Lumo.lead(state.cardId);
    if (!l) return '<div class="card detail-card">Компания не найдена. <button class="btn" data-act="nav" data-view="companies">К списку</button></div>';
    var a = l.analysis || {};
    var meta = Lumo.enrichMetaOf(l.id);
    var last = Lumo.enrichLastOf(l.id);
    var ks = (last && last.knownSite) || null;
    var g = l.geo || {};

    var head = '<button class="back" data-act="nav" data-view="companies">' + icon('back') + ' Компании</button>' +
      '<div class="heading"><div><div class="lead-meta mb10">' + stageBadgeOf(l) +
      (l.archived ? '<span class="badge neutral">архив</span>' : '') +
      (l.outcome ? '<span class="badge ' + (l.outcome === 'WON' ? 'won' : 'closed') + '">исход: ' + esc(l.outcome) + '</span>' : '') + '</div>' +
      '<h1>' + esc(l.name) + '</h1>' +
      '<p class="sub">' + esc(Lumo.actualCityName(l) || 'НП не определён') + ' · ' + esc(g.regionName || (l.cityKey ? Lumo.cityName(l.cityKey) : '')) + ' · ' + esc(Lumo.industryLabel(l.industry)) + '</p></div>' +
      '<div class="actions">' +
      '<button class="btn" data-act="enrich" data-mode="quick">' + icon('shield') + ' Проверить сайт и контакты</button>' +
      '<button class="btn" data-act="enrich" data-mode="deep">Глубокая проверка</button>' +
      '<button class="btn danger-outline" data-act="archive">' + (l.archived ? 'Вернуть из архива' : 'В архив') + '</button>' +
      '</div></div>';

    /* --- Компания --- */
    var company = '<section class="card detail-card"><h2>Компания</h2><dl class="kv">' +
      kv('ИНН / ОГРН', '<span class="mono">' + esc((l.entity && l.entity.inn) || '—') + '</span> / <span class="mono">' + esc((l.entity && l.entity.ogrn) || '—') + '</span>') +
      kv('Регион', esc(g.regionName || (l.cityKey ? Lumo.cityName(l.cityKey) : '—'))) +
      kv('Фактический НП', esc(Lumo.actualCityName(l) || '—') + ((l.cityApprox || g.approx) ? ' <span class="badge neutral" title="Населённый пункт вне словаря: приблизительный ключ расстояний; название сохранено как есть">приблизительный ключ</span>' : '') + (g.manual ? ' <span class="badge blue">подтверждён вручную</span>' : '')) +
      kv('Адрес', esc(g.addressFull || l.addressFull || '—')) +
      kv('Отрасль', esc(Lumo.industryLabel(l.industry))) +
      kv('Официальный сайт', l.website ? '<a href="' + esc(Lumo.safeUrl(l.website)) + '" target="_blank" rel="noopener noreferrer">' + esc(l.website) + '</a> ' + (ks ? (ks.status === 'OK' ? '<span class="badge done" title="' + esc((ks.reasons || []).join('; ')) + '">подтверждён</span>' : ks.status === 'STALE' ? '<span class="badge danger">устарел/недоступен</span>' : '<span class="badge review" title="' + esc((ks.reasons || []).join('; ')) + '">требует проверки</span>') : '<span class="badge neutral">не проверен</span>') : '<span class="badge neutral">нет сайта</span>') +
      kv('Источники', '<span class="small">' + esc(g.source || '—') + (meta && meta.website && meta.website.sourceUrl ? ' · ' + esc(srcLabel(meta.website.source)) + ': ' + esc(meta.website.sourceUrl) : '') + '</span>') +
      '</dl></section>';

    /* --- Перспективность (отдельные показатели, НЕ одна непрозрачная оценка) --- */
    var sc = a.score || {};
    var comps = sc.components || a.contrib || {};
    var persp = '<section class="card stack-card"><div class="card-header"><h2>Перспективность</h2></div>';
    if (a && (sc.total != null || a.readiness)) {
      persp += metricRow('Структурный рейтинг', sc.total, 100, 'canonScore движка v3.5.3');
      Object.keys(comps).slice(0, 10).forEach(function (k) {
        var v = comps[k]; var val = (v && typeof v === 'object') ? (v.points != null ? v.points : v.score) : v;
        persp += metricRow(k, typeof val === 'number' ? Math.round(val * 10) / 10 : val, 10);
      });
      persp += '<div class="badges mt8">' + (a.readiness ? '<span class="badge blue">готовность: ' + esc(readinessText(a.readiness)) + '</span>' : '') +
        (a.conf ? '<span class="badge outline">достоверность: ' + esc(a.conf.level || a.conf.value || '—') + '</span>' : '') +
        (a.recommendedStage ? '<span class="badge research">канон-этап: ' + esc(Lumo.stageRu(a.recommendedStage)) + '</span>' : '') + '</div>';
      var gap = a.gap || a.contentGap || null;
      persp += '<div class="mt12 small"><b>Потребность в контенте:</b> ' + esc(gapText(gap)) + '</div>';
      persp += '<div class="small"><b>Вероятность покупки:</b> ' + esc(buyingText(a.buying)) + '</div>';
      var risks = (a.risks || (l.facts && l.facts.risks) || []);
      persp += '<div class="small"><b>Финансовые/реестровые риски:</b> ' + (risks.length ? risks.map(function (r) { return esc((r.level || '') + ' ' + (r.note || r.type || '')); }).join('; ') : 'не выявлены') + '</div>';
      if (a.whyNow) persp += '<div class="small mt8"><b>Почему сейчас:</b> ' + esc(typeof a.whyNow === 'string' ? a.whyNow : (a.whyNow.level || a.whyNow.reason || JSON.stringify(a.whyNow).slice(0, 100))) + '</div>';
      persp += '<p class="kpi-note">Показатели движка v3.5.3 — не выдуманные метрики: нет данных → «не оценено».</p>';
    } else persp += '<p class="muted small">Оценок пока нет — добавьте факты или выполните проверку.</p>';
    persp += '</section>';

    /* --- Маркетинг --- */
    var mkt = '<section class="card detail-card"><h2>Маркетинг (цифровой след)</h2>';
    if (l.footprintUnknown) mkt += '<div class="mb10"><span class="badge review">Не проверено</span> <span class="small muted">цифровой след не исследован — «нет данных» ≠ «пробел»</span></div>';
    var soc = (l.facts && l.facts.social) || [];
    var metaSoc = ['vk', 'telegram', 'instagram', 'youtube', 'ok'].filter(function (k) { return meta[k] && meta[k].value; });
    mkt += '<dl class="kv">' +
      kv('Сайт', l.website ? esc(l.website) + (ks ? ' · ' + esc(ks.status) : '') : '<span class="badge neutral">Не проверено</span>') +
      kv('Соцсети', (soc.length || metaSoc.length) ? soc.map(function (s) { return esc(typeof s === 'string' ? s : (s.url || s.value || JSON.stringify(s))); }).concat(metaSoc.map(function (k) { return esc(k) + ': ' + esc(meta[k].value) + ' (' + esc(meta[k].confidence) + '%, ' + esc(srcLabel(meta[k].source)) + ')'; })).join('<br>') : '<span class="badge neutral">Не проверено</span>') +
      kv('Фото/видео на сайте', (l.facts && (l.facts.photoState || l.facts.sitePhoto)) ? esc(JSON.stringify(l.facts.photoState || l.facts.sitePhoto)) : '<span class="badge neutral">Не проверено</span>') +
      kv('Заметки по фактам', esc((l.facts && l.facts.notes) || '') || '<span class="faint">—</span>') +
      '</dl></section>';

    /* --- Контакты (только организации; источник у каждого) --- */
    var cts = '<section class="card detail-card"><h2>Контакты организации</h2>';
    var cList = (l.contacts || []).map(function (c) {
      return '<div class="ct-line"><div class="ct-body"><b>' + esc(c.name || 'Контакт') + ' <span class="badge outline">' + esc(c.roleLabel || c.role || '') + '</span>' +
        (c.disqualified ? ' <span class="badge danger">дисквалифицирован</span>' : '') + '</b>' +
        '<div class="ct-meta">' + esc(srcLabel(c.source)) + (c.conf != null ? ' · ' + esc(c.conf) + '%' : '') + '</div>' +
        '<div class="ct-val">' + (c.channels || []).map(function (ch) {
          var v = esc(ch.value);
          if (ch.type === 'email') { var mm = Lumo.safeMailto(ch.value); if (mm) v = '<a href="' + esc(mm) + '">' + v + '</a>'; }
          else if (ch.type === 'phone') v = '<a href="tel:' + esc(String(ch.value).replace(/[^+\d]/g, '')) + '">' + v + '</a>';
          return esc(ch.type) + ': ' + v;
        }).join(' · ') + '</div>' +
        (c.notes ? '<div class="ct-meta faint">' + esc(c.notes) + '</div>' : '') + '</div></div>';
    }).join('');
    cts += cList || '<p class="muted small">Подтверждённых контактов нет.</p>';
    var pend = [];
    ['email', 'phone'].forEach(function (k) {
      if (meta[k] && meta[k].value) {
        var val = esc(meta[k].value);
        if (k === 'email') { var mm = Lumo.safeMailto(meta[k].value); if (mm) val = '<a href="' + esc(mm) + '">' + val + '</a>'; }
        pend.push('<div class="small">' + esc(k) + ': <b>' + val + '</b> · ' + esc(meta[k].confidence) + '% · ' + esc(srcLabel(meta[k].source)) + (meta[k].sourceUrl ? ' · <a href="' + esc(Lumo.safeUrl(meta[k].sourceUrl)) + '" target="_blank" rel="noopener noreferrer">источник</a>' : '') + '</div>');
      }
    });
    var low = (last && last.low) || [];
    if (pend.length) cts += '<div class="mt12"><b class="small">Применены из проверки:</b>' + pend.join('') + '</div>';
    if (low.length) cts += '<div class="risk-box mt12"><strong>Требует проверки (низкая достоверность — НЕ применено):</strong>' + low.slice(0, 6).map(function (x) { return '<div class="small mt8"><span class="badge review">' + esc(x.kind) + '</span> ' + esc(x.value) + ' · ' + esc(x.confidence) + '% · ' + esc((x.reasons || []).join('; ')) + '</div>'; }).join('') + '</div>';
    cts += '<p class="detail-compact-note">Контакты сторонних сайтов в карточку не попадают (анти-каскад v3.5.0).</p></section>';

    /* --- Воронка --- */
    var stageOpts = (function () {
      var byGroup = {};
      Lumo.stages().forEach(function (s) { (byGroup[s.group] = byGroup[s.group] || []).push(s); });
      var gNames = { research: 'Исследование', decision: 'Решение', gate: 'Барьеры', contact: 'Контакт' };
      return Object.keys(byGroup).map(function (gg) {
        return '<optgroup label="' + esc(gNames[gg] || gg) + '">' + byGroup[gg].map(function (s) {
          return '<option value="' + esc(s.id) + '"' + (l.stage === s.id ? ' selected' : '') + '>' + esc(s.ru) + '</option>';
        }).join('') + '</optgroup>';
      }).join('');
    })();
    var hist = Lumo.history(l.id).slice(0, 40).map(function (h) {
      return '<li><span class="hist-at mono">' + esc((h.at || '').slice(0, 16).replace('T', ' ')) + '</span> <b>' + esc(h.title || h.type || '') + '</b>' + (h.detail ? '<div class="hist-detail">' + esc(h.detail) + '</div>' : '') + '</li>';
    }).join('');
    var funnel = '<section class="card detail-card"><h2>Воронка продаж</h2>' +
      '<div class="field"><label for="s3-stage">Реальный этап (19 значений v3.5.3; группы — только отображение)</label>' +
      '<select class="input" id="s3-stage">' + stageOpts + '</select></div>' +
      '<div class="row mt12" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="small muted">Коммерческий исход:</span>' +
      ['WON', 'LOST', 'STOP'].map(function (o) {
        return '<button class="btn sm' + (l.outcome === o ? ' primary' : '') + '" data-act="outcome" data-o="' + o + '">' + o + '</button>';
      }).join(' ') + (l.outcome ? '<span class="badge ' + (l.outcome === 'WON' ? 'won' : 'closed') + '">' + esc(l.outcome) + '</span>' : '') + '</div>' +
      '<div class="field mt12"><label for="s3-next">Следующее действие</label>' +
      '<div class="toolbar" style="margin:0"><div class="field grow"><input class="input" type="text" id="s3-next" value="' + esc(l.nextStep || '') + '" placeholder="что делаем дальше"></div>' +
      '<div class="field"><input class="input" type="date" id="s3-nextdate" value="' + esc(l.nextStepDate || '') + '"></div>' +
      '<div class="field"><button class="btn" data-act="next-save">Сохранить</button></div></div></div>' +
      '<h3 class="mt18">История взаимодействий (' + ((l.history || []).length) + ')</h3><ul class="hist">' + (hist || '<li class="muted small">пусто</li>') + '</ul></section>';

    /* --- Задачи --- */
    var kinds = Lumo.taskKinds();
    var tList = Lumo.tasksOf(l.id).map(function (t) {
      var di = dueInfo(t);
      return '<div class="task-line' + (t.status === 'DONE' ? ' done-task' : '') + '"><span class="badge ' + (t.status === 'DONE' ? 'done' : t.status === 'CANCELED' ? 'closed' : di[0]) + '">' + esc(t.status) + '</span>' +
        '<div class="task-main"><div style="min-width:0"><strong>' + esc(t.title) + '</strong><span>' + esc(kinds[t.kind] ? kinds[t.kind].label || t.kind : t.kind) + (t.dueAt ? ' · до ' + esc(shortDate(t.dueAt)) : '') + '</span></div></div>' +
        '<span class="sp"></span>' +
        (t.status === 'OPEN' ? '<span class="task-acts"><button class="btn sm" data-act="task-done" data-t="' + esc(t.id) + '">Выполнено</button><button class="btn sm" data-act="task-cancel" data-t="' + esc(t.id) + '">Отменить</button></span>' : '') +
        '</div>';
    }).join('');
    var kindOpts = Object.keys(kinds).map(function (k) { return '<option value="' + esc(k) + '">' + esc(kinds[k].label || k) + '</option>'; }).join('');
    var tasks = '<section class="card stack-card"><div class="card-header"><h2>Задачи</h2></div>' + (tList || '<p class="muted small">Задач нет.</p>') +
      '<div class="toolbar mt12" style="margin-bottom:0"><div class="field grow"><input class="input" type="text" id="s3-tt" placeholder="новое действие…"></div>' +
      '<div class="field"><select class="input" id="s3-tk">' + kindOpts + '</select></div>' +
      '<div class="field"><input class="input" type="date" id="s3-td"></div>' +
      '<div class="field"><button class="btn primary" data-act="task-add">' + icon('plus') + ' Добавить</button></div></div>' +
      '<p class="detail-compact-note">Контактные задачи до прохождения барьеров блокируются STOP-правилом движка.</p></section>';

    /* --- Результаты (только реальные данные) --- */
    var offers = l.primaryOffer || l.secondaryOffer;
    var res = '<section class="card stack-card"><div class="card-header"><h2>Результаты</h2></div><dl class="kv">' +
      kv('Исход', l.outcome ? '<span class="badge ' + (l.outcome === 'WON' ? 'won' : 'closed') + '">' + esc(l.outcome) + '</span>' : '<span class="faint">Нет данных</span>') +
      kv('Оффер', offers ? esc((Lumo.offers()[l.primaryOffer] && Lumo.offers()[l.primaryOffer].label) || l.primaryOffer || '') + (l.secondaryOffer ? ' + ' + esc(l.secondaryOffer) : '') : '<span class="faint">Нет данных</span>') +
      kv('Оценка выручки', l.revenueEst ? esc(l.revenueEst) : '<span class="faint">Нет данных</span>') +
      kv('Логистика/прайс', a.pricing ? '<span class="small">' + esc(a.pricing.level || a.pricing.label || JSON.stringify(a.pricing).slice(0, 90)) + '</span>' + ((l.cityApprox || (l.geo && l.geo.approx)) ? ' <span class="badge review">география не определена — расчёт без доп. логистических допущений</span>' : '') : '<span class="faint">Нет данных</span>') +
      '</dl><p class="detail-compact-note">Договоры/суммы не выдумываются: блок пуст, пока нет реальных данных.</p></section>';

    return head + enrichPanel(l) +
      '<div class="detail-grid"><div class="col">' + company + funnel + cts + mkt + '</div>' +
      '<div class="col">' + persp + tasks + res + '</div></div>';
  }
  function enrichPanel(l) {
    var E = state.lastEnrich && state.lastEnrich.for === l.id ? state.lastEnrich.E : null;
    if (!E) return '';
    var ks = E.knownSite || {};
    var parts = [];
    parts.push('<b>Проверка выполнена</b> (' + esc(E.mode || '') + ', ' + esc(E.at || '') + ')');
    if (ks.status) parts.push('сайт: <span class="badge ' + (ks.status === 'OK' ? 'done' : ks.status === 'STALE' ? 'danger' : 'review') + '">' + esc(ks.status) + '</span> ' + esc((ks.reasons || []).join('; ')));
    if (E.website) parts.push('сайт-кандидат: ' + esc(E.website.value) + ' (' + esc(E.website.confidence) + '%)');
    if (E.email) parts.push('email: ' + esc(E.email.value) + ' (' + esc(E.email.confidence) + '%, ' + esc(srcLabel(E.email.source)) + ')');
    if (E.phone) parts.push('телефон: ' + esc(E.phone.value) + ' (' + esc(E.phone.confidence) + '%)');
    (E.socials || []).slice(0, 4).forEach(function (s) { parts.push(esc(s.platform || '') + ': ' + esc(s.value) + ' (' + esc(s.confidence) + '%)'); });
    (E.low || []).slice(0, 5).forEach(function (x) { parts.push('<span class="badge review">требует проверки</span> ' + esc(x.kind) + ': ' + esc(x.value) + ' (' + esc(x.confidence) + '%)'); });
    if (E.searchHealth && E.searchHealth.state && E.searchHealth.state !== 'AVAILABLE' && E.searchHealth.state !== 'NOT_USED')
      parts.push('<span class="badge review">поисковые движки недоступны (' + esc(E.searchHealth.state) + ') — результат только по known-site валидации</span>');
    return '<div class="result-inset mb10"><div class="kv-inline">' + parts.join('<br>') + '</div>' +
      '<div class="actions mt12"><button class="btn primary" data-act="enrich-apply">Применить выбранное…</button>' +
      '<button class="btn ghost" data-act="enrich-dismiss">Скрыть панель</button></div></div>';
  }

  /* ---------------- задачи (глобально) ---------------- */
  function renderTasks() {
    var kinds = Lumo.taskKinds();
    var all = Lumo.allTasks();
    var open = all.filter(function (t) { return t.status === 'OPEN'; });
    var today = todayStr();
    var filters = [['open', 'Открытые'], ['today', 'На сегодня'], ['overdue', 'Просроченные'], ['done', 'Выполненные'], ['all', 'Все']];
    var list = all.filter(function (t) {
      if (state.taskFilter === 'all') return true;
      if (state.taskFilter === 'open') return t.status === 'OPEN';
      if (state.taskFilter === 'done') return t.status === 'DONE';
      if (state.taskFilter === 'today') return t.status === 'OPEN' && t.dueAt && String(t.dueAt).slice(0, 10) === today;
      if (state.taskFilter === 'overdue') return t.status === 'OPEN' && t.dueAt && String(t.dueAt).slice(0, 10) < today;
      return true;
    });
    list.sort(function (a, b) { return (a.status === 'DONE' ? 1 : 0) - (b.status === 'DONE' ? 1 : 0) || String(a.dueAt || '9999').localeCompare(String(b.dueAt || '9999')); });

    var rows = list.map(function (t) {
      var l = Lumo.lead(t.leadId);
      var di = dueInfo(t);
      return '<div class="task-record' + (t.status === 'DONE' ? ' is-done' : '') + '">' +
        '<button class="icon-btn" title="' + (t.status === 'OPEN' ? 'Выполнено' : 'Статус: ' + esc(t.status)) + '" data-act="task-done" data-t="' + esc(t.id) + '"' + (t.status !== 'OPEN' ? ' disabled' : '') + '>' + icon(t.status === 'OPEN' ? 'circle' : 'check') + '</button>' +
        '<div><strong>' + esc(t.title) + '</strong><small>' + esc(kinds[t.kind] ? kinds[t.kind].label || t.kind : t.kind) + '</small></div>' +
        '<div class="task-company">' + (l ? '<button class="link-text" data-act="open-card" data-id="' + esc(l.id) + '" style="font-size:11px">' + esc(l.name) + '</button>' : '<small>—</small>') + '</div>' +
        '<div class="task-date"><span class="badge ' + di[0] + '">' + esc(di[1]) + '</span></div>' +
        '<div class="task-controls actions">' + (t.status === 'OPEN' ? '<button class="icon-btn" title="Отменить задачу" data-act="task-cancel" data-t="' + esc(t.id) + '">' + icon('trash') + '</button>' : '') + '</div>' +
        '</div>';
    }).join('');

    return header('Задачи', 'Проверки компаний, письма, встречи и контроль ответов. STOP-правила движка: контактные задачи блокируются до прохождения барьеров.') +
      '<div class="stat-grid">' +
      '<article class="card stat-card"><div class="stat-label">Открытые</div><div class="stat-number">' + open.length + '</div><div class="stat-foot">Задач в работе</div></article>' +
      '<article class="card stat-card"><div class="stat-label">Сегодня</div><div class="stat-number">' + open.filter(function (t) { return t.dueAt && String(t.dueAt).slice(0, 10) === today; }).length + '</div><div class="stat-foot">Запланировано на сегодня</div></article>' +
      '<article class="card stat-card"><div class="stat-label">Просрочено</div><div class="stat-number" style="color:var(--danger)">' + open.filter(function (t) { return t.dueAt && String(t.dueAt).slice(0, 10) < today; }).length + '</div><div class="stat-foot">Нужно перенести или закрыть</div></article>' +
      '<article class="card stat-card"><div class="stat-label">Выполнено</div><div class="stat-number">' + all.filter(function (t) { return t.status === 'DONE'; }).length + '</div><div class="stat-foot">Сохранено в истории</div></article>' +
      '</div>' +
      '<div class="region-pills" style="margin-bottom:18px">' + filters.map(function (f) {
        return '<button type="button" class="pill' + (state.taskFilter === f[0] ? ' active' : '') + '" data-act="task-filter" data-id="' + f[0] + '" aria-pressed="' + (state.taskFilter === f[0]) + '">' + esc(f[1]) + '</button>';
      }).join('') + '</div>' +
      '<section class="card task-table">' + (rows || simpleEmpty('Таких задач нет', 'Создайте задачу из карточки компании или выберите другой фильтр.')) + '</section>';
  }

  /* ---------------- данные/настройки ---------------- */
  function renderData() {
    var si = Lumo.storageInfo();
    return header('Данные', 'Хранилище, ключи внешних сервисов, резервные копии и безопасный перенос базы из Lumo v3.5.3.') +
      '<div class="notice">' + icon('info') + '<div><strong>Изоляция.</strong> Это приложение работает только в отдельном тестовом ключе <code>' + esc(si.testKey) + '</code>. Рабочий ключ v3.5.3 <code>' + esc(si.prodKey) + '</code> не читается и не пишется (подтверждено canary-тестами). Перенос базы — только вручную: экспорт в v3.5.3 → импорт здесь.</div></div>' +
      '<div class="detail-grid">' +
      '<div class="col">' +
      '<section class="card detail-card"><h2>Хранилище</h2><dl class="kv">' +
      kv('Тестовый ключ', '<code>' + esc(si.testKey) + '</code> · ' + si.bytes + ' B · компаний: ' + si.leads + ' · задач: ' + si.tasks) +
      kv('Рабочий ключ v3.5.3', '<code>' + esc(si.prodKey) + '</code> — <b>не читается и не пишется</b> этим приложением (единственная правка движка: LS_KEY override; подтверждено canary-тестом)') +
      '</dl></section>' +
      '<section class="card detail-card"><h2>Резервные копии (формат v3.5.3, BACKUP_VERSION=' + esc(Lumo.backupVersion()) + ')</h2>' +
      '<div class="field"><label for="s3-bfile">Файл бэкапа v3.5.3 (.json)</label><input class="input" type="file" id="s3-bfile" accept=".json,application/json"></div>' +
      '<div class="actions mt12"><button class="btn" data-act="bk-validate">Проверить</button>' +
      '<button class="btn primary" data-act="bk-import">Импортировать (замена тестовой базы)</button>' +
      '<button class="btn" data-act="bk-merge">Долить без дублей (merge)</button></div>' +
      '<div id="s3-bk-out" class="small mt12"></div>' +
      '<div class="actions mt18"><button class="btn" data-act="bk-export">' + icon('download') + ' Скачать резервную копию</button></div>' +
      '<div class="muted-block mt12">Перенос из рабочей v3.5.3: (1) в рабочей Lumo «Данные → Экспорт резервной копии»; (2) здесь — выбрать файл → «Проверить» → «Импортировать» (замена) или «Долить без дублей» (ID сохраняются, дубли отбрасываются, защищённые поля не перезаписываются). Отмена: не импортируйте файл — старая копия остаётся нетронутой.</div>' +
      '</section>' +
      '<section class="card detail-card" style="border-color:#f3d4d0"><h2 class="text-danger">Опасная зона (только тестовая база)</h2>' +
      '<div class="actions"><button class="btn danger-outline" data-act="db-reset">' + icon('trash') + ' Очистить тестовую базу</button>' +
      '<span class="small muted">рабочая база v3.5.3 не затрагивается никогда</span></div></section>' +
      '</div>' +
      '<div class="col">' +
      '<section class="card detail-card"><h2>Ключ DaData</h2>' +
      '<div class="field"><label for="s3-token">API-ключ (хранится только в тестовом хранилище; в отчёты/логи не попадает)</label>' +
      '<input class="input" type="password" id="s3-token" placeholder="' + (Lumo.dadataReady() ? 'ключ указан' : 'не указан') + '"></div>' +
      '<div class="actions mt12"><button class="btn primary" data-act="token-save">Сохранить ключ</button><button class="btn" data-act="token-clear">Удалить ключ</button></div>' +
      '<p class="detail-compact-note">Бесплатный тариф DaData: 10 000 запросов/день — dadata.ru → «Ключи API». Без ключа поиск честно показывает «нужен ключ», симуляции нет.</p></section>' +
      '<section class="card detail-card"><h2>Локальный поиск-сервис (helper/SearXNG)</h2>' +
      '<div class="field"><label for="s3-helper">Local Helper URL</label><input class="input" type="text" id="s3-helper" value="' + esc(Lumo.helperUrl()) + '"></div>' +
      '<div class="actions mt12"><button class="btn" data-act="helper-save">Сохранить</button><button class="btn" data-act="helper-check">' + icon('shield') + ' Диагностика подключения</button></div>' +
      '<div class="small muted mt12" id="s3-health-out"></div>' +
      '<div class="muted-block mt12">Как включить на Mac: запустите <code>local-search/start_lumo_search.command</code> из поставки v3.5.3 (поднимет helper 127.0.0.1:8765 и SearXNG 127.0.0.1:8888 в Docker), затем нажмите «Диагностика подключения». Для GitHub Pages helper’у нужны разрешённые origin (LUMO_EXTRA_ORIGINS). Origin-guard и SSRF-защиту обходить нельзя.</div></section>' +
      '</div></div>';
  }

  /* ---------------- рендер ---------------- */
  function render() {
    renderNav(); renderStatus();
    var cr = el('s3-crumb'); if (cr) cr.textContent = state.view === 'card' ? 'Компании' : (VIEWS[state.view] || '');
    var m = el('s3-main');
    if (!m) return;
    if (state.view === 'home') m.innerHTML = renderHome();
    else if (state.view === 'search') m.innerHTML = renderSearch();
    else if (state.view === 'companies') m.innerHTML = renderCompanies();
    else if (state.view === 'card') m.innerHTML = renderCard();
    else if (state.view === 'tasks') m.innerHTML = renderTasks();
    else if (state.view === 'data') m.innerHTML = renderData();
    else m.innerHTML = renderSearch();
    m.innerHTML += '<p class="page-foot">Lumo 4.0 · движок v3.5.3 (сервисный модуль) · хранилище: только тестовый ключ · без ключей/сервисов реальные данные не имитируются</p>';
  }

  /* ---------------- действия ---------------- */
  function currentItems() { return (state.results && state.results.items) || []; }
  function collectSearchForm() {
    var f = state.searchForm;
    var rs = el('s3-regions'); if (rs) f.regions = Array.prototype.slice.call(rs.selectedOptions).map(function (o) { return o.value; });
    var cs = el('s3-cities'); if (cs) f.cities = Array.prototype.slice.call(cs.selectedOptions).map(function (o) { return o.value; });
    var ind = el('s3-industry'); if (ind) f.industry = ind.value;
    var q = el('s3-query'); if (q) f.query = q.value.trim();
    var cn = el('s3-count'); if (cn) f.count = Math.max(1, Math.min(60, parseInt(cn.value, 10) || 20));
    var ok = el('s3-okved'); if (ok) f.okved = ok.checked;
    return f;
  }
  function doSearch() {
    var f = collectSearchForm();
    state.searchBusy = true; render();
    Lumo.search({ regions: f.regions, industry: f.industry, query: f.query, cities: f.cities, count: f.count, okvedFilter: f.okved })
      .then(function (r) {
        state.searchBusy = false;
        if (r && r.ok) { state.results = r; state.resultsQuery = r.query || ''; withIdentities(r.items); }
        else state.results = r || { ok: false, error: 'пустой ответ' };
        render();
        if (r && r.ok) toast('Найдено организаций: ' + r.items.length + ' (запросов к DaData: ' + r.requests + ')', 'ok');
      })
      .catch(function (e) { state.searchBusy = false; state.results = { ok: false, error: String(e && e.message || e) }; render(); });
  }
  function showPlan() {
    var f = collectSearchForm();
    var p = Lumo.searchPlanPreview({ regions: f.regions, industry: f.industry, query: f.query, cities: f.cities, okvedFilter: f.okved });
    dialog('<div class="modal-head"><div><h3>План запросов движка</h3><p class="small">шагов: ' + p.steps + ' · режим: ' + esc((p.meta || {}).mode || '') + (p.meta && p.meta.truncated ? ' · <b>усечён бюджетом</b>' : '') + '</p></div>' +
      '<button class="icon-btn" data-act="dlg-close" aria-label="Закрыть окно">' + icon('x') + '</button></div>' +
      '<ul class="small" style="margin:0;padding-left:18px">' + p.queries.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul>' +
      '<div class="modal-footer"><button class="btn" data-act="dlg-close">Закрыть</button></div>');
  }
  function decideDialog(i) {
    var c = currentItems()[i]; if (!c) return;
    var idt = c._s3id || Lumo.identityOf(c);
    dialog('<div class="modal-head"><div><h3>Возможен дубль — требуется решение</h3><p>' + esc(idt.reason || '') + '</p></div>' +
      '<button class="icon-btn" data-act="dlg-close" aria-label="Закрыть окно">' + icon('x') + '</button></div>' +
      '<div class="panel"><b>' + esc(c.name) + '</b><br>ИНН: <span class="mono">' + esc((c.entity && c.entity.inn) || c._inn || '—') + '</span><br>' + esc(c.addressFull || '') + '</div>' +
      (idt.leadId ? '<div class="panel mt8"><b>В базе:</b> ' + esc(idt.leadName) + '</div>' : '') +
      '<div class="modal-footer" style="flex-direction:column;align-items:stretch">' +
      '<button class="btn primary" data-act="dec-same" data-i="' + i + '">Это та же организация — открыть карточку</button>' +
      '<button class="btn" data-act="dec-diff" data-i="' + i + '">Это другая организация — добавить отдельно</button>' +
      '<button class="btn ghost" data-act="dlg-close">Отмена (ничего не менять)</button></div>');
  }
  function detailsDialog(i) {
    var c = currentItems()[i]; if (!c) return;
    var g = c.geo || {};
    dialog('<div class="modal-head"><div><h3>' + esc(c.name) + '</h3></div>' +
      '<button class="icon-btn" data-act="dlg-close" aria-label="Закрыть окно">' + icon('x') + '</button></div>' +
      '<dl class="kv small">' +
      kv('ИНН / ОГРН', '<span class="mono">' + esc((c.entity && c.entity.inn) || '—') + ' / ' + esc((c.entity && c.entity.ogrn) || '—') + '</span>') +
      kv('Адрес (ЕГРЮЛ)', esc(c.addressFull || '—')) +
      kv('Фактический НП', esc(Lumo.candidateActualCity(c) || '—') + (c.cityApprox ? ' <span class="badge neutral">приблизительный ключ</span>' : '')) +
      kv('Гео-модель', '<span class="small mono">' + esc(JSON.stringify({ region: g.regionName, loc: g.localityName, type: g.localityType, district: g.district, kladr: g.kladr, approx: g.approx })) + '</span>') +
      kv('Отрасль', esc(Lumo.industryLabel(c.industry))) +
      kv('Сотрудников / год', esc(c.employees == null ? '—' : c.employees) + ' / ' + esc(c.founded || '—')) +
      kv('Идентичность', esc((c._s3id || {}).verdict || '—') + ' · ' + esc((c._s3id || {}).reason || '')) +
      kv('Описание', '<span class="small">' + esc(c.description || '') + '</span>') +
      '</dl><div class="modal-footer"><button class="btn" data-act="dlg-close">Закрыть</button></div>');
  }
  async function doEnrich(mode) {
    var id = state.cardId;
    toast('Проверка… (' + mode + ') — запросы идут через локальный helper');
    try {
      var E = await Lumo.enrich(id, mode);
      state.lastEnrich = { for: id, E: E };
      render();
      toast('Проверка завершена: ' + ((E.knownSite && E.knownSite.status) || (E.website ? 'сайт-кандидат' : 'без подтверждений')), E.knownSite && E.knownSite.status === 'OK' ? 'ok' : 'warn');
    } catch (e) {
      toast('Проверка не выполнена: ' + String(e && e.message || e).slice(0, 140), 'err');
    }
  }
  function applyDialog() {
    var id = state.cardId;
    var opts = Lumo.enrichOpenApply(id);
    if (!opts.length) { toast('Нечего применять — движок не предложил подтверждённых значений', 'warn'); Lumo.enrichCloseApply(); return; }
    dialog('<div class="modal-head"><div><h3>Применить результаты проверки</h3><p>Отметьте, что перенести в карточку. Guard’ы движка (низкая достоверность, ручные подтверждения) соблюдаются автоматически.</p></div>' +
      '<button class="icon-btn" data-act="apply-cancel" aria-label="Закрыть окно">' + icon('x') + '</button></div>' +
      '<div class="modal-grid">' + opts.map(function (o) {
        return '<label class="chk"><input type="checkbox" data-k="' + esc(o.key) + '"' + (o.checked ? ' checked' : '') + '> <span>' + esc(o.label) + '</span></label>';
      }).join('') + '</div>' +
      '<div class="modal-footer"><button class="btn" data-act="apply-cancel">Отмена</button><button class="btn primary" data-act="apply-go">Применить</button></div>',
      function (root) {
        root.querySelector('[data-act="apply-go"]').addEventListener('click', function () {
          var keys = Array.prototype.slice.call(root.querySelectorAll('input[data-k]')).filter(function (b) { return b.checked; }).map(function (b) { return b.getAttribute('data-k'); });
          closeDialog();
          try { Lumo.enrichApply(id, keys); toast('Применено полей: ' + keys.length, 'ok'); state.lastEnrich = null; render(); }
          catch (e) { toast('Не применено: ' + String(e && e.message || e).slice(0, 140), 'err'); }
        });
      });
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'nav') { ev.preventDefault(); collectSearchForm(); go(t.getAttribute('data-view')); }
    else if (act === 'dlg-close') closeDialog();
    else if (act === 'dlg-close-bg' && ev.target === t) closeDialog();
    else if (act === 'mode') { state.searchForm.mode = t.getAttribute('data-mode'); collectSearchForm(); render(); }
    else if (act === 'search-run') doSearch();
    else if (act === 'search-plan') showPlan();
    else if (act === 'search-parse') {
      var txt = (el('s3-pasted') || {}).value || '';
      var reg = (el('s3-pasted-region') || {}).value || 'udmurtia';
      var r = Lumo.parsePasted(txt, reg);
      if (r.ok) { state.results = r; state.resultsQuery = 'ручной JSON'; withIdentities(r.items); toast('Разобрано кандидатов: ' + r.items.length, 'ok'); }
      else { state.results = r; toast(r.error || 'Не удалось разобрать', 'err'); }
      render();
    }
    else if (act === 'cand-details') detailsDialog(parseInt(t.getAttribute('data-i'), 10));
    else if (act === 'cand-decide') decideDialog(parseInt(t.getAttribute('data-i'), 10));
    else if (act === 'dec-same') { var i1 = parseInt(t.getAttribute('data-i'), 10); var idt1 = currentItems()[i1]._s3id; closeDialog(); if (idt1 && idt1.leadId) go('card', { cardId: idt1.leadId }); }
    else if (act === 'dec-diff') {
      var i2 = parseInt(t.getAttribute('data-i'), 10); var c2 = currentItems()[i2]; closeDialog();
      try { var r2 = Lumo.addFromCandidate(c2, { force: 'different' }); toast('Добавлено решением пользователя: ' + c2.name, 'ok'); go('card', { cardId: r2.leadId }); }
      catch (e) { toast(String(e && e.message || e), 'err'); }
    }
    else if (act === 'cand-add') {
      var i3 = parseInt(t.getAttribute('data-i'), 10); var c3 = currentItems()[i3];
      try {
        var r3 = Lumo.addFromCandidate(c3);
        if (r3.action === 'exists') { toast('Уже в базе (подтверждённое совпадение): ' + r3.reason, 'warn'); go('card', { cardId: r3.leadId }); }
        else if (r3.action === 'needs-decision') decideDialog(i3);
        else { toast('Добавлено: ' + c3.name, 'ok'); c3._s3id = Lumo.identityOf(c3); go('card', { cardId: r3.leadId }); }
      } catch (e) { toast(String(e && e.message || e), 'err'); }
    }
    else if (act === 'open-card') { ev.preventDefault(); collectSearchForm(); go('card', { cardId: t.getAttribute('data-id') }); }
    else if (act === 'grp') { state.companyFilter.group = t.getAttribute('data-g'); render(); }
    else if (act === 'task-filter') { state.taskFilter = t.getAttribute('data-id'); render(); }
    else if (act === 'enrich') doEnrich(t.getAttribute('data-mode') || 'quick');
    else if (act === 'enrich-apply') applyDialog();
    else if (act === 'enrich-dismiss') { state.lastEnrich = null; render(); }
    else if (act === 'archive') {
      var l4 = Lumo.lead(state.cardId);
      Lumo.setArchived(state.cardId, !l4.archived); toast(l4.archived ? 'Возвращено из архива' : 'Перемещено в архив', 'ok'); render();
    }
    else if (act === 'outcome') {
      var o5 = t.getAttribute('data-o');
      confirm('Коммерческий исход ' + o5, 'Записать исход <b>' + esc(o5) + '</b>? Движок обновит этап/историю по своим правилам.', function () {
        Lumo.markOutcome(state.cardId, o5, 'Решение пользователя в Lumo 4.0'); toast('Исход записан: ' + o5, 'ok'); render();
      }, 'Записать');
    }
    else if (act === 'next-save') {
      Lumo.setNextStep(state.cardId, (el('s3-next') || {}).value, (el('s3-nextdate') || {}).value || null);
      toast('Следующее действие сохранено', 'ok'); render();
    }
    else if (act === 'task-add') {
      try {
        Lumo.addTask(state.cardId, { title: (el('s3-tt') || {}).value || '', kind: (el('s3-tk') || {}).value || 'ACTION', dueAt: (el('s3-td') || {}).value || null });
        toast('Задача добавлена', 'ok'); render();
      } catch (e) { toast(String(e && e.message || e).slice(0, 200), 'err'); }
    }
    else if (act === 'task-done') { try { Lumo.updateTask(t.getAttribute('data-t'), { status: 'DONE' }); toast('Задача выполнена', 'ok'); render(); } catch (e) { toast(String(e && e.message || e), 'err'); } }
    else if (act === 'task-cancel') { try { Lumo.updateTask(t.getAttribute('data-t'), { status: 'CANCELED' }); toast('Задача отменена', 'ok'); render(); } catch (e) { toast(String(e && e.message || e), 'err'); } }
    else if (act === 'token-save') { Lumo.setDadataToken(((el('s3-token') || {}).value || '').trim()); toast(Lumo.dadataReady() ? 'Ключ сохранён (в тестовом хранилище)' : 'Ключ не принят движком', Lumo.dadataReady() ? 'ok' : 'err'); render(); }
    else if (act === 'token-clear') { Lumo.setDadataToken(''); toast('Ключ удалён', 'ok'); render(); }
    else if (act === 'helper-save') { Lumo.setHelperUrl(((el('s3-helper') || {}).value || '')); toast('Helper URL сохранён', 'ok'); refreshHealth(); }
    else if (act === 'helper-check') {
      Lumo.searchHealth().then(function (h) {
        state.health = h; renderStatus();
        var o = el('s3-health-out');
        if (o) o.textContent = 'DaData: ' + (Lumo.dadataReady() ? 'ключ указан' : 'нет ключа') + ' · helper: ' + (h.helper ? 'доступен' : 'недоступен') + ' · SearXNG: ' + (h.searxng ? 'доступен' : 'недоступен') + ' · ' + JSON.stringify(h);
        toast(h.ok ? 'Поиск-сервис доступен' : (h.helper ? 'Helper работает, SearXNG недоступен (SERP-поиск выключен)' : 'Helper недоступен — нужен локальный сервис на вашем Mac'), h.ok ? 'ok' : 'warn');
      }).catch(function (e) { toast(String(e), 'err'); });
    }
    else if (act === 'bk-validate' || act === 'bk-import' || act === 'bk-merge') readBackupFile(act);
    else if (act === 'bk-export') {
      var s = Lumo.exportJson();
      var blob = new Blob([s], { type: 'application/json' });
      var a6 = document.createElement('a');
      a6.href = URL.createObjectURL(blob); a6.download = 'lumo4_backup_' + todayStr() + '.json';
      document.body.appendChild(a6); a6.click(); a6.remove();
      toast('Резервная копия выгружена', 'ok');
    }
    else if (act === 'db-reset') {
      confirm('Очистить тестовую базу?', 'Будут удалены ВСЕ компании/задачи тестового хранилища Lumo 4.0. Рабочая база v3.5.3 не затрагивается.', function () {
        Lumo.resetTestDb(); state.results = null; state.cardId = null; toast('Тестовая база очищена', 'ok'); go('companies');
      }, 'Очистить');
    }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 's3-cq') { state.companyFilter.q = t.value.trim(); render(); var f = el('s3-cq'); if (f) { f.focus(); try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) { } } }
    else if (t.id === 's3-arch') { state.companyFilter.archived = t.checked; render(); }
    else if (t.id === 's3-regions' || t.id === 's3-cities') { collectSearchForm(); render(); }
    else if (t.id === 's3-stage') {
      try { Lumo.setStage(state.cardId, t.value, 'Смена этапа в Lumo 4.0'); toast('Этап: ' + Lumo.stageRu(t.value), 'ok'); render(); }
      catch (e) { toast(String(e && e.message || e), 'err'); render(); }
    }
  });
  /* ввод в фильтр компаний не должен терять фокус — обрабатываем input точечно */
  document.addEventListener('input', function (ev) {
    if (ev.target && ev.target.id === 's3-cq') { /* значение считывается на change; здесь — только мягкая синхронизация состояния */ state.companyFilter.q = ev.target.value.trim(); }
  });
  window.addEventListener('hashchange', function () {
    if (syncRoute()) render();
  });

  function readBackupFile(act) {
    var inp = el('s3-bfile');
    var file = inp && inp.files && inp.files[0];
    var out = el('s3-bk-out');
    if (!file) { if (out) out.innerHTML = '<span class="badge review">Выберите файл .json</span>'; return; }
    var rd = new FileReader();
    rd.onload = function () {
      var text = String(rd.result || '');
      try {
        if (act === 'bk-validate' || act === 'bk-import') {
          var obj = JSON.parse(text);
          var v = Lumo.validateBackup(obj);
          var info = '<div>проверка: <b>' + (v.ok ? 'OK' : 'ОТКАЗ') + '</b> · компании: ' + ((v.counts && v.counts.leads) != null ? v.counts.leads : '?') +
            ' · ошибки: ' + ((v.errors || []).length) + ' · предупреждения: ' + ((v.warnings || []).length) + '</div>' +
            ((v.errors || []).length ? '<div class="small">' + v.errors.slice(0, 5).map(esc).join('<br>') + '</div>' : '');
          if (act === 'bk-validate') { if (out) out.innerHTML = info; return; }
          if (!v.ok) { if (out) out.innerHTML = info + '<span class="badge danger">импорт отклонён валидатором движка</span>'; return; }
          confirm('Импорт резервной копии', 'Тестовая база Lumo 4.0 будет <b>заменена</b> данными копии (' + ((v.counts && v.counts.leads) != null ? v.counts.leads : '?') + ' компаний). Рабочая база v3.5.3 не затрагивается. История, задачи и ручные подтверждения переносятся как есть.', function () {
            var r = Lumo.importBackup(obj, true);
            toast(r && r.ok === false ? 'Импорт отклонён: ' + (r.error || '') : 'Импорт выполнен', r && r.ok === false ? 'err' : 'ok');
            if (out) out.innerHTML = info;
            go('companies');
          }, 'Импортировать');
        } else if (act === 'bk-merge') {
          var arr = Lumo.parseLeadsText(text);
          if (!arr || !arr.length) { if (out) out.innerHTML = '<span class="badge danger">В файле нет массива лидов v3.5.x</span>'; return; }
          var pv = Lumo.mergePreview(arr);
          confirm('Долить без дублей', 'Найдено записей: ' + arr.length + ' · новых: ' + (pv.add != null ? pv.add : '?') + ' · дублей пропущено: ' + (pv.skip != null ? pv.skip : '?') + '. ID существующих сохраняются, защищённые поля не перезаписываются.', function () {
            Lumo.mergeImport(arr, true);
            toast('Merge выполнен', 'ok');
            go('companies');
          }, 'Долить');
        }
      } catch (e) {
        if (out) out.innerHTML = '<span class="badge danger">Ошибка: ' + esc(String(e && e.message || e)) + '</span>';
      }
    };
    rd.readAsText(file);
  }

  /* ---------------- инициализация ---------------- */
  function init() {
    if (!Lumo.ready()) {
      el('s3-main').innerHTML = '<div class="notice warn">' + icon('alert') + '<div><strong>Движок v3.5.3 не инициализирован — сборка повреждена.</strong></div></div>';
      return;
    }
    if (!syncRoute()) { try { location.hash = hashOf(state.view); } catch (e) { } }
    render();
    refreshHealth();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { toast: toast, confirm: confirm, go: go, state: state, render: render, closeDialog: closeDialog };
})();
