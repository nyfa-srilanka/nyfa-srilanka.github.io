/* NYFA public data bridge — dashboard and approved photos via GitHub Pages only.
 * No spreadsheet writes. No Google account required for dashboard or gallery.
 */
(function (global) {
  'use strict';
  var CACHE_KEY = 'nyfa-public-verified-snapshot-v2';
  var RECENT_MS = 2 * 60 * 60 * 1000;
  var inFlight = null, lastGood = null;

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

  // Only current, same-origin photos from the server-published approved manifest.
  // No persistence of photo lists in localStorage; no browser-side Google requests.
  var galleryInFlight = null, currentGallery = null;
  function photoPath(value, id, size) {
    return typeof value === 'string' && new RegExp('^\\./photo-assets/' + id + '-[a-f0-9]{16}-' + size + '\\.jpg$').test(value);
  }
  function fetchGallery() {
    if (galleryInFlight) return galleryInFlight;
    galleryInFlight = new Promise(function(resolve, reject) {
      var controller = typeof global.AbortController === 'function' ? new global.AbortController() : null;
      var timer = setTimeout(function(){ if(controller)controller.abort(); reject(new Error('Photo gallery request timed out.')); }, 12000);
      var options = {cache:'no-store', credentials:'omit'};
      if(controller)options.signal=controller.signal;
      global.fetch('./gallery-snapshot.json', options).then(function(res){
        if(!res.ok)throw new Error('Published photo gallery unavailable.');
        return res.json();
      }).then(function(data){
        if(!data || data.available !== true || !Array.isArray(data.photos))throw new Error('Approved photographs are temporarily unavailable.');
        var valid = data.photos.every(function(p){
          return p && typeof p.id === 'string' && /^[a-f0-9]{24}$/.test(p.id) && typeof p.district === 'string' && photoPath(p.full,p.id,'full') && photoPath(p.thumb,p.id,'thumb');
        });
        if(!valid)throw new Error('Photo manifest failed validation.');
        clearTimeout(timer);resolve(data);
      }).catch(function(error){clearTimeout(timer);reject(error);});
    }).then(function(data){galleryInFlight=null;currentGallery=data;return data;},function(error){galleryInFlight=null;currentGallery=null;throw error;});
    return galleryInFlight;
  }
  function gallery(success,failure){
    fetchGallery().then(function(data){if(typeof success==='function')success(data);},function(err){if(typeof failure==='function')failure(err);});
  }
  function thumbnail(id,success,failure){
    var pending = currentGallery ? Promise.resolve(currentGallery) : fetchGallery();
    pending.then(function(data){
      var p=data.photos.find(function(p){return p.id===String(id||'');});
      if(p){if(typeof success==='function')success(p.thumb);}
      else if(typeof failure==='function')failure(new Error('Photo is not in the approved gallery.'));
    },function(err){if(typeof failure==='function')failure(err);});
  }

  function runner(success, failure) {
    return {
      withSuccessHandler: function (handler) { return runner(handler, failure); },
      withFailureHandler: function (handler) { return runner(success, handler); },
      getDashboardData: function () { dashboard(success, failure); },
      nyfaGalleryList: function () { gallery(success, failure); },
      nyfaGalleryThumbnail: function (id) { thumbnail(id, success, failure); }
    };
  }
  if (!global.google) global.google = {};
  if (!global.google.script) global.google.script = {};
  global.google.script.run = runner();
})(window);
