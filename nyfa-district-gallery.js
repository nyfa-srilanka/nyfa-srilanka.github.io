/* NYFA District Album Gallery v2 — uses the existing Drive/Apps Script gallery API.
 * Replaces the on-screen individual-photo list with one collage cover per district.
 * Does not change Google Drive, the Apps Script API, or dashboard data.
 */
(function () {
  'use strict';

  function start() {
    var section = document.getElementById('sec-gallery');
    if (!section || document.getElementById('nyfa-albums-v2')) return;

    var css = document.createElement('style');
    css.textContent = `
      #sec-gallery.nyfa-albums-enabled .nyg-tools,
      #sec-gallery.nyfa-albums-enabled #nyg-grid,
      #sec-gallery.nyfa-albums-enabled #nyg-message,
      #sec-gallery.nyfa-albums-enabled #nyg-more { display: none !important; }
      #nyfa-albums-v2 { margin-top: 18px; color: #1d3447; }
      #nyfa-albums-v2 .na-toolbar { display: flex; flex-wrap: wrap; align-items: center;
        justify-content: space-between; gap: 12px; margin: 14px 0 20px; }
      #nyfa-albums-v2 .na-title { font-size: 17px; font-weight: 800; }
      #nyfa-albums-v2 .na-description { font-size: 12px; color: #5d7385; margin-top: 3px; }
      #nyfa-albums-v2 .na-actions { display: flex; gap: 9px; flex-wrap: wrap; }
      #nyfa-albums-v2 button { font: inherit; cursor: pointer; }
      #nyfa-albums-v2 .na-action { background: #fff; color: #1b486d; font-size: 13px;
        font-weight: 700; padding: 10px 14px; border: 1px solid #cad7e2; border-radius: 10px; }
      #nyfa-albums-v2 .na-action:hover { background: #f3f8fc; }
      #nyfa-albums-v2 [hidden] { display: none !important; }
      #nyfa-albums-v2 .na-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 18px; }
      #nyfa-albums-v2 .na-card { min-width:0; display: flex; flex-direction: column; padding:0;
        overflow: hidden; text-align: left; background: #fff; color: #1c3447;
        border: 1px solid #dce6ee; border-radius: 18px; box-shadow: 0 5px 18px #183e520b;
        transition: transform .15s, box-shadow .15s; }
      #nyfa-albums-v2 .na-card:hover { transform: translateY(-3px); box-shadow: 0 12px 27px #183e521b; }
      #nyfa-albums-v2 .na-card:focus-visible, #nyfa-albums-v2 .na-action:focus-visible { outline: 3px solid #176da8; outline-offset: 3px; }
      #nyfa-albums-v2 .na-collage { aspect-ratio: 1.48; display: grid; min-width:0;
        grid-template-columns: repeat(2,minmax(0,1fr)); grid-template-rows: repeat(2,minmax(0,1fr));
        gap: 3px; background: #d9e4ec; overflow:hidden; }
      #nyfa-albums-v2 .na-collage img { display:block; width:100%; height:100%; min-width:0;
        min-height:0; object-fit: cover; background:#e2eaf0; }
      #nyfa-albums-v2 .na-collage.na-count-1 img:first-child { grid-column: 1 / 3; grid-row: 1 / 3; }
      #nyfa-albums-v2 .na-collage.na-count-2 img { grid-row: 1 / 3; }
      #nyfa-albums-v2 .na-collage.na-count-3 img:first-child { grid-row: 1 / 3; }
      #nyfa-albums-v2 .na-caption { display:flex; justify-content:space-between; align-items:center;
        gap:10px; padding: 15px 15px 17px; }
      #nyfa-albums-v2 .na-caption strong { font-size:15px; font-weight:800; }
      #nyfa-albums-v2 .na-caption span { font-size:12px; color:#617c90; white-space:nowrap; }
      #nyfa-albums-v2 .na-photo-preview { aspect-ratio:4/3; display:block; width:100%;
        height:auto; object-fit:contain; padding:7px; background:#f5f7fa; box-sizing:border-box; }
      #nyfa-albums-v2 .na-message { padding: 35px 18px; text-align:center;
        border: 1px dashed #c8d7e4; border-radius: 14px; background:#f8fafc;
        color:#526c7f; font-size: 14px; }
      #nyfa-album-modal-v2 { position:fixed; inset:0; z-index:8000; display:none;
        align-items:center; justify-content:center; background:rgba(6,16,27,.95);
        padding: 55px 62px; box-sizing:border-box; }
      #nyfa-album-modal-v2.na-open { display:flex; }
      #nyfa-album-modal-v2 img { display:block; max-width:100%; max-height:calc(100dvh - 120px); object-fit:contain; }
      #nyfa-album-modal-v2 .na-modal-btn { position:absolute; border:none; border-radius:11px;
        padding:8px 14px; font-size:24px; line-height:1.2; background:#fff; color:#243b4f; cursor:pointer; }
      #nyfa-album-modal-v2 .na-close { right:18px; top:16px; }
      #nyfa-album-modal-v2 .na-prev { left:12px; top:50%; transform:translateY(-50%); }
      #nyfa-album-modal-v2 .na-next { right:12px; top:50%; transform:translateY(-50%); }
      #nyfa-album-modal-v2 .na-modal-caption { position:absolute; bottom:14px; left:18px;
        right:18px; color:#fff; text-align:center; font-size:13px; }
      @media(max-width:900px){#nyfa-albums-v2 .na-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
      @media(max-width:560px){#nyfa-albums-v2 .na-grid{gap:11px;}
        #nyfa-albums-v2 .na-caption{padding:10px;align-items:flex-start;flex-direction:column;gap:4px;}
        #nyfa-albums-v2 .na-caption strong{font-size:13px;}
        #nyfa-album-modal-v2{padding:54px 46px;}}
    `;
    document.head.appendChild(css);

    var ui = document.createElement('div');
    ui.id = 'nyfa-albums-v2';
    ui.innerHTML = `
      <div class="na-toolbar">
        <div>
          <div id="na-heading" class="na-title">District photo albums</div>
          <div id="na-subtitle" class="na-description">Select a district to explore training photographs</div>
        </div>
        <div class="na-actions">
          <button id="na-back" class="na-action" type="button" hidden>← All districts</button>
          <button id="na-refresh" class="na-action" type="button">↻ Refresh gallery</button>
        </div>
      </div>
      <div id="na-grid" class="na-grid"></div>
      <div id="na-message" class="na-message">Loading district albums…</div>
    `;
    section.appendChild(ui);
    section.classList.add('nyfa-albums-enabled');

    var modal = document.createElement('div');
    modal.id = 'nyfa-album-modal-v2';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'First aid training photograph');
    modal.innerHTML = `
      <button type="button" id="na-close" class="na-modal-btn na-close" aria-label="Close photograph">×</button>
      <button type="button" id="na-prev" class="na-modal-btn na-prev" aria-label="Previous photograph">‹</button>
      <img id="na-large" alt="Training programme photograph">
      <button type="button" id="na-next" class="na-modal-btn na-next" aria-label="Next photograph">›</button>
      <div id="na-modal-caption" class="na-modal-caption"></div>
    `;
    document.body.appendChild(modal);

    function el(id) { return document.getElementById(id); }
    var pictures = [], districts = [], currentKey = '', active = [], selected = 0;
    var loadedAt = 0, loading = false, lockedScroll = '';
    var REFRESH_AFTER = 2 * 60 * 1000;

    function districtKey(name) {
      var key = String(name || 'Other').trim().replace(/\s+/g,' ').toLowerCase();
      // Common alternate English spelling; do not merge unrelated districts.
      if (key === 'rathnapura') key = 'ratnapura';
      return key || 'other';
    }
    function group() {
      var groups = new Map();
      pictures.forEach(function(p) {
        if (!p || !p.id) return;
        var label = String(p.district || 'Other').trim() || 'Other';
        var key = districtKey(label);
        if (!groups.has(key)) groups.set(key, {key:key,label:label,photos:[]});
        groups.get(key).photos.push(p);
      });
      districts = Array.from(groups.values()).sort(function(a,b){return a.label.localeCompare(b.label);});
    }
    function message(text) {
      el('na-grid').replaceChildren();
      el('na-message').textContent = text;
      el('na-message').hidden = false;
    }
    function imgFor(photo) {
      var img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = '';
      img.src = photo.thumb || photo.full || '';
      img.addEventListener('error', function() {
        if (img.dataset.fallbackDone) return;
        img.dataset.fallbackDone = '1';
        if (window.google && google.script && google.script.run) {
          google.script.run.withSuccessHandler(function(source) {
            if(source) img.src = source;
          }).withFailureHandler(function() {}).nyfaGalleryThumbnail(photo.id);
        }
      });
      return img;
    }
    function caption(card, name, summary) {
      var foot = document.createElement('div');
      foot.className = 'na-caption';
      var title = document.createElement('strong'); title.textContent = name;
      var sub = document.createElement('span'); sub.textContent = summary;
      foot.append(title, sub); card.appendChild(foot);
    }
    function render() {
      el('na-grid').replaceChildren();
      el('na-message').hidden = true;
      el('na-back').hidden = !currentKey;
      if (!pictures.length) {
        el('na-heading').textContent = 'District photo albums';
        el('na-subtitle').textContent = '';
        message('No approved photographs found in the recognised district folders.');
        return;
      }
      if (!currentKey) {
        el('na-heading').textContent = 'District photo albums';
        el('na-subtitle').textContent = districts.length + ' districts · ' + pictures.length + ' photographs';
        districts.forEach(function(d) {
          var card = document.createElement('button');
          card.type = 'button'; card.className = 'na-card';
          card.setAttribute('aria-label', 'Open ' + d.label + ' album with ' + d.photos.length + ' photographs');
          var gallery = document.createElement('div');
          var tiles = d.photos.slice(-4).reverse();
          gallery.className = 'na-collage na-count-' + tiles.length;
          tiles.forEach(function(p) { gallery.appendChild(imgFor(p)); });
          card.appendChild(gallery);
          caption(card, d.label, d.photos.length + ' photo' + (d.photos.length === 1 ? '' : 's') + ' ›');
          card.addEventListener('click', function(){ currentKey = d.key; render(); });
          el('na-grid').appendChild(card);
        });
      } else {
        var district = districts.find(function(d){ return d.key === currentKey; });
        if (!district) { currentKey = ''; render(); return; }
        active = district.photos;
        el('na-heading').textContent = district.label + ' photos';
        el('na-subtitle').textContent = active.length + ' photographs · Click to view fullscreen';
        active.forEach(function(p, i) {
          var card = document.createElement('button');
          card.type = 'button'; card.className = 'na-card';
          card.setAttribute('aria-label', 'View ' + district.label + ' photo ' + (i+1));
          var img = imgFor(p); img.className = 'na-photo-preview';
          card.appendChild(img);
          caption(card, 'Photo ' + (i+1), 'View photograph ↗');
          card.addEventListener('click', function(){ selected = i; openModal(); });
          el('na-grid').appendChild(card);
        });
      }
    }
    function load(force) {
      if (loading) return;
      if (!force && loadedAt && (Date.now()-loadedAt)<REFRESH_AFTER) { render(); return; }
      loading = true;
      message('Loading district photo albums…');
      if (!(window.google && google.script && google.script.run)) {
        loading = false;
        message('The Google Drive photo connection is unavailable. Check bridge.js.');
        return;
      }
      google.script.run.withSuccessHandler(function(data){
        loading = false;
        pictures = Array.isArray(data && data.photos) ? data.photos : [];
        loadedAt = Date.now(); group(); render();
      }).withFailureHandler(function(err){
        loading = false;
        message('Unable to load gallery: '+String(err && err.message || err));
      }).nyfaGalleryList(true);
    }
    function openModal() {
      if (!active.length) return;
      var p = active[selected];
      el('na-large').dataset.fallbackDone = '';
      el('na-large').src = p.full || p.thumb || '';
      el('na-large').alt = 'First aid training photograph from ' + (p.district || 'Sri Lanka');
      el('na-modal-caption').textContent = 'Photo ' + (selected + 1) + ' of ' + active.length;
      lockedScroll = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      modal.classList.add('na-open');
      el('na-close').focus();
    }
    function closeModal() {
      modal.classList.remove('na-open');
      el('na-large').removeAttribute('src');
      document.body.style.overflow = lockedScroll;
    }
    function move(delta) {
      if (!active.length) return;
      selected = (selected + delta + active.length) % active.length;
      el('na-large').dataset.fallbackDone = '';
      el('na-large').src = active[selected].full || active[selected].thumb || '';
      el('na-modal-caption').textContent = 'Photo ' + (selected + 1) + ' of ' + active.length;
    }
    el('na-back').addEventListener('click', function(){ currentKey = ''; render(); });
    el('na-refresh').addEventListener('click', function(){ load(true); });
    el('na-large').addEventListener('error', function(){
      if (this.dataset.fallbackDone || !active[selected]) return;
      this.dataset.fallbackDone = '1';
      var target = this;
      var photoId = active[selected].id;
      if (window.google && google.script && google.script.run) {
        google.script.run.withSuccessHandler(function(source) {
          if (source && active[selected] && active[selected].id === photoId) target.src = source;
        }).withFailureHandler(function() {}).nyfaGalleryThumbnail(photoId);
      }
    });
    el('na-close').addEventListener('click', closeModal);
    el('na-prev').addEventListener('click', function(){ move(-1); });
    el('na-next').addEventListener('click', function(){ move(1); });
    modal.addEventListener('click', function(e){ if(e.target === modal) closeModal(); });
    document.addEventListener('keydown', function(e){
      if (!modal.classList.contains('na-open')) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key === 'ArrowRight') move(1);
    });

    // Works with the existing sidebar, mobile navigation, and delayed gallery insertion.
    document.addEventListener('click', function(e){
      var target = e.target && e.target.closest ? e.target.closest('[data-section="gallery"], [data-jump="gallery"]') : null;
      if (target) load(false);
    });
    if (section.classList.contains('active')) load(true);
    console.info('NYFA district album gallery v2 activated');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
