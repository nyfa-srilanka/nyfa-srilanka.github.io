/*
 * NYFA — District Explorer enhancement for the existing District Performance tab.
 * v1.0 (2026-11-23)
 * - Read-only: never changes Google Sheets, Session Register, or published statistics.
 * - Reuses getDashboardData(), existing reporting-area controls and approved Gallery API.
 * - Maps 25 physical districts; CMC, Kalmunai, NIHS remain distinct reporting areas.
 * - Geographic boundaries: MalakaGu/Sri-lanka-maps District_geo.json (OCHA-style ADM2 data).
 */
(function () {
  'use strict';
  if (window.__NYFA_DISTRICT_EXPLORER__) return;
  window.__NYFA_DISTRICT_EXPLORER__ = true;

  var AREAS = ['Ampara','Anuradhapura','Badulla','Batticaloa','CMC','Colombo','Galle','Gampaha','Hambantota','Jaffna','Kalmunai','Kalutara','Kandy','Kegalle','Kilinochchi','Kurunegala','Mannar','Matale','Matara','Monaragala','Mullaitivu','NIHS','Nuwara Eliya','Polonnaruwa','Puttalam','Ratnapura','Trincomalee','Vavuniya'];
  var SPECIAL = ['CMC','Kalmunai','NIHS'];
  var SOURCES = [
    'https://cdn.jsdelivr.net/gh/MalakaGu/Sri-lanka-maps@master/discrict_map/District_geo.json',
    'https://raw.githubusercontent.com/MalakaGu/Sri-lanka-maps/master/discrict_map/District_geo.json'
  ];
  var state = {
    root: null, section: null, map: null, layer: null, boundaries: null,
    data: null, selected: '', mode: 'scheduled', lastFetched: 0,
    photos: [], photosLoaded: false, initialized: false, busy: false
  };
  function $(id) { return document.getElementById(id); }
  function norm(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function nfmt(value) { return typeof value === 'number' && isFinite(value) ? value.toLocaleString('en-LK') : '—'; }
  function amount(field) { return field && typeof field.value === 'number' && isFinite(field.value) && field.value >= 0 ? field.value : null; }
  function isOpen() { return state.section && state.section.classList.contains('active'); }
  function label(text) { return String(text || '').trim(); }
  function text(id, value) { var node = $(id); if (node) node.textContent = value; }
  function getDistrictName(feature) {
    var p = feature && feature.properties || {};
    var name = String(p.ADM2_EN || p.shapeName || p.name || '').trim();
    // The source includes one small '[unknown]' polygon: do not mistake it for a district.
    return AREAS.find(function (a) { return SPECIAL.indexOf(a) < 0 && norm(a) === norm(name); }) || '';
  }
  function areaFor(name) {
    var payload = state.data || {}, districts = (payload.dashboard && payload.dashboard.districts) || [];
    var wanted = norm(name);
    var record = districts.find(function (d) { return norm(d.name) === wanted; });
    var seen = {}, sessions = [];
    (payload.sessions || []).forEach(function (s) {
      var id = String(s.id || '').trim(), key = norm(s.district);
      if (key !== wanted || !id || seen[id]) return;
      seen[id] = true;
      sessions.push(s);
    });
    var target = record ? amount(record.targetYouth) : null;
    if (target === 0) target = null;
    var trained = record ? amount(record.youthTrained) : null;
    var completed = record ? amount(record.completedSessions) : null;
    var scheduled = sessions.filter(function (s) {
      var v = String(s.status || '').toLowerCase();
      return !!s.date && !s.completedInRegister && v.indexOf('complet') === -1 &&
        v.indexOf('cancel') === -1 && v.indexOf('postpon') === -1;
    }).length;
    return {
      name: name, target: target, trained: trained, completed: completed,
      scheduled: scheduled, coverage: target && trained !== null ? trained * 100 / target : null,
      sessions: sessions, reported: !!record
    };
  }

  function css() {
    var style = document.createElement('style');
    style.id = 'nyfa-dex-css';
    style.textContent = `
          /* District performance visual upgrade */
      #sec-districts .dp-district-table {
        width: 100%;
        margin: 0 auto;
        border-collapse: collapse;
        min-width: 740px;
      }

      #sec-districts .dp-district-table th {
        padding: 15px 18px;
        text-align: center;
        background: #f1f7f4;
        border-bottom: 1px solid #dce8e1;
        font-size: 11px;
      }

      #sec-districts .dp-district-table td {
        padding: 13px 18px;
        text-align: center;
        border-bottom: 1px solid #edf1ef;
      }

      #sec-districts .dp-district-table th:first-child,
      #sec-districts .dp-district-table td:first-child {
        text-align: left;
      }

      #sec-districts .dp-district-table tbody tr:hover {
        background: #f0f8f5;
      }

      #sec-districts .dp-progress-in-table {
        justify-content: center;
      }

      #sec-districts #nyfa-dex .dex-map-canvas {
        height: 580px;
      }

      @media(max-width:1050px) {
        #sec-districts #nyfa-dex .dex-map-canvas {
          height: 480px;
        }
      }

      @media(max-width:650px) {
        #sec-districts #nyfa-dex .dex-map-canvas {
          height: 400px;
        }
      }
      #nyfa-dex {margin: 5px 0 22px; color:#223b50;}
      #nyfa-dex *, #nyfa-dex *:before, #nyfa-dex *:after {box-sizing:border-box}
      #nyfa-dex .dex-top {display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin:0 0 13px;flex-wrap:wrap}
      #nyfa-dex h2 {font:800 19px/1.3 Manrope,sans-serif;letter-spacing:-.4px;margin:5px 0 0}
      #nyfa-dex .dex-eyebrow {font:800 10px Manrope,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#078a83}
      #nyfa-dex .dex-sub {font:12px/1.6 'DM Sans',sans-serif;color:#667e91;max-width:740px;margin:5px 0 0}
      #nyfa-dex .dex-tools {display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      #nyfa-dex .dex-tools label {font:700 11px Manrope,sans-serif;color:#657b90}
      #nyfa-dex .dex-tools select, #nyfa-dex .dex-reset {height:38px;border:1px solid #d6e5e9;border-radius:9px;background:#fff;color:#294a5b;font:700 11px Manrope,sans-serif;padding:0 11px;cursor:pointer}
      #nyfa-dex .dex-tools select:focus-visible, #nyfa-dex button:focus-visible {outline:3px solid #43b8ae;outline-offset:2px}
      #nyfa-dex .dex-layout {display:grid;grid-template-columns:minmax(0,1.28fr) minmax(295px,.86fr);gap:15px;align-items:stretch}
      #nyfa-dex .dex-map-wrap, #nyfa-dex .dex-profile {min-width:0;background:white;border:1px solid #e0e9ef;box-shadow:0 8px 23px #15344b09;border-radius:16px;overflow:hidden}
      #nyfa-dex .dex-map-canvas {height:425px;width:100%;background:radial-gradient(circle at 45% 45%,#effaf7,#eaf2f6);position:relative;z-index:0}
      #nyfa-dex .dex-map-bottom {display:flex;align-items:center;justify-content:space-between;gap:11px;padding:12px 14px;border-top:1px solid #edf1f4;flex-wrap:wrap}
      #nyfa-dex .dex-legend {display:flex;align-items:center;gap:6px;color:#668095;font:700 10px Manrope,sans-serif;flex-wrap:wrap}
      #nyfa-dex .dex-legend i {display:inline-block;width:52px;height:9px;border-radius:9px;background:linear-gradient(90deg,#e5f3f0,#7dd1bd,#058e81)}
      #nyfa-dex .dex-legend em {display:inline-block;width:10px;height:10px;background:#dce3eb;border-radius:2px;margin-left:5px}
      #nyfa-dex .dex-source {font:10px/1.4 'DM Sans',sans-serif;color:#8294a3}
      #nyfa-dex .dex-map-status {position:absolute;z-index:500;left:12px;top:12px;right:12px;background:#fffffff2;border:1px solid #d9e4ec;box-shadow:0 6px 21px #123b4619;padding:11px 14px;border-radius:10px;color:#536e83;font:12px/1.4 'DM Sans',sans-serif}
      #nyfa-dex .dex-map-status[hidden] {display:none!important}
      #nyfa-dex .leaflet-container {font-family:'DM Sans',sans-serif;background:transparent}
      #nyfa-dex .leaflet-control-attribution {font-size:9px}
      #nyfa-dex .dex-map-tooltip {font:700 12px/1.45 'DM Sans',sans-serif}
      #nyfa-dex .dex-profile {padding:19px 19px 14px;display:flex;flex-direction:column;gap:14px}
      #nyfa-dex .dex-profile-kicker {text-transform:uppercase;color:#0a9188;font:800 10px Manrope,sans-serif;letter-spacing:1.3px}
      #nyfa-dex .dex-profile h3 {font:800 clamp(19px,2vw,25px)/1.2 Manrope,sans-serif;letter-spacing:-.5px;margin:5px 0 0;min-height:24px}
      #nyfa-dex .dex-profile-description {margin:4px 0 0;color:#6f8293;font:11px/1.55 'DM Sans',sans-serif}
      #nyfa-dex .dex-stats {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      #nyfa-dex .dex-stat {background:#f5f9fa;border:1px solid #e5eef0;border-radius:11px;padding:12px 13px}
      #nyfa-dex .dex-stat strong {display:block;font:800 22px/1.2 Manrope,sans-serif;color:#183c4d}
      #nyfa-dex .dex-stat span {font:700 10px/1.35 'DM Sans',sans-serif;color:#6a8293;margin-top:5px;display:block}
      #nyfa-dex .dex-progress-title {display:flex;justify-content:space-between;gap:10px;font:800 11px Manrope,sans-serif;color:#556e7c;margin-bottom:7px}
      #nyfa-dex .dex-progress-track {height:9px;background:#e8f1f1;border-radius:12px;overflow:hidden}
      #nyfa-dex .dex-progress-fill {width:0%;height:100%;background:linear-gradient(90deg,#0b9288,#49d1b3);border-radius:12px;transition:width .3s}
      #nyfa-dex .dex-profile h4 {font:800 12px Manrope,sans-serif;margin:0 0 8px;color:#344f60}
      #nyfa-dex .dex-photo-row {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
      #nyfa-dex .dex-photo {width:100%;height:76px;object-fit:cover;border-radius:8px;background:#e8eff3;border:1px solid #e3eaef}
      #nyfa-dex .dex-gallery-action {padding:0;border:0;background:none;text-decoration:underline;text-underline-offset:2px;color:#087f79;font:800 11px Manrope,sans-serif;cursor:pointer;margin-top:8px}
      #nyfa-dex .dex-sessions {display:flex;flex-direction:column;gap:5px}
      #nyfa-dex .dex-session {display:flex;justify-content:space-between;align-items:center;gap:9px;border:1px solid #e9eef1;border-radius:9px;padding:8px 10px;color:#2c475c;background:#fcfefe}
      #nyfa-dex .dex-session strong {display:block;font:800 10px Manrope,sans-serif}
      #nyfa-dex .dex-session small {display:block;margin-top:3px;font:10px/1.35 'DM Sans',sans-serif;color:#7d8d9d}
      #nyfa-dex .dex-session button {flex:none;color:#078a82;background:#e9f8f5;border:0;border-radius:7px;padding:7px;font:800 10px Manrope,sans-serif;cursor:pointer}
      #nyfa-dex .dex-mini-note {color:#7890a0;font:11px/1.5 'DM Sans',sans-serif}
      #nyfa-dex .dex-extra {margin-top:11px;display:flex;flex-wrap:wrap;gap:7px;align-items:center}
      #nyfa-dex .dex-extra span {font:800 10px Manrope,sans-serif;color:#697c8d;margin-right:2px}
      #nyfa-dex .dex-extra button {background:#eef7f7;border:1px solid #d3e8e6;border-radius:16px;padding:7px 11px;color:#087f78;font:800 11px Manrope,sans-serif;cursor:pointer}
      #nyfa-dex .dex-extra button.is-on {background:#0b837e;color:#fff}
      @media(max-width:1050px){#nyfa-dex .dex-layout{grid-template-columns:minmax(0,1fr)}#nyfa-dex .dex-map-canvas{height:350px}#nyfa-dex .dex-profile{padding:18px}}
      @media(max-width:650px){#nyfa-dex .dex-map-canvas{height:315px}#nyfa-dex .dex-layout{gap:11px}#nyfa-dex .dex-tools{width:100%}#nyfa-dex .dex-tools select{flex:1;min-width:145px}#nyfa-dex .dex-photo{height:82px}#nyfa-dex .dex-profile{gap:12px}#nyfa-dex h2{font-size:18px}}
      @media(prefers-reduced-motion:reduce){#nyfa-dex *{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    var section = $('sec-districts');
    if (!section || $('nyfa-dex')) return;
    state.section = section;
    css();
    var root = document.createElement('section');
    root.id = 'nyfa-dex';
    root.setAttribute('aria-label', 'Interactive Sri Lanka District Explorer');
    root.innerHTML = `
      <div class="dex-top">
        <div><span class="dex-eyebrow">Explore the national programme</span>
          <h2>Interactive District Explorer</h2>
          <p class="dex-sub">Select any district on the map to view its official reporting figures, scheduled programmes and approved training photographs.</p>
        </div>
        <div class="dex-tools"><label for="dex-metric">Colour districts by</label>
          <select id="dex-metric" aria-label="Map metric">
            <option value="scheduled">Scheduled programmes</option>
            <option value="trained">Youth trained</option>
            <option value="completed">Completed sessions</option>
            <option value="coverage">Youth target achieved (%)</option>
          </select>
          <button id="dex-reset" class="dex-reset" type="button">Show all districts</button>
        </div>
      </div>
      <div class="dex-layout">
        <div class="dex-map-wrap">
          <div class="dex-map-canvas" id="dex-map" role="region" aria-label="Interactive map of Sri Lanka districts">
            <div class="dex-map-status" id="dex-map-status">Open District Performance to load the interactive district map…</div>
          </div>
          <div class="dex-map-bottom"><span class="dex-legend"><i></i> Lower → higher <em></em> Data unavailable</span>
            <span class="dex-source">25 geographic districts · Boundaries: MalakaGu / Sri-lanka-maps</span>
          </div>
        </div>
        <aside class="dex-profile" aria-label="Selected district profile">
          <div><span class="dex-profile-kicker" id="dex-type">National overview</span>
            <h3 id="dex-name">Select a district</h3>
            <p class="dex-profile-description" id="dex-description">Click a district on the map or choose a reporting area below.</p>
          </div>
          <div class="dex-stats">
            <div class="dex-stat"><strong id="dex-trained">—</strong><span>Youth trained</span></div>
            <div class="dex-stat"><strong id="dex-completed">—</strong><span>Sessions completed</span></div>
            <div class="dex-stat"><strong id="dex-scheduled">—</strong><span>Scheduled sessions</span></div>
            <div class="dex-stat"><strong id="dex-target">—</strong><span>Youth target</span></div>
          </div>
          <div><div class="dex-progress-title"><span>Target achieved</span><strong id="dex-coverage">—</strong></div>
            <div class="dex-progress-track"><div class="dex-progress-fill" id="dex-progress"></div></div></div>
          <div><h4>Programme sessions</h4><div id="dex-sessions" class="dex-sessions"><span class="dex-mini-note">Choose a district to see its programmes.</span></div></div>
          <div><h4>Training photographs</h4><div id="dex-photos" class="dex-photo-row"></div>
            <p id="dex-photo-note" class="dex-mini-note">Select a district to view photos from its approved gallery album.</p>
            <button id="dex-open-gallery" class="dex-gallery-action" type="button">Open photo gallery ↗</button></div>
        </aside>
      </div>
      <div class="dex-extra"><span>Additional reporting areas (not separate geographical districts):</span>
        <button type="button" data-dex-area="CMC">CMC</button>
        <button type="button" data-dex-area="Kalmunai">Kalmunai</button>
        <button type="button" data-dex-area="NIHS">NIHS</button>
      </div>`;
    var toolbar = section.querySelector('.dp-toolbar');
    if (toolbar) toolbar.insertAdjacentElement('beforebegin', root);
    else section.appendChild(root);
    state.root = root;

    $('dex-metric').addEventListener('change', function () {
      state.mode = this.value;
      restyle();
    });
    $('dex-reset').addEventListener('click', function () { choose(''); zoomOut(); });
    root.querySelectorAll('[data-dex-area]').forEach(function (button) {
      button.addEventListener('click', function () { choose(button.dataset.dexArea); });
    });
    $('dex-open-gallery').addEventListener('click', function () {
      var link = document.querySelector('.navbtn[data-section="gallery"]');
      if (link) link.click();
    });

    var dropdown = $('dpArea');
    if (dropdown) dropdown.addEventListener('change', function () { reflect(dropdown.value, true); });
    // The existing comparison table and chart also change dpSelected without
    // dispatching a change event. Observe the table, and only read its selector.
    var rows = $('dpRows');
    if (rows) new MutationObserver(function () {
      if (!isOpen()) return;
      var v = $('dpArea') && $('dpArea').value || '';
      if (v !== state.selected) reflect(v, true);
    }).observe(rows, {childList:true});

    var nav = document.querySelector('.navbtn[data-section="districts"]');
    var mobile = document.querySelector('.mobile-tab[data-section="districts"]');
    [nav,mobile].forEach(function (b) {
      if (b) b.addEventListener('click', function () { window.setTimeout(open, 20); });
    });
    var sectionObserver = new MutationObserver(function () {
      if (isOpen()) open();
    });
    sectionObserver.observe(section, {attributes:true, attributeFilter:['class']});
    if (isOpen()) open();
  }

  function choose(name) {
    var dropdown = $('dpArea');
    if (!dropdown) return;
    if (name && !Array.from(dropdown.options).some(function (o) { return o.value === name; })) {
      text('dex-map-status','Reporting area options have not loaded yet. Try again after the dashboard finishes loading.');
      return;
    }
    // Reset text search to avoid retaining a conflicting district filter.
    if ($('dpSearch')) $('dpSearch').value = '';
    dropdown.value = name;
    dropdown.dispatchEvent(new Event('change', {bubbles:true}));
    reflect(name, true);
  }

  function reflect(name, focusMap) {
    state.selected = name || '';
    state.root.querySelectorAll('[data-dex-area]').forEach(function (b) {
      b.classList.toggle('is-on',b.dataset.dexArea === state.selected);
    });
    restyle();
    if (focusMap && state.selected) {
      var targetLayer = state.layer && state.layer.getLayers().find(function (l) {
        return getDistrictName(l.feature) === state.selected;
      });
      if (targetLayer && state.map) state.map.fitBounds(targetLayer.getBounds(), {padding:[36,36], maxZoom:9, animate:true});
    }
    renderProfile();
  }

  function paintColor(a) {
    if (!a) return '#dce3ea';
    var value = a[state.mode];
    if (value === null || value === undefined || !isFinite(value)) return '#dce3ea';
    if (value <= 0) return '#e4f3f0';
    var values = AREAS.filter(function (n) {return SPECIAL.indexOf(n) === -1;})
      .map(function (n) {return areaFor(n)[state.mode];})
      .filter(function (v) {return typeof v === 'number' && isFinite(v) && v>0;});
    var max = Math.max.apply(null, [1].concat(values));
    var ratio = state.mode === 'coverage' ? Math.min(1,value/100) : Math.min(1,Math.sqrt(value/max));
    if (ratio < .20) return '#c1e6dc';
    if (ratio < .45) return '#8ad4c1';
    if (ratio < .70) return '#51bea9';
    if (ratio < .90) return '#1b9f91';
    return '#077a76';
  }
  function restyle() {
    if (!state.layer) return;
    state.layer.eachLayer(function (l) {
      var name = getDistrictName(l.feature);
      var a = areaFor(name);
      var selected = name === state.selected;
      l.setStyle({fillColor:paintColor(a),fillOpacity:.96,
        weight:selected?3.2:1.15,color:selected?'#113c52':'#ffffff',opacity:1});
      if (selected) l.bringToFront();
      var value = a[state.mode], metricLabel = {
        scheduled:'Scheduled sessions', trained:'Youth trained',
        completed:'Completed sessions',coverage:'Target achieved'
      }[state.mode];
      var val = state.mode === 'coverage' && value !== null ? value.toFixed(1)+'%' : nfmt(value);
      l.unbindTooltip();
      l.bindTooltip('<strong>'+name+'</strong><div>'+metricLabel+': '+val+'</div>',
        {sticky:true,direction:'top',className:'dex-map-tooltip'});
    });
  }
  function zoomOut() {
    if (state.map && state.layer && state.layer.getLayers().length) {
      state.map.fitBounds(state.layer.getBounds(), {padding:[16,16], animate:true});
    }
  }

  function loadGeo(urlIndex) {
    if (urlIndex >= SOURCES.length) {
      text('dex-map-status', 'Map boundaries are temporarily unavailable. District selection and all reporting tables below still work.');
      return;
    }
    fetch(SOURCES[urlIndex], {mode:'cors'})
      .then(function (res) {if (!res.ok) throw Error('HTTP '+res.status); return res.json();})
      .then(function (json) {
        if (!json || !Array.isArray(json.features)) throw Error('Invalid boundaries');
        var features = json.features.filter(function (f) {return !!getDistrictName(f);});
        if (features.length !== 25) throw Error('Expected 25 geographic districts; got '+features.length);
        state.boundaries = {type:'FeatureCollection',features:features};
        makeMap();
      })
      .catch(function () {loadGeo(urlIndex+1);});
  }
  function getLeaflet(next) {
    if (window.L && window.L.map) {next();return;}
    var current = document.querySelector('script[src*="leaflet@1.9.4/dist/leaflet.js"]');
    if (current) {
      var checks = 0, watch = setInterval(function () {
        if (window.L && window.L.map) {clearInterval(watch);next();}
        else if (++checks > 35) {clearInterval(watch);next(new Error('Leaflet unavailable'));}
      }, 150);
      return;
    }
    var script = document.createElement('script');
    script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async=true;
    script.onload=function () {next();};
    script.onerror=function () {next(new Error('Leaflet unavailable'));};
    document.head.appendChild(script);
  }
  function makeMap() {
    if (state.map || !state.boundaries) return;
    getLeaflet(function (err) {
      if (err || !window.L || !state.section) {
        text('dex-map-status','Interactive map could not load. You can still use the district selector below.');
        return;
      }
      try {
        state.map = L.map('dex-map', {scrollWheelZoom:false,zoomControl:true,attributionControl:false,
          minZoom:5, maxZoom:11, zoomSnap:0.1, zoomDelta:0.5, preferCanvas:true});
        state.layer = L.geoJSON(state.boundaries, {
          style:function () {return {color:'#ffffff',weight:1,fillColor:'#dce3ea',fillOpacity:1};},
          onEachFeature:function (feature,shape) {
            shape.on('click',function () {choose(getDistrictName(feature));});
            shape.on('mouseover',function () {shape.setStyle({color:'#1b5765',weight:2.4});shape.bringToFront();});
            shape.on('mouseout',function () {restyle();});
          }
        }).addTo(state.map);
        zoomOut();
        restyle();
        var status = $('dex-map-status'); if (status) status.hidden=true;
        setTimeout(function () {state.map.invalidateSize();},100);
      } catch (e) {
        text('dex-map-status','The district map could not be displayed; reporting controls remain available.');
      }
    });
  }

  function readData(force) {
    if (!(window.google && google.script && google.script.run)) return;
    if (state.busy) return;
    if (!force && state.data && Date.now()-state.lastFetched<4*60*1000) return;
    state.busy = true;
    google.script.run.withSuccessHandler(function (payload) {
      state.busy=false;
      if (!payload || !payload.dashboard || !Array.isArray(payload.sessions)) return;
      state.data=payload;
      state.lastFetched=Date.now();
      restyle();
      renderProfile();
    }).withFailureHandler(function () {
      state.busy=false;
      text('dex-description','The statistics are temporarily unavailable. The existing district performance table remains available.');
    }).getDashboardData(force === true);
  }
  function loadGallery() {
    if (state.photosLoaded || !(window.google && google.script && google.script.run)) return;
    state.photosLoaded=true;
    google.script.run.withSuccessHandler(function (result) {
      state.photos = Array.isArray(result && result.photos) ? result.photos : [];
      renderPhotos();
    }).withFailureHandler(function () {
      state.photosLoaded=false;
      renderPhotos();
    }).nyfaGalleryList(false);
  }
  function renderPhotos() {
    var grid=$('dex-photos'), hint=$('dex-photo-note');
    if (!grid || !hint) return;
    grid.replaceChildren();
    if (!state.selected) {
      hint.textContent='Select a district to see photographs from its approved gallery album.';
      return;
    }
    var pictures=state.photos.filter(function (p) {
      return norm(p.district) === norm(state.selected) && (p.thumb || p.full);
    }).slice(-3).reverse();
    if (!pictures.length) {
      hint.textContent=SPECIAL.indexOf(state.selected)>=0 ?
        'This reporting area does not have its own geographical district album.' :
        'No approved gallery photos currently available for this district.';
      return;
    }
    pictures.forEach(function (p) {
      var img=document.createElement('img');
      img.className='dex-photo'; img.loading='lazy';
      img.src=p.thumb || p.full;
      img.alt='Approved first aid training photograph from '+state.selected;
      img.addEventListener('error',function () {
        if (img.dataset.fallback || !(window.google && google.script && google.script.run)) return;
        img.dataset.fallback='1';
        google.script.run.withSuccessHandler(function (source) {
          if(source) img.src=source;
        }).withFailureHandler(function () {}).nyfaGalleryThumbnail(p.id);
      });
      grid.appendChild(img);
    });
    hint.textContent='Approved district gallery photographs · Not necessarily from the selected session.';
  }
  function renderProfile() {
    var sel=state.selected;
    text('dex-type',sel?(SPECIAL.indexOf(sel)>=0?'Additional reporting area':'District profile'):'National overview');
    text('dex-name',sel || 'Explore Sri Lanka');
    text('dex-description',sel?(SPECIAL.indexOf(sel)>=0?
      'Separate programme reporting area; not a distinct administrative district.':
      'Official training progress and scheduled activity for '+sel+'.'):
      'Click a district on the map, or choose any of the 28 reporting areas below.');
    var a=sel?areaFor(sel):null, dashboard=state.data && state.data.dashboard || {};
    var nat=dashboard.metrics || {};
    var displayed={
      trained:a?a.trained:amount(nat.youthTrained),
      completed:a?a.completed:amount(nat.completedSessions),
      scheduled:a?a.scheduled:amount(nat.scheduledSessions),
      target:a?a.target:amount(nat.targetYouth)
    };
    // For selected areas, defer to the same visible district KPIs as the existing tab.
    // This prevents alternative interpretations of the reporting workbook data.
    if(sel && $('dpArea') && $('dpArea').value===sel) {
      [['trained','dpKTrained'],['completed','dpKCompleted'],['scheduled','dpKScheduled'],['target','dpKTarget']].forEach(function(pair){
        var node=$(pair[1]);
        if(node && node.textContent.trim() && node.textContent.trim()!=='—') {
          var val=Number(node.textContent.replace(/,/g,'').trim());
          if(isFinite(val)) displayed[pair[0]]=val;
        }
      });
    }
    text('dex-trained',nfmt(displayed.trained));
    text('dex-completed',nfmt(displayed.completed));
    text('dex-scheduled',nfmt(displayed.scheduled));
    text('dex-target',nfmt(displayed.target));
    var pct=displayed.target && displayed.trained!==null ? 100*displayed.trained/displayed.target : null;
    text('dex-coverage',pct===null?'—':pct.toFixed(1)+'%');
    $('dex-progress').style.width=(pct===null?0:Math.max(0,Math.min(100,pct)))+'%';
    var host=$('dex-sessions');host.replaceChildren();
    if (!a || !a.sessions.length) {
      var msg=document.createElement('span');msg.className='dex-mini-note';
      msg.textContent=sel?'No programme sessions currently listed for this reporting area.':'Choose a reporting area to explore its sessions.';
      host.appendChild(msg);
    } else {
      var sorted=a.sessions.slice().sort(function(x,y) {return (y.date||'').localeCompare(x.date||'');}).slice(0,4);
      sorted.forEach(function (s) {
        var row=document.createElement('div');row.className='dex-session';
        var info=document.createElement('div');
        var title=document.createElement('strong');title.textContent=(s.id||'Session')+' · '+(s.venue||'Venue pending');
        var detail=document.createElement('small');
        detail.textContent=(s.date||'Date pending')+' · '+(s.completedInRegister?'Completed':String(s.status||'Scheduled'));
        info.append(title,detail);
        var action=document.createElement('button');action.type='button';action.textContent='Details';
        action.dataset.detail=String(s.id||'');
        row.append(info,action);host.appendChild(row);
      });
    }
    renderPhotos();
  }

  function open() {
    if (!state.root || !isOpen()) return;
    if (!state.boundaries) {
      if (!$('dex-map-status').dataset.loading) {
        $('dex-map-status').dataset.loading='yes';
        text('dex-map-status','Loading Sri Lanka district boundaries…');
        loadGeo(0);
      }
    } else if (state.map) setTimeout(function () {state.map.invalidateSize();},30);
    readData(false);
    loadGallery();
    var dropdown=$('dpArea');
    if (dropdown && dropdown.value!==state.selected) reflect(dropdown.value,false);
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
  else mount();
})();
