/*
 * National Youth First Aid Programme — Smart Venue Map v1.0
 * Replaces the numbered Leaflet marker clusters with venue-level markers.
 * National zoom: small status-coloured dots. Local zoom: detailed location pins.
 * Multiple training sessions at one published coordinate share one information card.
 * No changes to Sheets, Google Apps Script, dashboard metrics, filters or gallery.
 * Remove this script tag to restore the original marker clusters.
 */
(function (global, document) {
  'use strict';
  if (global.__NYFA_SMART_MAP_V1__) return;
  global.__NYFA_SMART_MAP_V1__ = true;

  var ZOOM_PINS = 10;
  var COLORS = {
    completed: '#14936d', upcoming: '#118db3', overdue: '#e49a31',
    unreported: '#dc7c43', postponed: '#8f70ca', cancelled: '#788798',
    undated: '#6b859b', mixed: '#254b67'
  };
  var LABELS = {
    completed: 'Completed', upcoming: 'Upcoming', overdue: 'Past date · unconfirmed',
    unreported: 'Report pending', postponed: 'Postponed',
    cancelled: 'Cancelled', undated: 'Date not confirmed', mixed: 'Mixed statuses'
  };

  function escapeText(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  }
  function plural(count, singular, pluralWord) {
    return count + ' ' + (count === 1 ? singular : (pluralWord || singular + 's'));
  }
  function statusOf(marker) {
    var cls = marker.options && marker.options.icon && marker.options.icon.options &&
      marker.options.icon.options.className || '';
    var m = String(cls).match(/\bmap-status-(completed|upcoming|overdue|unreported|postponed|cancelled|undated)\b/);
    return m ? m[1] : 'undated';
  }
  function detailsOf(marker) {
    var template = document.createElement('div');
    var popup = marker.getPopup && marker.getPopup();
    template.innerHTML = popup && typeof popup.getContent === 'function' ?
      String(popup.getContent() || '') : '';
    var title = template.querySelector('.map-popup-title');
    var lines = template.querySelector('.map-popup-line');
    var directions = template.querySelector('.map-popup-action');
    var venue = String(marker.options && marker.options.title || '').split(' · ')[0].trim() || 'Training venue';
    var lineParts = [];
    if (lines) {
      lines.childNodes.forEach(function (node) {
        if (node.nodeType === 3) {
          var val = node.textContent.trim();
          if (val) lineParts.push(val);
        }
      });
    }
    var href = directions && directions.getAttribute('href') || '';
    if (!/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/i.test(href)) href = '';
    return {
      venue: venue, session: title && title.textContent.trim() || 'Training session',
      line: lineParts, date: lineParts.length ? lineParts[lineParts.length - 1] : '',
      state: statusOf(marker), href: href
    };
  }
  function injectStyles() {
    if (document.getElementById('nyfa-smart-map-styles')) return;
    var node = document.createElement('style');
    node.id = 'nyfa-smart-map-styles';
    node.textContent = [
      '.nyfa-smart-pin-icon{background:transparent!important;border:0!important}',
      '.nyfa-smart-pin{position:relative;width:36px;height:44px;filter:drop-shadow(0 3px 5px rgba(14,40,60,.28))}',
      '.nyfa-smart-pin-shape{position:absolute;left:4px;top:2px;width:28px;height:28px;transform:rotate(-45deg);border-radius:50% 50% 50% 5px;background:var(--nyfa-color);border:2.5px solid #fff}',
      '.nyfa-smart-pin-center{position:absolute;top:10px;left:12px;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 3px rgba(0,0,0,.07)}',
      '.nyfa-smart-pin-count{position:absolute;right:-3px;top:-6px;min-width:19px;height:19px;padding:0 3px;border-radius:10px;background:#173a53;color:#fff;border:2px solid white;display:grid;place-items:center;font:700 9px/1 Manrope,sans-serif;box-shadow:0 2px 5px #001b2533}',
      '.nyfa-smart-dot:focus-visible,.nyfa-smart-pin-icon:focus-visible{outline:3px solid #132d45;outline-offset:3px}',
      '.nyfa-smart-popup .leaflet-popup-content{margin:13px 14px;width:min(310px,calc(100vw - 85px))!important;font:12px/1.5 "DM Sans",sans-serif}',
      '.nyfa-venue-header{border-bottom:1px solid #e5eef1;padding:0 0 10px;margin-bottom:10px}',
      '.nyfa-venue-eyebrow{font:800 9px Manrope,sans-serif;letter-spacing:1.3px;color:#188a86;text-transform:uppercase;margin-bottom:5px}',
      '.nyfa-venue-name{margin:0;color:#173a50;font:800 15px/1.3 Manrope,sans-serif;overflow-wrap:anywhere}',
      '.nyfa-venue-summary{color:#688091;font-size:11px;margin-top:6px}',
      '.nyfa-venue-list{max-height:240px;overflow:auto;display:grid;gap:7px;padding-right:3px}',
      '.nyfa-venue-session{background:#f7fafb;border:1px solid #e8eef2;padding:8px 9px;border-radius:9px}',
      '.nyfa-venue-session-top{display:flex;align-items:center;justify-content:space-between;gap:6px}',
      '.nyfa-venue-session-title{font-weight:800;font-size:11px;color:#29465b;overflow-wrap:anywhere}',
      '.nyfa-venue-status{display:inline-flex;flex-shrink:0;align-items:center;gap:4px;font-size:9px;font-weight:700;color:#637888}',
      '.nyfa-venue-status::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--nyfa-color)}',
      '.nyfa-venue-date{font-size:10px;color:#7a8d98;margin-top:4px}',
      '.nyfa-venue-note{font-size:10px;color:#9a6b31;background:#fff9ed;padding:7px 9px;border-radius:8px;margin:10px 0 0}',
      '.nyfa-venue-directions{display:inline-flex;text-decoration:none;margin-top:12px;background:#0d8983;color:#fff!important;padding:8px 11px;border-radius:8px;font-size:10px;font-weight:800}',
      '@media(max-width:600px){.nyfa-smart-popup .leaflet-popup-content{width:min(272px,calc(100vw - 82px))!important}.nyfa-venue-list{max-height:190px}.nyfa-smart-pin{transform:scale(.93)}}',
      '@media(prefers-reduced-motion:reduce){.nyfa-smart-pin,.nyfa-smart-dot{transition:none!important}}'
    ].join('\n');
    document.head.appendChild(node);
  }
  function createPopup(record) {
    var entries = record.entries;
    var names = [];
    entries.forEach(function (e) { if (names.indexOf(e.venue) === -1) names.push(e.venue); });
    var sameVenue = names.length === 1;
    var heading = sameVenue ? names[0] : 'Shared mapped location';
    var counts = {};
    entries.forEach(function (e) { counts[e.state] = (counts[e.state] || 0) + 1; });
    var chips = Object.keys(counts).map(function (s) {
      return counts[s] + ' ' + LABELS[s].toLowerCase();
    }).join(' · ');
    var html = '<div class="nyfa-venue-header"><div class="nyfa-venue-eyebrow">Training location</div>' +
      '<h3 class="nyfa-venue-name">' + escapeText(heading) + '</h3>' +
      '<div class="nyfa-venue-summary">' + plural(entries.length, 'session') + ' · ' + escapeText(chips) + '</div></div>' +
      '<div class="nyfa-venue-list">';
    entries.forEach(function (e) {
      html += '<div class="nyfa-venue-session"><div class="nyfa-venue-session-top"><span class="nyfa-venue-session-title">' +
        escapeText(e.session) + '</span><span class="nyfa-venue-status" style="--nyfa-color:' + COLORS[e.state] + '">' +
        escapeText(LABELS[e.state]) + '</span></div>' +
        (sameVenue ? '' : '<div class="nyfa-venue-date">' + escapeText(e.venue) + '</div>') +
        (e.date ? '<div class="nyfa-venue-date">' + escapeText(e.date) + '</div>' : '') + '</div>';
    });
    html += '</div>';
    if (!sameVenue) {
      html += '<div class="nyfa-venue-note">Different venue names share these published coordinates. Verify the mapped locations.</div>';
    }
    if (entries[0] && entries[0].href) {
      html += '<a class="nyfa-venue-directions" href="' + escapeText(entries[0].href) +
        '" target="_blank" rel="noopener noreferrer">Navigate to mapped location ↗</a>';
    }
    return html;
  }

  function install(leaflet) {
    if (!leaflet || typeof leaflet.Layer !== 'function' ||
        typeof leaflet.Layer.extend !== 'function' || !leaflet.layerGroup || !leaflet.divIcon) return false;
    if (leaflet.__NYFA_SMART_MAP_PATCHED__) return true;
    injectStyles();

    var Group = leaflet.Layer.extend({
      initialize: function () {
        this._sessions = [];
        this._presentations = leaflet.layerGroup();
        this._map = null;
        this._queued = false;
        this._markerToPresentation = new WeakMap();
        this._pendingOpen = null;
      },
      onAdd: function (map) {
        this._map = map;
        this._presentations.addTo(map);
        map.on('zoomend', this._scheduleRefresh, this);
        this._scheduleRefresh();
      },
      onRemove: function (map) {
        map.off('zoomend', this._scheduleRefresh, this);
        map.removeLayer(this._presentations);
        this._map = null;
      },
      addLayer: function (marker) {
        if (!marker || typeof marker.getLatLng !== 'function') return this;
        this._sessions.push(marker);
        var self = this;
        // Session-table "Show pin" opens the correct grouped venue card.
        marker.openPopup = function () {
          var shown = self._markerToPresentation.get(marker);
          if (shown) shown.openPopup();
          return marker;
        };
        this._scheduleRefresh();
        return this;
      },
      clearLayers: function () {
        this._sessions = [];
        this._pendingOpen = null;
        this._markerToPresentation = new WeakMap();
        this._presentations.clearLayers();
        return this;
      },
      getLayers: function () { return this._sessions.slice(); },
      hasLayer: function (marker) { return this._sessions.indexOf(marker) !== -1; },
      zoomToShowLayer: function (marker, callback) {
        if (!this._map || !marker) { if (callback) callback(); return this; }
        this._map.setView(marker.getLatLng(), Math.max(this._map.getZoom(), ZOOM_PINS + 1), {animate: false});
        this._refresh();
        if (callback) callback();
        return this;
      },
      _scheduleRefresh: function () {
        if (this._queued || !this._map) return;
        this._queued = true;
        var self = this;
        global.requestAnimationFrame(function () {
          self._queued = false;
          if (self._map) self._refresh();
        });
      },
      _refresh: function () {
        if (!this._map) return;
        var lowZoom = this._map.getZoom() < ZOOM_PINS;
        var dict = new Map();
        this._sessions.forEach(function (marker) {
          var ll = marker.getLatLng();
          if (!ll || !Number.isFinite(ll.lat) || !Number.isFinite(ll.lng)) return;
          // Same published coordinate = same map marker. Never claim two
          // differently named venues are identical: flag this in the popup.
          var key = ll.lat.toFixed(5) + ':' + ll.lng.toFixed(5);
          var record = dict.get(key);
          if (!record) {
            record = {key: key, latlng: ll, entries: [], markers: []};
            dict.set(key, record);
          }
          record.markers.push(marker);
          record.entries.push(detailsOf(marker));
        });
        var self = this;
        this._presentations.clearLayers();
        this._markerToPresentation = new WeakMap();
        dict.forEach(function (record) {
          var unique = {};
          record.entries.forEach(function (e) { unique[e.state] = true; });
          var states = Object.keys(unique);
          var state = states.length === 1 ? states[0] : 'mixed';
          var colour = COLORS[state];
          var shown;
          if (lowZoom) {
            shown = leaflet.circleMarker(record.latlng, {
              radius: 6.5, color: '#fff', weight: 2.3, fillColor: colour,
              fillOpacity: 0.95, opacity: 1, className: 'nyfa-smart-dot'
            });
            shown.on('click', function () {
              // A national dot reveals a full pin and its sessions on click.
              self._pendingOpen = record.key;
              var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
              self._map.setView(record.latlng, Math.max(ZOOM_PINS + 1, self._map.getZoom()),
                {animate: !reduce});
              self._scheduleRefresh();
            });
          } else {
            var count = record.entries.length;
            var content = '<div class="nyfa-smart-pin" style="--nyfa-color:' + colour + '">' +
              '<span class="nyfa-smart-pin-shape"></span><span class="nyfa-smart-pin-center"></span>' +
              (count > 1 ? '<span class="nyfa-smart-pin-count">' + (count > 99 ? '99+' : count) + '</span>' : '') +
              '</div>';
            shown = leaflet.marker(record.latlng, {
              title: plural(count, 'session') + ' · ' + record.entries[0].venue,
              icon: leaflet.divIcon({className: 'nyfa-smart-pin-icon', html: content,
                iconSize: [36, 44], iconAnchor: [18, 41], popupAnchor: [0, -34]})
            });
          }
          shown.bindPopup(createPopup(record), {className: 'nyfa-smart-popup', maxWidth: 345, autoPanPadding: [18, 18]});
          shown.bindTooltip((record.entries.length > 1 ? record.entries.length + ' sessions · ' : '') +
            escapeText(record.entries[0].venue), {direction: 'top', offset: [0, -8]});
          self._presentations.addLayer(shown);
          record.markers.forEach(function (marker) { self._markerToPresentation.set(marker, shown); });
          if (!lowZoom && self._pendingOpen === record.key) {
            self._pendingOpen = null;
            global.requestAnimationFrame(function () { if (self._map) shown.openPopup(); });
          }
        });
      }
    });

    function groupFactory() { return new Group(); }
    // Prevent markercluster (loaded afterwards) from replacing this map style.
    // All other Leaflet features and map data remain untouched.
    try {
      Object.defineProperty(leaflet, 'markerClusterGroup', {
        enumerable: true, configurable: true,
        get: function () { return groupFactory; },
        set: function () { /* Original clustering deliberately disabled. */ }
      });
    } catch (ignore) {
      leaflet.markerClusterGroup = groupFactory;
    }
    leaflet.__NYFA_SMART_MAP_PATCHED__ = true;
    return true;
  }

  function updateMapExplanations() {
    // Keep existing map guidance accurate without changing index.html.
    var footnote = document.querySelector('#sec-locations .footnote');
    if (footnote && footnote.innerHTML.indexOf('click a cluster to expand its pins') >= 0) {
      footnote.innerHTML = footnote.innerHTML.replace('click a cluster to expand its pins',
        'click a dot or pin to explore the sessions mapped there');
    }
    ['.map-legend-panel', '.home-map-legend'].forEach(function (selector) {
      var legend = document.querySelector(selector);
      if (!legend || legend.querySelector('.nyfa-smart-mixed-legend')) return;
      var entry = document.createElement('span');
      entry.className = 'map-legend-entry nyfa-smart-mixed-legend';
      entry.innerHTML = '<i class="map-swatch" style="background:#254b67"></i>Mixed statuses';
      legend.appendChild(entry);
    });

    [['homeMapDescription', /Pins use your published coordinates, coloured by schedule \/ completion status\. Click a cluster to explore overlapping sessions\./,
      'Dots become venue pins as you zoom in. A pin can show several sessions at the same mapped location.'],
     ['mapInfo', /Clusters represent multiple sessions, sometimes at one venue\./,
      'Each dot or pin represents a published coordinate and can contain multiple training sessions.']]
      .forEach(function (entry) {
        var node = document.getElementById(entry[0]);
        if (!node) return;
        var update = function () {
          if (entry[1].test(node.textContent)) node.textContent = node.textContent.replace(entry[1], entry[2]);
        };
        update();
        new MutationObserver(update).observe(node, {childList: true, characterData: true, subtree: true});
      });
  }

  // The site's Leaflet JS is lazy-loaded when a map enters view.
  // Patch immediately when its global is assigned, before the site's
  // existing mapCreateLayer() function constructs either of the maps.
  var descriptor = Object.getOwnPropertyDescriptor(global, 'L');
  if (!descriptor || descriptor.configurable) {
    var value = global.L;
    try {
      Object.defineProperty(global, 'L', {
        configurable: true, enumerable: true,
        get: function () { return value; },
        set: function (newValue) { value = newValue; install(newValue); }
      });
    } catch (error) { /* Fall back to script load listener below. */ }
    if (value) install(value);
  } else if (global.L) install(global.L);
  document.addEventListener('load', function (event) {
    var src = event.target && event.target.src || '';
    if (/leaflet(?:\.markercluster)?(?:\.min)?\.js/i.test(src)) install(global.L);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateMapExplanations);
  else updateMapExplanations();
})(window, document);
