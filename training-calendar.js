/*
 * National Youth First Aid Programme — Interactive National Training Calendar
 * v1.0 | 15 November 2026
 * Uses the existing read-only dashboard feed (Master Schedule sessions).
 * Standalone visual add-on: no changes to Sheets, Apps Script, map, gallery or bridge.js.
 * IMPORTANT: Include as a normal <script> immediately BEFORE the existing
 * <div class="overlay" id="overlay"> in index.html, so the main navigation
 * initialization can register the new tab automatically.
 */
(function (window, document) {
  'use strict';
  if (window.__NYFA_TRAINING_CALENDAR__) return;

  var main = document.querySelector('main.content');
  var sidebarReference = document.querySelector('#sidebar .navbtn[data-section="resources"]');
  var mobileReference = document.querySelector('.mobile-tabbar .mobile-tab[data-section="resources"]');
  if (!main || !sidebarReference || !mobileReference) {
    console.warn('NYFA Calendar: expected website navigation was not found.');
    return;
  }
  window.__NYFA_TRAINING_CALENDAR__ = true;

  function el(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character];
    });
  }
  function compact(text, max) {
    text = String(text == null ? '' : text).trim();
    return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
  }
  function asDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return null;
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (y < 2000 || y > 2100) return null;
    var out = new Date(y, mo - 1, d);
    return out.getFullYear() === y && out.getMonth() === mo - 1 && out.getDate() === d ? out : null;
  }
  function isoDate(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function todayInSriLanka() {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date());
      var p = {};
      parts.forEach(function (piece) { p[piece.type] = piece.value; });
      var date = p.year + '-' + p.month + '-' + p.day;
      if (asDate(date)) return date;
    } catch (ignore) { /* Fall back to browser local time. */ }
    return isoDate(new Date());
  }
  function prettyDate(value) {
    var date = asDate(value);
    return date ? date.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'}) : 'Date not confirmed';
  }
  function monthTitle(date) {
    return date.toLocaleDateString('en-GB', {month: 'long', year: 'numeric'});
  }
  function numeral(n) { return Number(n || 0).toLocaleString('en-LK'); }
  function validCoords(s) {
    return typeof s.lat === 'number' && typeof s.lng === 'number' &&
      Number.isFinite(s.lat) && Number.isFinite(s.lng) &&
      s.lat >= 5.7 && s.lat <= 10.1 && s.lng >= 79.4 && s.lng <= 82.2;
  }
  function mapsLink(s) {
    var query = validCoords(s) ? s.lat + ',' + s.lng :
      (s.address || [s.venue, s.ds, s.district, 'Sri Lanka'].filter(Boolean).join(', '));
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
  }
  function status(s, today) {
    var v = String(s.status || '').toLowerCase().trim();
    if (s.completedInRegister) return 'completed';
    if (v.indexOf('cancel') !== -1) return 'cancelled';
    if (v.indexOf('postpon') !== -1) return 'postponed';
    if (v.indexOf('complete') !== -1) return 'unreported';
    if (!asDate(s.date)) return 'undated';
    if (s.date < today) return 'overdue';
    return 'upcoming';
  }
  var STATUS = {
    completed: 'Completed · reported',
    upcoming: 'Upcoming / scheduled',
    overdue: 'Past date · unconfirmed',
    unreported: 'Marked complete · report pending',
    postponed: 'Postponed',
    cancelled: 'Cancelled',
    undated: 'Date not confirmed'
  };
  var data = null;
  var lastLoadedAt = 0;
  var loading = false;
  var queuedReload = false;
  var today = todayInSriLanka();
  var month = asDate(today);
  month = new Date(month.getFullYear(), month.getMonth(), 1);
  var selectedDate = '';
  var view = window.matchMedia && window.matchMedia('(max-width: 720px)').matches ? 'agenda' : 'month';
  var filtered = [];
  var dialogReturnFocus = null;

  // Add tab elements BEFORE the existing website's main inline script runs.
  var desktopTab = document.createElement('button');
  desktopTab.type = 'button';
  desktopTab.className = 'navbtn';
  desktopTab.dataset.section = 'calendar';
  desktopTab.innerHTML = '<span class="navicon" aria-hidden="true">▣</span> Training calendar';
  sidebarReference.insertAdjacentElement('beforebegin', desktopTab);

  var mobileTab = document.createElement('button');
  mobileTab.type = 'button';
  mobileTab.className = 'mobile-tab';
  mobileTab.dataset.section = 'calendar';
  mobileTab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h10M7 18h6"/></svg><span>Calendar</span>';
  mobileReference.insertAdjacentElement('beforebegin', mobileTab);

  var section = document.createElement('section');
  section.className = 'section';
  section.id = 'sec-calendar';
  section.setAttribute('aria-labelledby', 'nyfa-cal-heading');
  section.innerHTML =
    '<div class="nyfa-cal-hero">' +
      '<div><div class="nyfa-cal-overline">NATIONAL IMPLEMENTATION · TRAINING SCHEDULE</div>' +
        '<h1 id="nyfa-cal-heading">National Training Calendar</h1>' +
        '<p>Explore scheduled first aid programmes by month, district and Community-Based Organisation. Select any programme for its venue and map location.</p>' +
      '</div><div class="nyfa-cal-hero-art" aria-hidden="true">▦</div>' +
    '</div>' +
    '<div class="nyfa-cal-filters" role="group" aria-label="Training calendar filters">' +
      '<label>District / reporting area<select id="nyfa-cal-district"><option value="">All reporting areas</option></select></label>' +
      '<label>Community-Based Organisation<select id="nyfa-cal-cbo"><option value="">All CBOs</option></select></label>' +
      '<label>Programme status<select id="nyfa-cal-status">' +
        '<option value="">All statuses</option>' +
        '<option value="upcoming">Upcoming / scheduled</option>' +
        '<option value="completed">Completed · reported</option>' +
        '<option value="overdue">Past date · unconfirmed</option>' +
        '<option value="unreported">Completion report pending</option>' +
        '<option value="postponed">Postponed</option>' +
        '<option value="cancelled">Cancelled</option>' +
      '</select></label>' +
      '<label>Specific date<input type="date" id="nyfa-cal-date" aria-label="Filter training programmes by specific date"></label>' +
      '<label class="nyfa-cal-search-label">Search venue / DS / Session ID<input type="search" id="nyfa-cal-search" placeholder="Search programmes…" autocomplete="off"></label>' +
      '<div class="nyfa-cal-filter-actions"><button type="button" id="nyfa-cal-reset">Clear filters</button><button type="button" id="nyfa-cal-csv">↓ Export CSV</button></div>' +
    '</div>' +
    '<div class="nyfa-cal-toolbar">' +
      '<div class="nyfa-cal-toolbar-left"><span class="nyfa-cal-eyebrow">MONTHLY SCHEDULE</span><h2 id="nyfa-cal-month"></h2></div>' +
      '<div class="nyfa-cal-toolbar-right">' +
        '<button type="button" class="nyfa-cal-nav" id="nyfa-cal-prev" aria-label="Previous month">‹</button>' +
        '<button type="button" class="nyfa-cal-today" id="nyfa-cal-today">This month</button>' +
        '<button type="button" class="nyfa-cal-nav" id="nyfa-cal-next" aria-label="Next month">›</button>' +
        '<div class="nyfa-cal-view-switch" role="group" aria-label="Calendar view">' +
          '<button type="button" id="nyfa-cal-month-button">Month</button>' +
          '<button type="button" id="nyfa-cal-agenda-button">Agenda</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="nyfa-cal-summary" id="nyfa-cal-summary" aria-label="Filtered month summary">' +
      '<div><span>Programmes</span><strong id="nyfa-cal-total">—</strong></div>' +
      '<div><span>Upcoming</span><strong id="nyfa-cal-upcoming">—</strong></div>' +
      '<div><span>Completed</span><strong id="nyfa-cal-completed">—</strong></div>' +
      '<div><span>Past · unconfirmed</span><strong id="nyfa-cal-overdue">—</strong></div>' +
    '</div>' +
    '<div class="nyfa-cal-source" id="nyfa-cal-source" role="status" aria-live="polite">Open the calendar to load the national schedule.</div>' +
    '<div class="nyfa-cal-results" id="nyfa-cal-results" aria-live="polite">' +
      '<div class="nyfa-cal-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>' +
    '</div>' +
    '<p class="nyfa-cal-method"><strong>Reporting note:</strong> Dates and venues come from the published Master Schedule. A past scheduled date does <strong>not</strong> confirm that training occurred. A programme is labelled completed only when the published completion records support it. Undated programmes cannot be placed on a calendar. No private contact information is displayed.</p>';
  var resourcesSection = el('sec-resources');
  if (resourcesSection) resourcesSection.insertAdjacentElement('beforebegin', section);
  else main.appendChild(section);

  var dialog = document.createElement('dialog');
  dialog.id = 'nyfa-cal-dialog';
  dialog.setAttribute('aria-label', 'Training programme details');
  dialog.innerHTML = '<div class="nyfa-cal-dialog-head"><div><span>PROGRAMME INFORMATION</span><h2 id="nyfa-cal-modal-title">Training details</h2></div>' +
    '<button type="button" id="nyfa-cal-modal-close" aria-label="Close programme details">×</button></div>' +
    '<div id="nyfa-cal-modal-status"></div><dl id="nyfa-cal-modal-details"></dl>' +
    '<div class="nyfa-cal-modal-actions"><a id="nyfa-cal-modal-maps" href="#" target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a>' +
    '<button type="button" id="nyfa-cal-modal-site-map">View on NYFA location map</button></div>';
  document.body.appendChild(dialog);

  var css = document.createElement('style');
  css.id = 'nyfa-training-calendar-css';
  css.textContent = `
    @media(max-width:820px){.mobile-tabbar{grid-template-columns:repeat(6,minmax(0,1fr))!important}.mobile-tab{font-size:8.6px!important;letter-spacing:-.1px}.mobile-tab svg{width:20px;height:20px}}
    @media(max-width:360px){.mobile-tab{font-size:8px!important;padding:7px 0!important}.mobile-tabbar{left:4px;right:4px;padding:4px!important}}
    #sec-calendar{--cal-navy:#142e43;--cal-teal:#078f84;--cal-border:#e2ebf0;--cal-ink:#223d51;--cal-muted:#6b8294;color:var(--cal-ink)}
    #sec-calendar button,#nyfa-cal-dialog button{cursor:pointer}
    #sec-calendar :focus-visible,#nyfa-cal-dialog :focus-visible{outline:3px solid #41b6aa;outline-offset:2px}
    #sec-calendar .nyfa-cal-hero{display:flex;justify-content:space-between;align-items:center;gap:16px;background:radial-gradient(circle at 78% 5%,rgba(28,202,180,.28),transparent 41%),linear-gradient(114deg,#102a42,#125568);padding:28px 32px;border-radius:21px;color:#fff;box-shadow:0 16px 34px rgba(14,43,64,.13);margin-bottom:20px;overflow:hidden}
    #sec-calendar .nyfa-cal-overline{font:800 10px Manrope,sans-serif;letter-spacing:1.8px;color:#95ece0}
    #sec-calendar .nyfa-cal-hero h1{font:800 clamp(23px,3vw,34px)/1.18 Manrope,sans-serif;letter-spacing:-.8px;margin:10px 0}
    #sec-calendar .nyfa-cal-hero p{font:12px/1.65 'DM Sans',sans-serif;max-width:690px;color:#d0e7e8;margin:0}
    #sec-calendar .nyfa-cal-hero-art{font:800 110px/1 Manrope,sans-serif;opacity:.20;transform:rotate(-13deg);flex:none}
    #sec-calendar .nyfa-cal-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;padding:20px 20px 17px;background:#fff;border:1px solid var(--cal-border);border-radius:17px;margin-bottom:20px;box-shadow:0 7px 23px #13384b08}
    #sec-calendar .nyfa-cal-filters label{display:flex;flex-direction:column;gap:7px;font:800 11px/1.35 Manrope,sans-serif;color:#4d667a;min-width:0}
    #sec-calendar .nyfa-cal-filters select,#sec-calendar .nyfa-cal-filters input{width:100%;min-width:0;min-height:43px;padding:10px 12px;background:#fbfdfe;border:1px solid #d8e4eb;border-radius:10px;color:#203c4f;outline:none;font:500 13px 'DM Sans',sans-serif}
    #sec-calendar .nyfa-cal-filters input:focus,#sec-calendar .nyfa-cal-filters select:focus{border-color:#49b9ae;box-shadow:0 0 0 3px rgba(47,179,167,.11)}
    #sec-calendar .nyfa-cal-search-label{grid-column:span 2}
    #sec-calendar .nyfa-cal-filter-actions{display:flex;align-items:flex-end;gap:8px;grid-column:span 2}
    #sec-calendar .nyfa-cal-filter-actions button{min-height:43px;border:1px solid #cee4e0;background:#edf8f5;color:#137970;border-radius:10px;font:800 11px Manrope,sans-serif;padding:0 14px;white-space:nowrap}
    #sec-calendar .nyfa-cal-filter-actions button:hover{background:#daf2ec}
    #sec-calendar .nyfa-cal-toolbar{display:flex;align-items:end;justify-content:space-between;gap:13px;flex-wrap:wrap;margin:0 0 14px}
    #sec-calendar .nyfa-cal-toolbar-left{min-width:0}
    #sec-calendar .nyfa-cal-eyebrow{font:800 10px Manrope,sans-serif;letter-spacing:1.5px;color:#168b81}
    #sec-calendar .nyfa-cal-toolbar h2{font:800 clamp(21px,2.4vw,27px) Manrope,sans-serif;letter-spacing:-.6px;margin:5px 0 0}
    #sec-calendar .nyfa-cal-toolbar-right{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
    #sec-calendar .nyfa-cal-nav,#sec-calendar .nyfa-cal-today,#sec-calendar .nyfa-cal-view-switch button{border:1px solid #d8e5eb;background:#fff;color:#33536a;border-radius:9px;min-height:39px;padding:7px 12px;font:800 12px Manrope,sans-serif}
    #sec-calendar .nyfa-cal-nav{min-width:39px;font-size:23px;padding:1px 8px}
    #sec-calendar .nyfa-cal-view-switch{display:flex;gap:3px;background:#f1f6f7;padding:3px;border-radius:11px}
    #sec-calendar .nyfa-cal-view-switch button{border-color:transparent;min-height:34px;background:transparent}
    #sec-calendar .nyfa-cal-view-switch button[aria-pressed="true"]{background:#fff;color:#0c887e;box-shadow:0 2px 7px #122a3a10}
    #sec-calendar .nyfa-cal-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-bottom:13px}
    #sec-calendar .nyfa-cal-summary>div{background:#fff;border:1px solid var(--cal-border);border-radius:13px;padding:14px 16px;display:flex;flex-direction:column;gap:5px}
    #sec-calendar .nyfa-cal-summary span{font:700 11px/1.35 Manrope,sans-serif;color:#7a8d9b}
    #sec-calendar .nyfa-cal-summary strong{font:800 25px/1.1 Manrope,sans-serif;color:#1c4457;letter-spacing:-.7px;font-variant-numeric:tabular-nums}
    #sec-calendar .nyfa-cal-summary>div:first-child strong{color:#058a7f}
    #sec-calendar .nyfa-cal-source{font:11px/1.6 'DM Sans',sans-serif;color:#617e8f;margin:0 0 14px;padding:8px 12px;background:#edf7f6;border-left:3px solid #28a79c;border-radius:5px}
    #sec-calendar .nyfa-cal-source.is-error{background:#fff6ed;border-color:#de9c57;color:#9b6436}
    #sec-calendar .nyfa-cal-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;margin-bottom:7px}
    #sec-calendar .nyfa-cal-week>span{text-align:center;padding:8px 0;color:#71879a;font:800 10px Manrope,sans-serif;letter-spacing:.5px}
    #sec-calendar .nyfa-cal-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px}
    #sec-calendar .nyfa-cal-day{min-width:0;min-height:148px;display:flex;flex-direction:column;background:#fff;border:1px solid var(--cal-border);border-radius:12px;padding:9px;gap:5px}
    #sec-calendar .nyfa-cal-day.is-outside{background:#f4f8fa;opacity:.58}
    #sec-calendar .nyfa-cal-day.is-today{border-color:#24ae9c;box-shadow:inset 0 0 0 1px #24ae9c}
    #sec-calendar .nyfa-cal-day.is-selected{border-color:#147a76;background:#f2fbf9;box-shadow:inset 0 0 0 1px #147a76}
    #sec-calendar .nyfa-cal-date-number{align-self:flex-start;display:flex;align-items:center;justify-content:center;min-width:26px;height:26px;border:0;border-radius:8px;background:transparent;color:#61778a;font:800 12px Manrope,sans-serif;padding:0 4px}
    #sec-calendar .nyfa-cal-day.is-today .nyfa-cal-date-number{background:#0b9589;color:white}
    #sec-calendar .nyfa-cal-events{display:flex;flex-direction:column;gap:4px;min-width:0}
    #sec-calendar .nyfa-cal-event{display:block;width:100%;min-width:0;text-align:left;border:1px solid #e3eef0;border-left:3px solid var(--cal-state,#94aaba);border-radius:6px;padding:6px 5px;background:#f7fbfb;color:#27465a;font:700 10px/1.4 'DM Sans',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #sec-calendar .nyfa-cal-event:hover{background:#e9f7f4;border-color:#a6dcd4;border-left-color:var(--cal-state)}
    #sec-calendar .nyfa-cal-event small{display:block;color:#7a8d99;font-size:9px;font-weight:500;overflow:hidden;text-overflow:ellipsis}
    #sec-calendar .nyfa-cal-more{width:100%;border:0;background:transparent;color:#0b8479;text-align:left;padding:4px 0;font:800 10px Manrope,sans-serif}
    #sec-calendar .nyfa-cal-empty{padding:42px 20px;background:#fff;border:1px dashed #c8d9e2;border-radius:13px;text-align:center;color:#668298;font:13px/1.7 'DM Sans',sans-serif}
    #sec-calendar .nyfa-cal-agenda-list{display:grid;gap:14px}
    #sec-calendar .nyfa-cal-agenda-day{background:#fff;border:1px solid var(--cal-border);border-radius:13px;overflow:hidden}
    #sec-calendar .nyfa-cal-agenda-head{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:12px 17px;background:#f5faf9;border-bottom:1px solid #e3eeec;color:#284f63;font:800 12px Manrope,sans-serif}
    #sec-calendar .nyfa-cal-agenda-head span{font:700 10px Manrope,sans-serif;color:#8396a1}
    #sec-calendar .nyfa-cal-agenda-entry{display:flex;align-items:center;gap:11px;width:100%;text-align:left;border:0;border-bottom:1px solid #eff3f5;background:#fff;padding:13px 17px;color:#2b485b}
    #sec-calendar .nyfa-cal-agenda-entry:last-child{border-bottom:0}
    #sec-calendar .nyfa-cal-agenda-entry:hover{background:#f6fbfa}
    #sec-calendar .nyfa-cal-agenda-line{flex:none;align-self:stretch;width:4px;border-radius:5px;background:var(--cal-state,#94aaba)}
    #sec-calendar .nyfa-cal-agenda-body{flex:1;min-width:0}
    #sec-calendar .nyfa-cal-agenda-body strong{display:block;font:800 12px/1.4 Manrope,sans-serif;color:#2a4659}
    #sec-calendar .nyfa-cal-agenda-body small{display:block;font:11px/1.55 'DM Sans',sans-serif;color:#7a8d9d;margin-top:4px}
    #sec-calendar .nyfa-cal-badge{display:inline-block;flex:none;border-radius:20px;padding:5px 9px;background:color-mix(in srgb,var(--cal-state,#94aaba) 12%,white);color:var(--cal-state,#647889);font:800 10px/1.25 Manrope,sans-serif;max-width:190px}
    #sec-calendar .nyfa-cal-method{margin:18px 0;color:#7d90a1;font:11px/1.75 'DM Sans',sans-serif}
    #sec-calendar .nyfa-cal-skeleton{display:grid;gap:11px}
    #sec-calendar .nyfa-cal-skeleton i{display:block;height:88px;border-radius:13px;background:linear-gradient(90deg,#edf3f6,#f7fafc,#edf3f6);background-size:250% 100%;animation:nyfa-cal-shimmer 1.7s linear infinite}
    @keyframes nyfa-cal-shimmer{to{background-position:-250% 0}}
    #nyfa-cal-dialog{border:0;border-radius:20px;box-shadow:0 30px 90px #051f3b60;width:min(550px,calc(100vw - 22px));max-height:calc(100dvh - 35px);padding:24px 25px;overflow-y:auto;color:#203c50;font-family:'DM Sans',sans-serif}
    #nyfa-cal-dialog::backdrop{background:rgba(5,24,41,.64);backdrop-filter:blur(3px)}
    #nyfa-cal-dialog .nyfa-cal-dialog-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #e4ecf0;padding-bottom:15px}
    #nyfa-cal-dialog .nyfa-cal-dialog-head span{font:800 10px Manrope,sans-serif;letter-spacing:1px;color:#168d83}
    #nyfa-cal-dialog .nyfa-cal-dialog-head h2{font:800 20px/1.3 Manrope,sans-serif;margin:6px 0 0;color:#193a50;overflow-wrap:anywhere}
    #nyfa-cal-modal-close{flex:none;border:0;border-radius:9px;background:#edf3f5;font-size:25px;width:36px;height:36px;color:#476273}
    #nyfa-cal-dialog #nyfa-cal-modal-status{margin:16px 0}
    #nyfa-cal-dialog dl{display:grid;grid-template-columns:150px minmax(0,1fr);gap:13px 8px;margin:17px 0;font-size:12px;line-height:1.5}
    #nyfa-cal-dialog dt{font-weight:600;color:#788c9b}
    #nyfa-cal-dialog dd{margin:0;color:#29465b;font-weight:700;overflow-wrap:anywhere}
    #nyfa-cal-dialog .nyfa-cal-modal-actions{display:flex;gap:9px;flex-wrap:wrap;border-top:1px solid #e5edef;padding-top:16px}
    #nyfa-cal-dialog .nyfa-cal-modal-actions>a,#nyfa-cal-dialog .nyfa-cal-modal-actions>button{display:inline-flex;justify-content:center;align-items:center;min-height:42px;border:1px solid #c7e5df;border-radius:10px;padding:10px 14px;text-decoration:none;font:800 11px Manrope,sans-serif;background:#eaf8f5;color:#08796f}
    #nyfa-cal-dialog .nyfa-cal-modal-actions>a{background:#088d81;color:white;border-color:#088d81}
    @media(max-width:1130px){#sec-calendar .nyfa-cal-filters{grid-template-columns:repeat(2,minmax(0,1fr))}#sec-calendar .nyfa-cal-hero-art{font-size:85px}}
    @media(max-width:760px){#sec-calendar .nyfa-cal-hero{padding:23px 21px}#sec-calendar .nyfa-cal-hero-art{display:none}#sec-calendar .nyfa-cal-summary{grid-template-columns:repeat(2,minmax(0,1fr))}#sec-calendar .nyfa-cal-toolbar{align-items:flex-start}#sec-calendar .nyfa-cal-week{display:none}#sec-calendar .nyfa-cal-days{min-width:710px}#sec-calendar .nyfa-cal-month-scroll{overflow-x:auto;padding-bottom:8px}}
    @media(max-width:530px){#sec-calendar .nyfa-cal-filters{grid-template-columns:1fr;padding:15px}#sec-calendar .nyfa-cal-search-label,#sec-calendar .nyfa-cal-filter-actions{grid-column:span 1}#sec-calendar .nyfa-cal-filter-actions{flex-wrap:wrap}#sec-calendar .nyfa-cal-toolbar-right{width:100%;justify-content:space-between}#sec-calendar .nyfa-cal-summary>div{padding:12px}#sec-calendar .nyfa-cal-summary strong{font-size:22px}#sec-calendar .nyfa-cal-agenda-entry{padding:12px}#sec-calendar .nyfa-cal-badge{font-size:9px;max-width:120px;text-align:center}#nyfa-cal-dialog{padding:18px 16px}#nyfa-cal-dialog dl{grid-template-columns:100px minmax(0,1fr)}}
    @media(prefers-reduced-motion:reduce){#sec-calendar .nyfa-cal-skeleton i{animation:none}#sec-calendar *,#nyfa-cal-dialog *{scroll-behavior:auto!important;transition:none!important}}
    @media print{#sec-calendar .nyfa-cal-hero,#sec-calendar .nyfa-cal-filters,#sec-calendar .nyfa-cal-toolbar-right,#nyfa-cal-dialog{display:none!important}}
  `;
  document.head.appendChild(css);

  var COLORS = {
    completed:'#14936d', upcoming:'#118db3', overdue:'#df9a35',
    unreported:'#dc7c43', postponed:'#8f70ca', cancelled:'#788798', undated:'#6b859b'
  };
  function viewIsOpen() { return section.classList.contains('active'); }
  function sourceLine(message, isError) {
    el('nyfa-cal-source').textContent = message;
    el('nyfa-cal-source').classList.toggle('is-error', Boolean(isError));
  }
  function setOptions(element, choices, label) {
    var keep = element.value;
    element.innerHTML = '<option value="">' + esc(label) + '</option>' + choices.map(function (name) {
      return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
    }).join('');
    element.value = choices.indexOf(keep) >= 0 ? keep : '';
  }
  function populateFilters() {
    if (!data || !Array.isArray(data.sessions)) return;
    var districts = Array.from(new Set(data.sessions.map(function (s) { return String(s.district || '').trim(); }).filter(Boolean))).sort();
    setOptions(el('nyfa-cal-district'), districts, 'All reporting areas');
    populateCbos();
  }
  function populateCbos() {
    if (!data) return;
    var district = el('nyfa-cal-district').value;
    var cboNames = Array.from(new Set(data.sessions.filter(function (s) {
      return !district || s.district === district;
    }).map(function (s) { return String(s.cbo || '').trim(); }).filter(Boolean))).sort();
    setOptions(el('nyfa-cal-cbo'), cboNames, 'All CBOs');
  }
  function matchingSessions() {
    if (!data) return [];
    var district = el('nyfa-cal-district').value;
    var cbo = el('nyfa-cal-cbo').value;
    var stage = el('nyfa-cal-status').value;
    var search = el('nyfa-cal-search').value.trim().toLowerCase();
    var prefix = isoDate(month).slice(0, 7);
    return data.sessions.map(function (s, index) { return {s:s, index:index}; }).filter(function (item) {
      var s = item.s;
      if (!asDate(s.date) || s.date.slice(0, 7) !== prefix) return false;
      if (district && s.district !== district) return false;
      if (cbo && String(s.cbo || '').trim() !== cbo) return false;
      if (stage && status(s, today) !== stage) return false;
      if (selectedDate && s.date !== selectedDate) return false;
      if (search && [s.id,s.venue,s.ds,s.district,s.cbo].join(' ').toLowerCase().indexOf(search) < 0) return false;
      return true;
    }).sort(function (a,b) {
      return a.s.date.localeCompare(b.s.date) || String(a.s.start||'').localeCompare(String(b.s.start||'')) || String(a.s.venue||'').localeCompare(String(b.s.venue||''));
    });
  }
  function countSummary(items) {
    var counts = {upcoming:0, completed:0, overdue:0};
    items.forEach(function (item) { var key=status(item.s,today); if (counts[key] !== undefined) counts[key]++; });
    el('nyfa-cal-total').textContent = numeral(items.length);
    el('nyfa-cal-upcoming').textContent = numeral(counts.upcoming);
    el('nyfa-cal-completed').textContent = numeral(counts.completed);
    el('nyfa-cal-overdue').textContent = numeral(counts.overdue);
  }
  function colourFor(s) { return COLORS[status(s, today)] || COLORS.undated; }
  function miniEvent(item) {
    var s = item.s;
    var text = (s.start ? s.start + ' · ' : '') + (s.venue || 'Venue TBC');
    var hint = s.district || 'District TBC';
    return '<button type="button" class="nyfa-cal-event" style="--cal-state:' + colourFor(s) + '" data-cal-index="' + item.index + '" title="' + esc(text + ' — ' + hint) + '">' +
      esc(compact(text, 55)) + '<small>' + esc(compact(hint, 38)) + '</small></button>';
  }
  function monthGrid(items) {
    var year = month.getFullYear(), monthIndex = month.getMonth();
    var first = new Date(year, monthIndex, 1);
    var offset = (first.getDay() + 6) % 7;
    var start = new Date(year, monthIndex, 1 - offset);
    var daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    var total = Math.ceil((offset + daysInMonth)/7)*7;
    var byDate = new Map();
    items.forEach(function (item) {
      if (!byDate.has(item.s.date)) byDate.set(item.s.date, []);
      byDate.get(item.s.date).push(item);
    });
    var heads = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function (day) {return '<span>' + day + '</span>';}).join('');
    var html = '<div class="nyfa-cal-week" aria-hidden="true">' + heads + '</div><div class="nyfa-cal-month-scroll"><div class="nyfa-cal-days">';
    for (var i=0;i<total;i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var iso=isoDate(d);
      var inMonth = d.getMonth() === monthIndex;
      var events = inMonth ? (byDate.get(iso) || []) : [];
      var classes = 'nyfa-cal-day' + (inMonth ? '' : ' is-outside') + (iso === today ? ' is-today' : '') + (iso === selectedDate ? ' is-selected' : '');
      html += '<div class="' + classes + '"><button type="button" class="nyfa-cal-date-number" data-cal-day="' + iso + '" title="Show programmes for ' + esc(prettyDate(iso)) + '">' + d.getDate() + '</button><div class="nyfa-cal-events">';
      events.slice(0, 3).forEach(function (event) { html += miniEvent(event); });
      if (events.length > 3) html += '<button type="button" class="nyfa-cal-more" data-cal-day="' + iso + '">+' + (events.length - 3) + ' more programmes</button>';
      html += '</div></div>';
    }
    return html + '</div></div>';
  }
  function agenda(items) {
    if (!items.length) return '<div class="nyfa-cal-empty">No programmes match these filters for ' + esc(monthTitle(month)) + '. Try another month, CBO or date.</div>';
    var grouped = new Map();
    items.forEach(function (item) {
      var k = item.s.date;
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(item);
    });
    var html = '<div class="nyfa-cal-agenda-list">';
    grouped.forEach(function (list, date) {
      html += '<div class="nyfa-cal-agenda-day"><div class="nyfa-cal-agenda-head"><strong>' + esc(prettyDate(date)) + '</strong><span>' + numeral(list.length) + ' programme' + (list.length===1?'':'s') + '</span></div>';
      list.forEach(function (item) {
        var s=item.s, stage=status(s,today);
        html += '<button type="button" class="nyfa-cal-agenda-entry" data-cal-index="' + item.index + '" style="--cal-state:' + colourFor(s) + '">' +
          '<span class="nyfa-cal-agenda-line" aria-hidden="true"></span>' +
          '<span class="nyfa-cal-agenda-body"><strong>' + esc(s.venue || 'Venue to be confirmed') + '</strong><small>' + esc([s.start||'',s.district||'',s.ds||'',s.cbo||''].filter(Boolean).join(' · ')) + '</small></span>' +
          '<span class="nyfa-cal-badge">' + esc(STATUS[stage]) + '</span></button>';
      });
      html += '</div>';
    });
    return html + '</div>';
  }
  function render() {
    today=todayInSriLanka();
    el('nyfa-cal-month').textContent = monthTitle(month);
    el('nyfa-cal-date').value = selectedDate;
    el('nyfa-cal-month-button').setAttribute('aria-pressed', String(view === 'month'));
    el('nyfa-cal-agenda-button').setAttribute('aria-pressed', String(view === 'agenda'));
    if (!data) return;
    filtered=matchingSessions();
    countSummary(filtered);
    var result = el('nyfa-cal-results');
    if (view === 'month') {
      result.innerHTML = monthGrid(filtered) + (filtered.length ? '' : '<p class="nyfa-cal-method">No programmes match the selected filters for this month.</p>');
    } else result.innerHTML = agenda(filtered);
  }
  function fetchSchedule() {
    if (loading) { queuedReload=true; return; }
    if (!(window.google && window.google.script && window.google.script.run)) {
      sourceLine('The public dashboard connection is unavailable. Please reload the page.', true); return;
    }
    loading=true;
    if (!data) {
      sourceLine('Loading the published national schedule…');
      el('nyfa-cal-results').innerHTML = '<div class="nyfa-cal-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>';
    }
    function finish() {
      loading=false;
      if (queuedReload) { queuedReload=false; fetchSchedule(); }
    }
    window.google.script.run.withSuccessHandler(function (result) {
      if (!result || !Array.isArray(result.sessions) || !result.dashboard) {
        sourceLine('The calendar received an invalid programme schedule. Existing data, if available, is retained.', true);
        finish();return;
      }
      var reliability = result.reliability && result.reliability.mode || '';
      if (reliability === 'summary' || reliability === 'unavailable') {
        sourceLine('The schedule is temporarily unavailable. Only a historical summary was received.', true);
        if (!data) el('nyfa-cal-results').innerHTML='<div class="nyfa-cal-empty">Calendar dates cannot be verified right now. Please try again later.</div>';
        finish();return;
      }
      data=result;
      lastLoadedAt=Date.now();
      populateFilters();
      var snapshotLabel = reliability === 'recent' ? 'Recent published snapshot' : reliability === 'live' ? 'Published programme data' : 'Available programme records';
      var undated = result.sessions.filter(function (s) { return !asDate(s.date); }).length;
      var suffix = undated ? ' · ' + numeral(undated) + ' undated programme(s) are not shown in the calendar' : '';
      sourceLine(snapshotLabel + ' · Master Schedule and published completion flags' + (result.fetchedAt ? ' · ' + result.fetchedAt : '') + suffix);
      render();finish();
    }).withFailureHandler(function () {
      sourceLine('Unable to refresh the published schedule. ' + (data ? 'Previously loaded information remains visible.' : 'Please try again.'), true);
      if (!data) el('nyfa-cal-results').innerHTML='<div class="nyfa-cal-empty">Schedule temporarily unavailable. Reopen the calendar or refresh the website to retry.</div>';
      finish();
    }).getDashboardData(false);
  }
  function openCalendar() {
    window.setTimeout(function () {
      if (!viewIsOpen()) return;
      render();
      // Same browser snapshot is returned almost instantly on repeat visits.
      if (!loading && (!data || Date.now()-lastLoadedAt > 12000)) fetchSchedule();
    }, 0);
  }
  function selectDay(value) {
    var date = asDate(value);
    if (!date) return;
    month=new Date(date.getFullYear(),date.getMonth(),1);
    selectedDate=value;
    view='agenda';
    render();
  }
  function openDetails(index) {
    if (!data || !data.sessions[index]) return;
    var s=data.sessions[index], stage=status(s,today);
    dialogReturnFocus=document.activeElement;
    el('nyfa-cal-modal-title').textContent = s.venue || 'Venue to be confirmed';
    el('nyfa-cal-modal-status').innerHTML = '<span class="nyfa-cal-badge" style="--cal-state:' + colourFor(s) + '">' + esc(STATUS[stage]) + '</span>';
    var fields = [
      ['Session ID',s.id || '—'], ['Training date',prettyDate(s.date)],
      ['Time',[s.start,s.end].filter(Boolean).join(' – ') || 'Not recorded'],
      ['District / area',s.district || 'Not recorded'],
      ['DS division',s.ds || 'Not recorded'],
      ['CBO',s.cbo || 'Not recorded'],
      ['Expected participants',s.expected === undefined || s.expected === null ? 'Not recorded' : numeral(s.expected)]
    ];
    el('nyfa-cal-modal-details').innerHTML = fields.map(function (item) {
      return '<dt>' + esc(item[0]) + '</dt><dd>' + esc(item[1]) + '</dd>';
    }).join('');
    var maps = el('nyfa-cal-modal-maps');
    maps.href=mapsLink(s);
    maps.textContent=validCoords(s) ? 'Navigate to verified map pin ↗' : 'Search venue in Google Maps ↗';
    var siteMap=el('nyfa-cal-modal-site-map');
    siteMap.textContent=validCoords(s) ? 'Find session on NYFA map' : 'Find session in location records';
    siteMap.onclick=function () {
      dialog.close();
      var nav=document.querySelector('#sidebar .navbtn[data-section="locations"]');
      if (nav) nav.click();
      var search=el('mapSearch');
      if (search) {
        search.value = String(s.id || '');
        search.dispatchEvent(new Event('input',{bubbles:true}));
      }
    };
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open','');
  }
  function exportCsv() {
    if (!data) return;
    var rows = [['Session ID','Date','Start','End','District','DS Division','Venue','CBO','Status','Expected Participants']];
    filtered.forEach(function (item) {
      var s = item.s;
      rows.push([s.id,s.date,s.start,s.end,s.district,s.ds,s.venue,s.cbo,STATUS[status(s,today)],s.expected]);
    });
    function cell(value) {
      var text=String(value == null ? '' : value);
      if (/^[\s]*[=+@\-\t\r]/.test(text)) text="'" + text;
      return '"'+text.replace(/"/g,'""')+'"';
    }
    var csv='\ufeff'+rows.map(function (row) {return row.map(cell).join(',');}).join('\r\n');
    var url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    var a=document.createElement('a');a.href=url;a.download='NYFA_Training_Calendar_'+isoDate(month).slice(0,7)+'.csv';
    document.body.appendChild(a);a.click();a.remove();
    window.setTimeout(function () {URL.revokeObjectURL(url);},1100);
  }

  desktopTab.addEventListener('click',openCalendar);
  mobileTab.addEventListener('click',openCalendar);
  var upcomingHeader=document.querySelector('#sec-overview .home-upcoming .panel-h');
  if (upcomingHeader) {
    var shortcut=document.createElement('button');
    shortcut.type='button';shortcut.className='mini-button';shortcut.textContent='Open national calendar ↗';
    shortcut.addEventListener('click',function () {desktopTab.click();});
    upcomingHeader.appendChild(shortcut);
    upcomingHeader.style.flexWrap='wrap';
  }
  el('nyfa-cal-prev').addEventListener('click',function () {month=new Date(month.getFullYear(),month.getMonth()-1,1);selectedDate='';render();});
  el('nyfa-cal-next').addEventListener('click',function () {month=new Date(month.getFullYear(),month.getMonth()+1,1);selectedDate='';render();});
  el('nyfa-cal-today').addEventListener('click',function () {var d=asDate(todayInSriLanka());month=new Date(d.getFullYear(),d.getMonth(),1);selectedDate='';render();});
  el('nyfa-cal-month-button').addEventListener('click',function () {view='month';render();});
  el('nyfa-cal-agenda-button').addEventListener('click',function () {view='agenda';render();});
  el('nyfa-cal-district').addEventListener('change',function () {populateCbos();render();});
  ['nyfa-cal-cbo','nyfa-cal-status'].forEach(function (id) {el(id).addEventListener('change',render);});
  el('nyfa-cal-date').addEventListener('change',function () {
    var d=asDate(this.value);
    selectedDate=d ? this.value : '';
    if (d) month=new Date(d.getFullYear(),d.getMonth(),1);
    render();
  });
  var searchTimer;
  el('nyfa-cal-search').addEventListener('input',function () {
    window.clearTimeout(searchTimer);
    searchTimer=window.setTimeout(render,180);
  });
  el('nyfa-cal-reset').addEventListener('click',function () {
    ['nyfa-cal-district','nyfa-cal-cbo','nyfa-cal-status','nyfa-cal-search','nyfa-cal-date'].forEach(function (id) {el(id).value='';});
    selectedDate='';populateCbos();render();
  });
  el('nyfa-cal-csv').addEventListener('click',exportCsv);
  el('nyfa-cal-results').addEventListener('click',function (event) {
    var item=event.target.closest('[data-cal-index]');
    if (item) {openDetails(Number(item.dataset.calIndex));return;}
    var day=event.target.closest('[data-cal-day]');
    if (day) selectDay(day.dataset.calDay);
  });
  el('nyfa-cal-modal-close').addEventListener('click',function () {dialog.close();});
  dialog.addEventListener('click',function (event) {if (event.target === dialog) dialog.close();});
  dialog.addEventListener('close',function () {
    if (dialogReturnFocus && document.contains(dialogReturnFocus)) dialogReturnFocus.focus();
    dialogReturnFocus=null;
  });

  // When the global dashboard Refresh button saves a new snapshot, update the
  // calendar if it is open, without changing the site's original refresh logic.
  var sync=el('syncState'),lastSync=sync ? sync.textContent : '';
  if (sync && typeof MutationObserver !== 'undefined') {
    new MutationObserver(function () {
      var next=sync.textContent;
      if (next===lastSync) return;
      lastSync=next;
      if (viewIsOpen() && !loading && !/connection error|unavailable/i.test(next)) {
        window.setTimeout(fetchSchedule, 0);
      }
    }).observe(sync,{childList:true,characterData:true,subtree:true});
  }
  render();
})(window, document);
