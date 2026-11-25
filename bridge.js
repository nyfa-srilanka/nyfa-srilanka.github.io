/* NYFA public data bridge — dashboard via GitHub Pages only.
 * Gallery retains its existing approved Google API until separately migrated.
 * No spreadsheet writes. No Google account required for dashboard figures.
 */
(function (global) {
  'use strict';
  var API_URL = 'https://script.google.com/macros/s/AKfycbw5_o8mL02CWGa3vNILnP4OIe6Mmr_8q7_daVj8VYlvIvMewa9CnhqiS83QmfFSGrCU/exec';
  var CACHE_KEY = 'nyfa-public-verified-snapshot-v2';
  var RECENT_MS = 2 * 60 * 60 * 1000;
  var sequence = 0, inFlight = null, lastGood = null;

  function safeSnapshot(s) {
    return !!(s && Number.isFinite(Date.parse(s.generatedAt)) && s.data &&
      Array.isArray(s.data.sessions) && s.data.dashboard &&
      s.data.reliability && ['live', 'recent'].indexOf(s.data.reliability.mode) >= 0);
  }
  function storedSnapshot() {
    try {
      var s = JSON.parse(global.localStorage.getItem(CACHE_KEY) || 'null');
      return safeSnapshot(s) ? s : null;
    } catch (ignore) { return null; }
  }
  function newest(a, b) {
    if (!a) return b;
    if (!b) return a;
    return Date.parse(a.generatedAt) >= Date.parse(b.generatedAt) ? a : b;
  }
  function remember(s) {
    lastGood = newest(newest(lastGood, storedSnapshot()), s);
    try { global.localStorage.setItem(CACHE_KEY, JSON.stringify(lastGood)); } catch (ignore) {}
    return lastGood;
  }
  function sourceTime(value) {
    var s = String(value || '').trim();
    // The existing API emits a Sri Lanka wall-clock timestamp without an offset.
    if (/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d$/.test(s)) {
      s = s.replace(' ', 'T') + '+05:30';
    }
    return Date.parse(s);
  }
  function label(s, fallback) {
    var stamp = Date.parse(s.generatedAt);
    var fetched = sourceTime(s.data.fetchedAt);
    var oldest = Number.isFinite(fetched) ? Math.min(stamp, fetched) : stamp;
    var elapsed = Date.now() - oldest;
    var publishedAge = Date.now() - stamp;
    var sourceAge = Date.now() - fetched;
    var unknownClock = publishedAge < -60000 || (Number.isFinite(fetched) && sourceAge < -60000);
    var stale = fallback || unknownClock || !Number.isFinite(fetched) || elapsed > RECENT_MS;
    return Object.assign({}, s.data, {
      reliability: Object.assign({}, s.data.reliability, {
        mode: stale ? 'cached' : 'recent',
        publicSnapshot: true,
        sourceAsOf: s.data.fetchedAt || s.generatedAt,
        snapshotPublishedAt: s.generatedAt,
        cacheAgeSeconds: Math.max(0, Math.floor(elapsed / 1000)),
        snapshotFallback: !!fallback
      })
    });
  }
  function fetchSnapshot() {
    if (inFlight) return inFlight;
    inFlight = new Promise(function (resolve, reject) {
      if (typeof global.fetch !== 'function') { reject(new Error('Snapshot retrieval unavailable.')); return; }
      var controller = typeof global.AbortController === 'function' ? new global.AbortController() : null;
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        if (controller) controller.abort();
        reject(new Error('Published snapshot request timed out.'));
      }, 10000);
      function finish(err, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err); else resolve(value);
      }
      var options = { cache: 'no-store', credentials: 'omit' };
      if (controller) options.signal = controller.signal;
      global.fetch('./dashboard-snapshot.json', options).then(function (res) {
        if (!res.ok) throw new Error('Published snapshot unavailable (HTTP ' + res.status + ').');
        return res.json();
      }).then(function (s) {
        if (!safeSnapshot(s)) throw new Error('Published snapshot failed validation.');
        finish(null, s);
      }).catch(function (error) { finish(error); });
    }).then(function (s) { inFlight = null; return s; }, function (err) { inFlight = null; throw err; });
    return inFlight;
  }
  function dashboard(success, failure) {
    fetchSnapshot().then(function (s) {
      var selected = remember(s);
      var olderResponse = Date.parse(selected.generatedAt) > Date.parse(s.generatedAt);
      if (typeof success === 'function') success(label(selected, olderResponse));
    }, function (error) {
      var backup = newest(lastGood, storedSnapshot());
      if (backup) {
        lastGood = backup;
        if (typeof success === 'function') success(label(backup, true));
      } else if (typeof failure === 'function') failure(error);
    });
  }

  // Existing gallery transport retained; no changes to photo approval rules.
  function request(resource, arguments_, onSuccess, onFailure) {
    var name = 'nyfaCallback_' + Date.now().toString(36) + '_' + (++sequence);
    var script = document.createElement('script');
    var finished = false, timeout;
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
    script.onerror = function () { finish(new Error('Could not reach the public photo endpoint.')); };
    timeout = setTimeout(function () { finish(new Error('Public photo request timed out.')); }, 30000);
    document.head.appendChild(script);
  }
  function runner(success, failure) {
    return {
      withSuccessHandler: function (handler) { return runner(handler, failure); },
      withFailureHandler: function (handler) { return runner(success, handler); },
      getDashboardData: function () { dashboard(success, failure); },
      nyfaGalleryList: function (fresh) { request('gallery', { fresh: fresh === true }, success, failure); },
      nyfaGalleryThumbnail: function (id) { request('thumbnail', { id: String(id || '') }, success, failure); }
    };
  }
  if (!global.google) global.google = {};
  if (!global.google.script) global.google.script = {};
  global.google.script.run = runner();
})(window);
