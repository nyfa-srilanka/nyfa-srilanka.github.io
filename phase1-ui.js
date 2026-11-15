/*
 * National Youth First Aid Programme — Phase 1 visual enhancement
 * Version 1.0, 15 November 2026
 * Presentation-only add-on. Does not request, store or modify programme data.
 * Does not change bridge.js, GitHub Actions, Google Sheets or the photo gallery.
 * Remove <script src="./phase1-ui.js" defer></script> to instantly roll back.
 */
(function () {
  'use strict';
  var STYLE_ID = 'nyfa-phase1-style';
  if (document.getElementById(STYLE_ID)) return;

  var styles = `
/* NYFA Phase 1 — Scoped homepage refinement */
#sec-overview .institutional-logos {
  border: 1px solid #e6edf2;
  border-radius: 17px;
  box-shadow: 0 6px 23px rgba(17, 43, 60, .035);
}
#sec-overview .homepage-banner {
  isolation: isolate;
  min-height: 246px;
  padding: 29px 37px;
  margin-bottom: 26px;
  background: radial-gradient(ellipse at 82% 20%,rgba(65,227,207,.20),transparent 38%),
              linear-gradient(111deg,#09283e 0%,#103b54 52%,#126c75 110%);
  border: 1px solid rgba(179,244,239,.16);
  border-radius: 23px;
  box-shadow: 0 19px 43px rgba(9,47,66,.20);
}
#sec-overview .homepage-banner::before {
  content: ''; position: absolute; inset: 0; z-index: -1; opacity: .31; pointer-events: none;
  background-image: radial-gradient(rgba(183,255,245,.60) .85px,transparent .85px);
  background-size: 27px 27px; background-position: 60% 0;
  mask-image: linear-gradient(90deg,transparent 39%,#000 100%);
}
#sec-overview .homepage-banner::after {
  right: -79px; bottom: -225px; width: 450px; height: 450px;
  border-color: rgba(151,249,227,.20);
  box-shadow: 0 0 0 47px rgba(130,243,221,.035), 0 0 0 94px rgba(130,243,221,.035);
}
#sec-overview .homepage-banner .tag {
  display: inline-flex; align-items: center; gap: 9px;
  color: #9deee3; font-size: 10px; letter-spacing: 1.7px;
}
#sec-overview .homepage-banner .tag::before {
  content: ''; width: 21px; height: 2px; background: #67e9d4; border-radius: 3px;
}
#sec-overview .homepage-banner h2 {
  font-size: clamp(27px,3.25vw,42px); line-height: 1.15;
  letter-spacing: -1.25px; margin: 13px 0 10px; max-width: 730px;
  text-wrap: balance;
}
#sec-overview .homepage-banner .banner-subtitle {
  color: #d9f9f4; font-size: clamp(12px,1.3vw,16px); font-weight: 700;
}
#sec-overview .homepage-banner .banner-detail {
  color: #bedadf; font-size: 12px; max-width: 610px; line-height: 1.65; margin-top: 9px;
}
#sec-overview .homepage-banner .homepage-live {
  border-color: rgba(171,249,227,.26); background: rgba(18,91,98,.46);
  padding: 7px 12px; margin-top: 15px; color: #d9fff7;
}
#sec-overview .hero-art { min-width: 195px; height: 178px; flex-shrink: 0; }
#sec-overview .hero-art .ring {
  width: 155px; height: 155px; border: 1px dashed rgba(165,249,235,.50);
  box-shadow: 0 0 0 22px rgba(155,249,231,.055),0 0 0 47px rgba(155,249,231,.025);
  backdrop-filter: blur(2px);
}
#sec-overview .hero-art .cross { color: #78f7dc; font-size: 94px; text-shadow: 0 10px 50px rgba(50,232,201,.48); }
#sec-overview .hero-art .dot { width: 9px; height: 9px; background: #8cf9e9; box-shadow: 0 0 0 7px rgba(140,249,233,.10); }
.nyfa-phase1-hero-actions {
  display: flex; flex-wrap: wrap; gap: 10px; margin-top: 17px; position: relative; z-index: 3;
}
.nyfa-phase1-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  border-radius: 11px; padding: 10px 14px; font: 800 11px/1.2 'Manrope', sans-serif;
  border: 1px solid rgba(212,255,248,.40); transition: transform .18s ease,background .18s ease, border-color .18s ease;
  cursor: pointer;
}
.nyfa-phase1-cta.primary { color: #10394b; background: #a3fae8; border-color: #a3fae8; }
.nyfa-phase1-cta.secondary { color: #e6fcf9; background: rgba(255,255,255,.08); }
.nyfa-phase1-cta:hover { transform: translateY(-2px); }
.nyfa-phase1-cta.primary:hover { background: #d2fff5; }
.nyfa-phase1-cta.secondary:hover { background: rgba(255,255,255,.16); }
.nyfa-phase1-cta:focus-visible { outline: 3px solid #fcdb8d; outline-offset: 3px; }

/* Premium but restrained national statistics */
#sec-overview .homepage-heading-row { margin-bottom: 15px; }
#sec-overview .home-kpis .metric {
  position: relative; overflow: hidden; border: 1px solid #e3eaf0;
  border-radius: 17px; box-shadow: 0 7px 28px rgba(20,48,66,.055);
  min-height: 156px; background: linear-gradient(154deg,#fff 65%,#f9fdfd 100%);
  transition: transform .2s ease,box-shadow .2s ease,border-color .2s ease;
}
#sec-overview .home-kpis .metric::before {
  content: ''; position: absolute; left: 19px; top: 0; width: 39px; height: 3px;
  border-radius: 0 0 5px 5px; background: #1caa9f;
}
#sec-overview .home-kpis .metric:nth-child(1)::before { background: #6687aa; }
#sec-overview .home-kpis .metric:nth-child(3)::before { background: #377abc; }
#sec-overview .home-kpis .metric:nth-child(4)::before { background: #0aad9b; width: 65px; }
#sec-overview .home-kpis .metric:nth-child(5)::before { background: #c49654; }
#sec-overview .home-kpis .metric.accent-metric {
  background: linear-gradient(145deg,#e8faf6,#ffffff);
  border-color: #aee5d9;
}
#sec-overview .home-kpis .metric:hover {
  transform: translateY(-3px); box-shadow: 0 14px 31px rgba(15,65,83,.095);border-color: #c5ddd9;
}
#sec-overview .home-kpis .metric-num {
  font-weight: 800; font-variant-numeric: tabular-nums;
  letter-spacing: -1px; color: #13364a;
}
#sec-overview .home-kpis .accent-metric .metric-num { color: #078d80; }
#sec-overview .home-kpis .metric-icon { border-radius: 12px; background: #edf8f7; }
#sec-overview .home-kpis .metric:nth-child(1) .metric-icon { background: #eef3fa; color: #5c7b9a; }
#sec-overview .home-kpis .metric:nth-child(3) .metric-icon { background: #eaf2fb; color: #377abc; }
#sec-overview .home-kpis .metric:nth-child(5) .metric-icon { background: #fbf4e9; color: #ae7a37; }

/* Circular progress complements the original, accessible progress bar */
#sec-overview .home-progress {
  padding: 26px 28px; border: 1px solid #d9eae7; border-radius: 19px;
  background: linear-gradient(112deg,#fff 0%,#f5fdfa 100%);
  box-shadow: 0 7px 27px rgba(18,70,68,.04);
}
#sec-overview .nyfa-phase1-progress-grid {
  display: grid; grid-template-columns: 168px minmax(0,1fr);
  gap: 31px; align-items: center; margin: 4px 0 17px;
}
#sec-overview .nyfa-phase1-ring {
  position: relative; width: 160px; height: 160px; display: grid;
  place-items: center; justify-self: center;
}
#sec-overview .nyfa-phase1-ring svg { display: block; width: 160px; height: 160px; }
#sec-overview .nyfa-phase1-ring-bg { fill: none; stroke: #e3f0ec; stroke-width: 13; }
#sec-overview .nyfa-phase1-ring-fill {
  fill: none; stroke: #09aa98; stroke-width: 13; stroke-linecap: round;
  transform: rotate(-90deg); transform-origin: center;
  stroke-dasharray: 0 427.26; transition: stroke-dasharray .85s cubic-bezier(.2,.8,.2,1);
}
#sec-overview .nyfa-phase1-ring-center {
  position: absolute; display: flex; flex-direction: column; align-items: center; gap: 3px;
  text-align: center; color: #20516a; pointer-events: none;
}
#sec-overview .nyfa-phase1-ring-value {
  font: 800 27px/1.2 Manrope,sans-serif; letter-spacing: -1px;
}
#sec-overview .nyfa-phase1-ring-caption {
  font: 800 9px/1.25 Manrope,sans-serif; color: #79929b; text-transform: uppercase;
  letter-spacing: 1px;
}
#sec-overview .nyfa-phase1-progress-grid .progress-metrics {
  align-items: flex-start; flex-direction: column; margin: 0; gap: 12px;
}
#sec-overview .nyfa-phase1-progress-grid .progress-large {
  font-size: clamp(31px,4vw,46px); line-height: 1.1;
}
#sec-overview .nyfa-phase1-progress-grid .progress-statline {
  display: flex; align-items: flex-start; flex-wrap: wrap; gap: 11px 23px;
}
#sec-overview .progress-track { height: 13px; background: #deede9; }
#sec-overview .progress-fill { background: linear-gradient(90deg,#068f89,#3dd7bf); }
#sec-overview .home-progress .progress-note { line-height: 1.6; }

/* Soft placeholder shimmer while the first dashboard response is pending */
#sec-overview.nyfa-phase1-pending .home-kpis .metric-num,
#sec-overview.nyfa-phase1-pending .progress-large {
  color: transparent !important; position: relative;
}
#sec-overview.nyfa-phase1-pending .home-kpis .metric-num::after,
#sec-overview.nyfa-phase1-pending .progress-large::after {
  content: ''; position: absolute; left: 0; top: 3px; width: min(110px,80%); height: 31px;
  border-radius: 9px;
  background: linear-gradient(105deg,#e9f1f4 8%,#f7fafb 42%,#e9f1f4 76%);
  background-size: 210% 100%; animation: nyfa-phase1-shimmer 1.25s linear infinite;
}
@keyframes nyfa-phase1-shimmer { from { background-position: 170% 0; } to { background-position: -130% 0; } }

@media(max-width:1000px) {
  #sec-overview .homepage-banner { min-height: 226px; padding: 26px 29px; }
  #sec-overview .hero-art { min-width: 155px; }
  #sec-overview .hero-art .ring { width: 130px; height: 130px; }
}
@media(max-width:820px) {
  #sec-overview .homepage-banner { padding: 25px; }
  #sec-overview .hero-art { display: none; }
  #sec-overview .homepage-banner h2 { max-width: 100%; }
}
@media(max-width:620px) {
  #sec-overview .homepage-banner { min-height: 0; padding: 22px 20px 24px; border-radius: 18px; margin-bottom: 20px; }
  #sec-overview .homepage-banner h2 { font-size: clamp(24px,6.3vw,33px);letter-spacing: -.8px; }
  #sec-overview .homepage-banner .banner-detail { font-size: 11px; }
  #sec-overview .nyfa-phase1-hero-actions { margin-top: 15px; gap: 8px; }
  #sec-overview .nyfa-phase1-cta { padding: 10px 11px; font-size: 10px; }
  #sec-overview .home-kpis .metric { min-height: 132px; border-radius: 13px; }
  #sec-overview .home-kpis .metric:nth-child(5) { min-height: 96px; }
  #sec-overview .home-progress { padding: 20px 17px; }
  #sec-overview .nyfa-phase1-progress-grid { grid-template-columns: 122px minmax(0,1fr); gap: 11px; margin-bottom: 16px; }
  #sec-overview .nyfa-phase1-ring,#sec-overview .nyfa-phase1-ring svg { width: 118px; height: 118px; }
  #sec-overview .nyfa-phase1-ring-value { font-size: 22px; }
  #sec-overview .nyfa-phase1-ring-caption { font-size: 8px; }
  #sec-overview .nyfa-phase1-progress-grid .progress-large { font-size: 31px; }
  #sec-overview .nyfa-phase1-progress-grid .progress-caption { font-size: 11px; }
  #sec-overview .nyfa-phase1-progress-grid .progress-statline { gap: 5px; flex-direction: column; }
}
@media(max-width:380px) {
  #sec-overview .nyfa-phase1-progress-grid { grid-template-columns: 1fr; }
  #sec-overview .nyfa-phase1-ring { justify-self: start; }
}
@media(prefers-reduced-motion:reduce) {
  #sec-overview .home-kpis .metric,
  #sec-overview .nyfa-phase1-cta,
  #sec-overview .nyfa-phase1-ring-fill { transition: none !important; }
  #sec-overview.nyfa-phase1-pending .home-kpis .metric-num::after,
  #sec-overview.nyfa-phase1-pending .progress-large::after { animation: none; }
}
`;

  var style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = styles;
  document.head.appendChild(style);

  function init() {
    var overview = document.getElementById('sec-overview');
    if (!overview || overview.dataset.nyfaPhase1Ready === 'true') return;
    overview.dataset.nyfaPhase1Ready = 'true';

    // Hero navigation uses the site's existing navigation controls; no new router.
    var heroCopy = overview.querySelector('.homepage-hero-copy');
    if (heroCopy) {
      var actions = document.createElement('div');
      actions.className = 'nyfa-phase1-hero-actions';
      var items = [
        { label: 'Explore training map', section: 'locations', cls: 'primary', icon: '↗' },
        { label: 'District performance', section: 'districts', cls: 'secondary', icon: '↗' }
      ];
      items.forEach(function (item) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'nyfa-phase1-cta ' + item.cls;
        button.textContent = item.label + ' ' + item.icon;
        button.addEventListener('click', function () {
          var nav = document.querySelector('.navbtn[data-section="' + item.section + '"]') ||
                    document.querySelector('.mobile-tab[data-section="' + item.section + '"]');
          if (nav) nav.click();
        });
        actions.appendChild(button);
      });
      heroCopy.appendChild(actions);
    }

    // Add a decorative, data-driven SVG ring alongside the EXISTING progress bar.
    var panel = overview.querySelector('.home-progress');
    var metrics = panel && panel.querySelector('.progress-metrics');
    var progressValue = document.getElementById('progressPct');
    if (panel && metrics && progressValue) {
      var grid = document.createElement('div');
      grid.className = 'nyfa-phase1-progress-grid';
      var ring = document.createElement('div');
      ring.className = 'nyfa-phase1-ring';
      ring.setAttribute('role', 'img');
      ring.setAttribute('aria-label', 'National target achievement not yet available');
      ring.innerHTML = '<svg viewBox="0 0 160 160" aria-hidden="true" focusable="false">' +
        '<circle class="nyfa-phase1-ring-bg" cx="80" cy="80" r="68"></circle>' +
        '<circle class="nyfa-phase1-ring-fill" cx="80" cy="80" r="68"></circle>' +
        '</svg><div class="nyfa-phase1-ring-center"><span class="nyfa-phase1-ring-value">—</span>' +
        '<span class="nyfa-phase1-ring-caption">target reached</span></div>';
      panel.insertBefore(grid, metrics);
      grid.appendChild(ring);
      grid.appendChild(metrics);
      var ringFill = ring.querySelector('.nyfa-phase1-ring-fill');
      var ringLabel = ring.querySelector('.nyfa-phase1-ring-value');
      var circumference = 2 * Math.PI * 68;
      function syncRing() {
        var text = String(progressValue.textContent || '').trim();
        var numberMatch = text.replace(/,/g, '').match(/^([0-9]+(?:\.[0-9]+)?)\s*%$/);
        var value = numberMatch ? Number(numberMatch[1]) : NaN;
        if (!Number.isFinite(value) || value < 0) {
          ringLabel.textContent = '—';
          ringFill.style.strokeDasharray = '0 ' + circumference;
          ring.setAttribute('aria-label', 'National target achievement not yet available');
        } else {
          var shown = Math.min(100, Math.max(0, value));
          ringLabel.textContent = text;
          ringFill.style.strokeDasharray = (circumference * shown / 100) + ' ' + circumference;
          ring.setAttribute('aria-label', text + ' of the national youth training target achieved');
        }
      }
      syncRing();
      new MutationObserver(syncRing).observe(progressValue, { characterData: true, childList: true, subtree: true });
    }

    // Loading placeholders are removed as soon as a response or error arrives.
    var syncState = document.getElementById('syncState');
    if (syncState) {
      var initial = String(syncState.textContent || '');
      if ((document.getElementById('kYouthTrained') || {}).textContent === '—' &&
          /connect|load|sync|wait|fetch/i.test(initial)) {
        overview.classList.add('nyfa-phase1-pending');
      }
      var lastSyncState = initial;
      var statusObserver = new MutationObserver(function () {
        var next = String(syncState.textContent || '');
        if (next === lastSyncState) return;
        lastSyncState = next;
        overview.classList.remove('nyfa-phase1-pending');
        // Allow the dashboard's synchronous render() to finish before animation.
        queueAnimation();
      });
      statusObserver.observe(syncState, { characterData: true, childList: true, subtree: true });
      setTimeout(function () { overview.classList.remove('nyfa-phase1-pending'); }, 36000);
    }

    // Numeric transitions operate only on five existing homepage KPI labels.
    // No figures are calculated or stored; the original dashboard remains source of truth.
    var ids = ['kTargetYouth','kYouthTrained','kCompleted','kCoverage','kScheduled'];
    var previous = {};
    var running = {};
    var tickScheduled = false;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ids.forEach(function (id) {
      var node = document.getElementById(id);
      previous[id] = node ? String(node.textContent || '').trim() : '';
    });
    function queueAnimation() {
      if (tickScheduled) return;
      tickScheduled = true;
      requestAnimationFrame(function () {
        tickScheduled = false;
        ids.forEach(function (id) {
          var node = document.getElementById(id);
          if (!node) return;
          var next = String(node.textContent || '').trim();
          var old = previous[id];
          if (next === old) return;
          previous[id] = next;
          if (running[id]) cancelAnimationFrame(running[id]);
          running[id] = null;
          var match = next.match(/^([\d,]+(?:\.\d+)?)(%)?$/);
          if (reduceMotion || !match) return;
          var val = Number(match[1].replace(/,/g, ''));
          if (!Number.isFinite(val) || val < 0) return;
          var decimals = (match[1].split('.')[1] || '').length;
          var suffix = match[2] || '';
          var from = 0;
          var oldMatch = old.match(/^([\d,]+(?:\.\d+)?)(%)?$/);
          if (oldMatch && (oldMatch[2] || '') === suffix)
            from = Number(oldMatch[1].replace(/,/g, ''));
          if (Math.abs(val - from) < 0.0001) return;
          var timeStart = performance.now();
          var duration = 480;
          function paint(now) {
            var t = Math.min(1, Math.max(0, (now - timeStart) / duration));
            var eased = 1 - Math.pow(1 - t, 3);
            var n = from + (val - from) * eased;
            node.textContent = n.toLocaleString('en-US', {
              minimumFractionDigits: decimals, maximumFractionDigits: decimals
            }) + suffix;
            if (t < 1) running[id] = requestAnimationFrame(paint);
            else { node.textContent = next; running[id] = null; }
          }
          running[id] = requestAnimationFrame(paint);
        });
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
