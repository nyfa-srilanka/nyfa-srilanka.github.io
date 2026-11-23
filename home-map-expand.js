/* NYFA Home Map Expand v1 — presentation-only enhancement.
 * Enlarges the existing homepage Leaflet map in place (no replacement map,
 * no changes to coordinates, filters, snapshots or session status).
 * Roll back by removing the script tag from index.html.
 */
(function () {
  'use strict';
  var CSS_ID = 'nyfa-home-map-expand-style';
  var BUTTON_ID = 'nyfa-home-map-expand-button';
  function initialize() {
    var panel = document.querySelector('#sec-overview .home-map-panel');
    var header = panel && panel.querySelector('.panel-h');
    var map = panel && panel.querySelector('#leafletHomeMap');
    if (!panel || !header || !map || document.getElementById(BUTTON_ID)) return;

    if (!document.getElementById(CSS_ID)) {
      var css = document.createElement('style');
      css.id = CSS_ID;
      css.textContent = `
        /* Slightly easier to explore before expanding, on all screen sizes. */
        #sec-overview #leafletHomeMap { min-height:390px; }
        #sec-overview .home-map-panel .panel-h { flex-wrap:wrap; }
        .nyfa-expand-home-map {
          appearance:none; border:1px solid #b9ded9; border-radius:9px;
          background:#eaf8f5; color:#096f6a; font:800 11px/1.3 Manrope,'DM Sans',sans-serif;
          padding:9px 12px; cursor:pointer; white-space:nowrap;
        }
        .nyfa-expand-home-map:hover { background:#d8f2ed; border-color:#6fc8bb; }
        .nyfa-expand-home-map:focus-visible {outline:3px solid #2faaa0; outline-offset:3px;}
        body.nyfa-home-map-expanded { overflow:hidden !important; }
        body.nyfa-home-map-expanded #sec-overview .home-map-panel {
          position:fixed!important; inset:12px!important; margin:0!important;
          z-index:100000!important; display:flex!important; flex-direction:column!important;
          overflow:auto!important; padding:20px!important; background:#fff!important;
          border-radius:18px!important; box-shadow:0 0 0 100vmax rgba(8,28,42,.68),0 22px 70px rgba(8,28,42,.28)!important;
        }
        body.nyfa-home-map-expanded #sec-overview .home-map-panel .panel-h { flex:0 0 auto; }
        body.nyfa-home-map-expanded #sec-overview .home-map-grid {
          flex:1 1 auto!important; min-height:0!important;
          display:grid!important; grid-template-columns:minmax(0,1fr) minmax(165px,240px)!important;
        }
        body.nyfa-home-map-expanded #sec-overview #leafletHomeMap {
          height:100%!important; min-height:350px!important;
        }
        body.nyfa-home-map-expanded #sec-overview .home-map-side { padding:15px!important; }
        body.nyfa-home-map-expanded #sec-overview .map-disclaimer {flex:0 0 auto;}
        body.nyfa-home-map-expanded #leafletHomeMap .leaflet-control-zoom a {
          width:40px; height:40px; line-height:40px; font-size:22px;
        }
        @media(max-width:720px){
          #sec-overview #leafletHomeMap {min-height:340px;}
          body.nyfa-home-map-expanded #sec-overview .home-map-panel {
            inset:5px!important; padding:12px!important; border-radius:12px!important;
          }
          body.nyfa-home-map-expanded #sec-overview .home-map-grid {
            display:flex!important; flex-direction:column!important; gap:9px!important;
          }
          body.nyfa-home-map-expanded #sec-overview #leafletHomeMap {
            flex:1 1 auto!important; min-height:46vh!important;
          }
          body.nyfa-home-map-expanded #sec-overview .home-map-side {
            flex:0 0 auto!important; padding:9px 12px!important; gap:4px!important;
          }
          body.nyfa-home-map-expanded #sec-overview .home-map-side p,
          body.nyfa-home-map-expanded #sec-overview .home-map-cta {display:none!important;}
          body.nyfa-home-map-expanded #sec-overview .home-map-count {font-size:23px!important;}
        }
        @media(prefers-reduced-motion:reduce){
          .nyfa-expand-home-map {transition:none!important;}
        }
      `;
      document.head.appendChild(css);
    }

    var button = document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.className = 'nyfa-expand-home-map';
    button.textContent = '⤢ Expand map';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'leafletHomeMap');
    button.setAttribute('aria-label', 'Expand homepage training map');
    var previousFocus = null;
    var oldOverflow = '';
    function updateLeafletSize() {
      // Leaflet automatically listens for window resize and recalculates its view.
      // A second event handles the new fixed-position dimensions after layout.
      window.dispatchEvent(new Event('resize'));
      window.requestAnimationFrame(function () {
        window.dispatchEvent(new Event('resize'));
      });
    }
    function close() {

      document.body.classList.remove('nyfa-home-map-expanded');
      document.body.style.overflow = oldOverflow;
      button.textContent = '⤢ Expand map';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Expand homepage training map');
      updateLeafletSize();
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
      else button.focus();
    }
    function open() {
      if (document.body.classList.contains('nyfa-home-map-expanded')) return;
      previousFocus = document.activeElement;
      oldOverflow = document.body.style.overflow;
      document.body.classList.add('nyfa-home-map-expanded');
      document.body.style.overflow = 'hidden';
      button.textContent = '✕ Close expanded map';
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('aria-label', 'Close expanded homepage map');
      updateLeafletSize();
      button.focus();
    }
    button.addEventListener('click', function () {
      if (document.body.classList.contains('nyfa-home-map-expanded')) close();
      else open();
    });
    // The homepage normally keeps wheel zoom disabled so page scrolling is easy.
    // In expanded mode only, use the existing Leaflet +/- controls for wheel zoom.
    var wheelLast = 0;
    map.addEventListener('wheel', function (event) {
      if (!document.body.classList.contains('nyfa-home-map-expanded')) return;
      if (event.target && event.target.closest && event.target.closest('.leaflet-popup-content-wrapper')) return;
      event.preventDefault();
      if (Math.abs(event.deltaY) < 2) return;
      var now = Date.now();
      if (now - wheelLast < 175) return;
      wheelLast = now;
      var control = map.querySelector(event.deltaY < 0 ? '.leaflet-control-zoom-in' : '.leaflet-control-zoom-out');
      if (control && control.getAttribute('aria-disabled') !== 'true') control.click();
    }, {passive: false});
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && document.body.classList.contains('nyfa-home-map-expanded')) {
        event.preventDefault(); close();
      }
    });
    // Keep the original "View full map" button and heading intact.
    header.appendChild(button);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
