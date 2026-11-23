/* National Youth First Aid: compact homepage photo banner.
   Reads only the existing approved gallery feed; changes no reporting data. */
(function () {
  'use strict';
  function boot() {
    var cards = document.querySelector('#sec-overview .grid5.home-kpis');
    if (!cards || document.getElementById('nyfa-photo-banner')) return;
    var css = document.createElement('style');
    css.textContent = `
      #nyfa-photo-banner[hidden]{display:none!important}
      #nyfa-photo-banner{margin:0 0 22px}
      #nyfa-photo-banner .npb-stage{height:175px;position:relative;overflow:hidden;border-radius:16px;background:#143448;box-shadow:0 8px 25px #15394b16}
      #nyfa-photo-banner .npb-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .7s ease}
      #nyfa-photo-banner .npb-photo.active{opacity:1}
      #nyfa-photo-banner .npb-overlay{position:absolute;inset:0;background:linear-gradient(90deg,#0a243ae8 0%,#0a243a9e 40%,#0a243a22 100%);pointer-events:none}
      #nyfa-photo-banner .npb-text{position:absolute;z-index:1;left:25px;top:50%;transform:translateY(-50%);color:white;max-width:70%}
      #nyfa-photo-banner .npb-eyebrow{font:800 10px Manrope,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#83e6d9;margin:0 0 5px}
      #nyfa-photo-banner .npb-text h3{font:800 26px/1.16 Manrope,sans-serif;margin:0 0 6px;color:white}
      #nyfa-photo-banner .npb-district{font:600 12px 'DM Sans',sans-serif;color:#e3f2f2;margin:0 0 11px}
      #nyfa-photo-banner .npb-gallery{border:1px solid #ffffff75;border-radius:8px;background:#ffffff20;color:#fff;font:800 11px Manrope,sans-serif;padding:7px 11px;cursor:pointer}
      #nyfa-photo-banner .npb-gallery:hover{background:#ffffff39}
      #nyfa-photo-banner .npb-controls{position:absolute;z-index:2;right:15px;bottom:12px;display:flex;align-items:center;gap:7px;color:#fff}
      #nyfa-photo-banner .npb-controls[hidden]{display:none}
      #nyfa-photo-banner .npb-controls button{width:32px;height:32px;border:1px solid #ffffff80;border-radius:9px;background:#092a44ad;color:white;font-size:20px;cursor:pointer}
      #nyfa-photo-banner .npb-counter{font:800 11px Manrope,sans-serif;min-width:42px;text-align:center}
      #nyfa-photo-banner button:focus-visible{outline:3px solid #8de9da;outline-offset:2px}
      @media(max-width:650px){
        #nyfa-photo-banner{margin-bottom:17px}
        #nyfa-photo-banner .npb-stage{height:125px;border-radius:13px}
        #nyfa-photo-banner .npb-text{left:14px;max-width:67%}
        #nyfa-photo-banner .npb-eyebrow{font-size:8px;letter-spacing:.8px}
        #nyfa-photo-banner .npb-text h3{font-size:18px}
        #nyfa-photo-banner .npb-district{font-size:10px;margin-bottom:7px}
        #nyfa-photo-banner .npb-gallery{font-size:9px;padding:5px 7px}
        #nyfa-photo-banner .npb-controls{right:7px;bottom:7px;gap:3px}
        #nyfa-photo-banner .npb-controls button{width:27px;height:27px;font-size:17px}
        #nyfa-photo-banner .npb-counter{font-size:9px;min-width:33px}
      }
      @media(prefers-reduced-motion:reduce){#nyfa-photo-banner .npb-photo{transition:none}}
    `;
    document.head.appendChild(css);
    var section = document.createElement('section');
    section.id = 'nyfa-photo-banner'; section.hidden = true;
    section.setAttribute('aria-label','First aid training photographs');
    section.innerHTML = '<div class="npb-stage">' +
      '<img class="npb-photo" alt="" aria-hidden="true"><img class="npb-photo" alt="" aria-hidden="true">' +
      '<div class="npb-overlay"></div>' +
      '<div class="npb-text"><div class="npb-eyebrow">National Youth First Aid Programme</div>' +
      '<h3>Training in Action</h3><p class="npb-district">First aid training across Sri Lanka</p>' +
      '<button class="npb-gallery" type="button">Explore photo gallery ›</button></div>' +
      '<div class="npb-controls"><button type="button" class="npb-prev" aria-label="Previous photo">‹</button>' +
      '<span class="npb-counter"></span><button type="button" class="npb-next" aria-label="Next photo">›</button></div></div>';
    cards.insertAdjacentElement('afterend', section);

    var pics = [], index = -1, layer = -1, seq = 0, timer;
    var img = section.querySelectorAll('.npb-photo');
    var label = section.querySelector('.npb-district');
    var counter = section.querySelector('.npb-counter');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    function pause() { clearTimeout(timer); }
    function schedule() {
      pause();
      if (!reduced && !document.hidden && pics.length > 1) timer = setTimeout(function(){ show(index + 1); }, 5500);
    }
    function show(n) {
      if (!pics.length) return;
      pause();
      n = (n + pics.length) % pics.length;
      var p = pics[n], next = layer === 0 ? 1 : 0, ticket = ++seq;
      var urls = [p.full, p.thumb].filter(Boolean);
      function loaded(url) {
        if (ticket !== seq) return;
        img[next].src = url;
        img[next].classList.add('active');
        if (layer !== -1) img[layer].classList.remove('active');
        layer = next; index = n;
        label.textContent = (p.district || 'Sri Lanka') + ' · First aid training';
        counter.textContent = (n + 1) + ' / ' + pics.length;
        section.querySelector('.npb-controls').hidden = pics.length < 2;
        section.hidden = false;
        schedule();
      }
      function tryImage(i) {
        if (ticket !== seq) return;
        if (i === urls.length) {
          if (p.id && window.google && google.script && google.script.run) {
            google.script.run.withSuccessHandler(function(uri) {
              if (!uri || ticket !== seq) return;
              var test = new Image(); test.onload = function(){ loaded(uri); }; test.src = uri;
            }).withFailureHandler(function(){}).nyfaGalleryThumbnail(p.id);
          }
          return;
        }
        var test = new Image();
        test.onload = function(){ loaded(test.src); };
        test.onerror = function(){ tryImage(i + 1); };
        test.src = urls[i];
      }
      tryImage(0);
    }
    section.querySelector('.npb-prev').addEventListener('click',function(){show(index - 1);});
    section.querySelector('.npb-next').addEventListener('click',function(){show(index + 1);});
    section.querySelector('.npb-gallery').addEventListener('click',function(){
      var tab = document.querySelector('.navbtn[data-section="gallery"]');
      if (tab) tab.click();
    });
    document.addEventListener('visibilitychange',function(){ if(document.hidden)pause();else if(index>=0)schedule(); });
    // Same publication-approved photo API as the District Photo Gallery.
    if (window.google && google.script && google.script.run) {
      google.script.run.withSuccessHandler(function(response){
        var items = Array.isArray(response && response.photos) ? response.photos : [];
        // Alternate districts, so a large album doesn't dominate the banner.
        var districts = new Map(), seen = new Set();
        items.slice().reverse().forEach(function(p){
          if (!p || !p.id || (!p.full && !p.thumb) || seen.has(String(p.id))) return;
          seen.add(String(p.id));
          var key = String(p.district || 'Sri Lanka').trim().toLowerCase();
          if (key === 'rathnapura') key = 'ratnapura';
          if (!districts.has(key)) districts.set(key, []);
          districts.get(key).push(p);
        });
        var pools = Array.from(districts.values());
        while (pics.length < 10 && pools.some(function(a){return a.length>0;})) {
          pools.forEach(function(a){if (a.length && pics.length < 10)pics.push(a.shift());});
        }
        if (pics.length) show(0);
      }).withFailureHandler(function(){ /* Gallery outage shouldn't impact the dashboard. */ }).nyfaGalleryList(true);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
