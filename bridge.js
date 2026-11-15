/*
 * National Youth First Aid Programme — GitHub Pages read-only data bridge.
 * This file is ONLY for the external GitHub-hosted copy of index.html.
 * The existing Apps Script website and Google Sheets automations are untouched.
 *
 * Our public Apps Script URL, copied from the provided website link.
 * If the web app is redeployed at a NEW URL, update the URL below.
 */
(function (global) {
  'use strict';
  var API_URL = 'https://script.google.com/macros/s/AKfycbw5_o8mL02CWGa3vNILnP4OIe6Mmr_8q7_daVj8VYlvIvMewa9CnhqiS83QmfFSGrCU/exec';
  var sequence = 0;

  function request(resource, arguments_, onSuccess, onFailure) {
    var name = 'nyfaCallback_' + Date.now().toString(36) + '_' + (++sequence);
    var script = document.createElement('script');
    var finished = false;
    var timeout;

    function finish(error, value) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      try { delete global[name]; } catch (ignore) { global[name] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
      if (error) {
        if (typeof onFailure === 'function') onFailure(error);
        else console.error('NYFA public data connection failed:', error);
      } else if (typeof onSuccess === 'function') onSuccess(value);
    }

    global[name] = function (answer) {
      if (answer && answer.ok === true) finish(null, answer.data);
      else finish(new Error(answer && answer.error || 'Public API returned an error.'));
    };

    var target = new URL(API_URL);
    target.searchParams.set('nyfa_public', resource);
    target.searchParams.set('cb', name);
    if (arguments_.fresh) target.searchParams.set('fresh', '1');
    if (arguments_.id) target.searchParams.set('id', arguments_.id);
    // Bust browser caches for each active request.
    target.searchParams.set('_', Date.now().toString());
    script.src = target.toString();
    script.async = true;
    script.onerror = function () { finish(new Error('Could not reach the public data endpoint.')); };
    timeout = setTimeout(function () {
      finish(new Error('Public data request timed out. Check deployment settings and the API link.'));
    }, 30000);
    document.head.appendChild(script);
  }


  // A short browser cache makes REPEAT visits nearly instantaneous.
  // Only reliable dashboard responses are saved; manual Refresh bypasses it.
  // The UI labels cached results as a recent snapshot, never as a live fetch.
  var DASHBOARD_CACHE_KEY = 'nyfa-public-dashboard-cache-v1';
  var DASHBOARD_CACHE_MS = 5 * 60 * 1000; // 5 minutes maximum

  function saveDashboardSnapshot(value) {
    if (!value || !Array.isArray(value.sessions) || !value.dashboard) return;
    var mode = value.reliability && value.reliability.mode;
    if (mode !== 'live' && mode !== 'recent') return;
    try {
      global.localStorage.setItem(DASHBOARD_CACHE_KEY,
        JSON.stringify({savedMs: Date.now(), value: value}));
    } catch (ignore) { /* Storage may be full or disabled. Live fetch still works. */ }
  }

  function readDashboardSnapshot() {
    try {
      var stored = JSON.parse(global.localStorage.getItem(DASHBOARD_CACHE_KEY) || 'null');
      if (!stored || !stored.savedMs || !stored.value) return null;
      var age = Date.now() - Number(stored.savedMs);
      if (age < 0 || age > DASHBOARD_CACHE_MS) return null;
      var value = stored.value;
      if (!value.dashboard || !Array.isArray(value.sessions)) return null;
      var mode = value.reliability && value.reliability.mode;
      if (mode !== 'live' && mode !== 'recent') return null;
      // Do not overwrite the stored original: label the rendered copy as recent.
      var preview = Object.assign({}, value, {
        reliability: Object.assign({}, value.reliability, {
          mode: 'recent',
          cacheAgeSeconds: Math.max(0, Math.floor(age / 1000))
        })
      });
      return preview;
    } catch (ignore) { return null; }
  }

  // Minimal compatibility layer for the site's existing google.script.run calls.
  // Only the three read-only site methods below are exposed.
  function runner(success, failure) {
    return {
      withSuccessHandler: function (handler) { return runner(handler, failure); },
      withFailureHandler: function (handler) { return runner(success, handler); },
      getDashboardData: function (fresh) {
        if (fresh !== true) {
          var preview = readDashboardSnapshot();
          if (preview) {
            // Match the asynchronous google.script.run callback contract.
            setTimeout(function () {
              if (typeof success === 'function') success(preview);
            }, 0);
            return;
          }
        }
        request('dashboard', { fresh: fresh === true }, function (value) {
          saveDashboardSnapshot(value);
          if (typeof success === 'function') success(value);
        }, failure);
      },
      nyfaGalleryList: function (fresh) {
        request('gallery', { fresh: fresh === true }, success, failure);
      },
      nyfaGalleryThumbnail: function (id) {
        request('thumbnail', { id: String(id || '') }, success, failure);
      }
    };
  }

  if (!global.google) global.google = {};
  if (!global.google.script) global.google.script = {};
  global.google.script.run = runner();
})(window);
