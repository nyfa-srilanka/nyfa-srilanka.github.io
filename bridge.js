/*
 * NYFA GitHub Pages public data bridge, including first-visit site snapshot.
 * Previous local 5-minute cache is retained. Manual Refresh always uses
 * the live Google Apps Script endpoint; gallery behaviour is unchanged.
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
    target.searchParams.set('_', Date.now().toString());
    script.src = target.toString();
    script.async = true;
    script.onerror = function () { finish(new Error('Could not reach the public data endpoint.')); };
    timeout = setTimeout(function () {
      finish(new Error('Public data request timed out. Check deployment settings and the API link.'));
    }, 30000);
    document.head.appendChild(script);
  }

  // Fast repeat visits: retain a reliable result on this device for 5 minutes.
  var DASHBOARD_CACHE_KEY = 'nyfa-public-dashboard-cache-v1';
  var DASHBOARD_CACHE_MS = 5 * 60 * 1000;
  // Fast first visits: GitHub Actions publishes a public file periodically.
  // If 20 minutes old (e.g. Actions is delayed), use the live API instead.
  var GITHUB_SNAPSHOT_MAX_AGE_MS = 120 * 60 * 1000;

  function safeData(value) {
    if (!value || !Array.isArray(value.sessions) || !value.dashboard) return false;
    var mode = value.reliability && value.reliability.mode;
    return mode === 'live' || mode === 'recent';
  }

  function saveDashboardSnapshot(value) {
    if (!safeData(value)) return;
    try {
      global.localStorage.setItem(DASHBOARD_CACHE_KEY,
        JSON.stringify({ savedMs: Date.now(), value: value }));
    } catch (ignore) { /* Storage may be disabled; live fetch still works. */ }
  }

  function labelRecent(value, ageSeconds) {
    return Object.assign({}, value, {
      reliability: Object.assign({}, value.reliability, {
        mode: 'recent', cacheAgeSeconds: Math.max(0, Math.floor(ageSeconds))
      })
    });
  }

  function readDashboardSnapshot() {
    try {
      var stored = JSON.parse(global.localStorage.getItem(DASHBOARD_CACHE_KEY) || 'null');
      if (!stored || !stored.savedMs || !safeData(stored.value)) return null;
      var age = Date.now() - Number(stored.savedMs);
      if (age < 0 || age > DASHBOARD_CACHE_MS) return null;
      return labelRecent(stored.value, age / 1000);
    } catch (ignore) { return null; }
  }

  function readGitHubSnapshot(onSuccess, onFailure) {
    if (typeof global.fetch !== 'function') { onFailure(); return; }
    global.fetch('./dashboard-snapshot.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('Snapshot not found');
        return res.json();
      })
      .then(function (snapshot) {
        var age = Date.now() - Date.parse(snapshot && snapshot.generatedAt);
        if (!Number.isFinite(age) || age < -60000 || age > GITHUB_SNAPSHOT_MAX_AGE_MS ||
            !safeData(snapshot.data)) throw new Error('Snapshot outdated');
        onSuccess(labelRecent(snapshot.data, age / 1000));
      })
      .catch(function () { onFailure(); });
  }

  function runner(success, failure) {
    return {
      withSuccessHandler: function (handler) { return runner(handler, failure); },
      withFailureHandler: function (handler) { return runner(success, handler); },
      getDashboardData: function (fresh) {
        function live() {
          request('dashboard', { fresh: fresh === true }, function (value) {
            saveDashboardSnapshot(value);
            if (typeof success === 'function') success(value);
          }, failure);
        }
        if (fresh === true) { live(); return; }
        var preview = readDashboardSnapshot();
        if (preview) {
          setTimeout(function () {
            if (typeof success === 'function') success(preview);
          }, 0);
          return;
        }
        // No device cache (new visitor): try the fast GitHub-hosted snapshot.
        readGitHubSnapshot(function (value) {
          saveDashboardSnapshot(value);
          if (typeof success === 'function') success(value);
        }, live);
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
