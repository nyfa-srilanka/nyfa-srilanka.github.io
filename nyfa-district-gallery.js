/* NYFA photo-gallery district album view. Uses existing bridge.js/API and Drive setup. */
(function () {
  'use strict';
  function init() {
    var section = document.getElementById('sec-gallery');
    var nav = document.querySelector('.navbtn[data-section="gallery"]');
    if (!section || !nav || document.getElementById('nyfa-albums')) return;
    var style = document.createElement('style');
    style.textContent = '#sec-gallery .nyg-tools,#sec-gallery #nyg-grid,#sec-gallery #nyg-message,#sec-gallery #nyg-more{display:none!important}'+
      '#nyfa-albums .nyfa-album-controls{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin:15px 0}'+
      '#nyfa-albums button{cursor:pointer;font:inherit}'+
      '#nyfa-albums .nyfa-album-action{padding:10px 14px;border-radius:10px;border:1px solid #cfdae4;background:#fff;color:#19384d}'+
      '#nyfa-albums .nyfa-album-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}'+
      '#nyfa-albums .nyfa-album-card{display:block;width:100%;padding:0;text-align:left;border:1px solid #e0e7ee;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 5px 18px #17304c0c}'+
      '#nyfa-albums .nyfa-album-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#e7eef5}'+
      '#nyfa-albums .nyfa-album-caption{padding:13px 15px;display:flex;align-items:center;justify-content:space-between;gap:8px;color:#253e55}'+
      '#nyfa-albums .nyfa-album-caption span{font-size:12px;color:#60798b}'+
      '#nyfa-albums .nyfa-album-notice{padding:25px;text-align:center;color:#587084}'+
      '#nyfa-albums .nyfa-album-card:hover{box-shadow:0 10px 24px #17304c22;transform:translateY(-2px)}'+
      '#nyfa-albums .nyfa-album-photo img{object-fit:contain;padding:6px;box-sizing:border-box}'+
      '#nyfa-album-lightbox{position:fixed;inset:0;background:rgba(7,17,30,.94);display:none;align-items:center;justify-content:center;z-index:3000;padding:50px 65px}'+
      '#nyfa-album-lightbox.open{display:flex}'+
      '#nyfa-album-lightbox img{max-width:100%;max-height:85vh;object-fit:contain}'+
      '#nyfa-album-lightbox button{position:absolute;padding:9px 15px;font:inherit;font-size:24px;background:#fff;border:0;border-radius:10px;cursor:pointer}'+
      '#nyfa-album-close{right:18px;top:18px}#nyfa-album-prev{left:12px}#nyfa-album-next{right:12px}'+
      '@media(max-width:850px){#nyfa-albums .nyfa-album-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'+
      '@media(max-width:560px){#nyfa-albums .nyfa-album-grid{gap:10px;grid-template-columns:repeat(2,minmax(0,1fr))}#nyfa-album-lightbox{padding:55px 45px}}';
    document.head.appendChild(style);
    var root = document.createElement('div'); root.id = 'nyfa-albums';
    root.innerHTML = '<div class="nyfa-album-controls"><div><button class="nyfa-album-action" id="nyfa-album-back" hidden>← All districts</button><strong id="nyfa-album-title">District photo albums</strong></div><button class="nyfa-album-action" id="nyfa-album-refresh">↻ Refresh gallery</button></div><div class="nyfa-album-grid" id="nyfa-album-grid"></div><p class="nyfa-album-notice" id="nyfa-album-msg">Open Photo Gallery to load albums.</p>';
    section.appendChild(root);
    var lightbox = document.createElement('div'); lightbox.id='nyfa-album-lightbox';
    lightbox.setAttribute('role','dialog'); lightbox.setAttribute('aria-modal','true');lightbox.setAttribute('aria-label','Photograph');
    lightbox.innerHTML='<button id="nyfa-album-close" aria-label="Close">×</button><button id="nyfa-album-prev" aria-label="Previous">‹</button><img id="nyfa-album-big" alt="Training photograph"><button id="nyfa-album-next" aria-label="Next">›</button>';
    document.body.appendChild(lightbox);
    function el(id){return document.getElementById(id);}
    var all=[],current='',active=[],selected=0,loaded=false,loading=false;
    function clear(){el('nyfa-album-grid').replaceChildren();}
    function notice(s){el('nyfa-album-msg').textContent=s;el('nyfa-album-msg').hidden=false;}
    function card(photo,title,subtitle,isAlbum,action){
      var b=document.createElement('button');b.type='button';b.className='nyfa-album-card'+(isAlbum?'':' nyfa-album-photo');
      var img=document.createElement('img');img.loading='lazy';img.alt='Preview for '+title;img.src=photo.thumb||photo.full||'';
      img.addEventListener('error',function(){
        if(img.dataset.retry) return;img.dataset.retry='1';
        if(window.google&&google.script&&google.script.run)google.script.run.withSuccessHandler(function(src){if(src)img.src=src;}).nyfaGalleryThumbnail(photo.id);
      });
      var foot=document.createElement('div');foot.className='nyfa-album-caption';
      var label=document.createElement('strong');label.textContent=title;
      var info=document.createElement('span');info.textContent=subtitle;
      foot.append(label,info);b.append(img,foot);b.addEventListener('click',action);
      el('nyfa-album-grid').appendChild(b);
    }
    function render(){
      clear();el('nyfa-album-back').hidden=!current;
      if(!all.length){el('nyfa-album-title').textContent='District photo albums';notice('No approved photographs found. Check the recognised Google Drive district folders.');return;}
      el('nyfa-album-msg').hidden=true;
      if(!current){
        el('nyfa-album-title').textContent='District photo albums';
        var grouped=Object.create(null);
        all.forEach(function(p){var d=String(p.district||'Other').trim()||'Other';(grouped[d]||(grouped[d]=[])).push(p);});
        Object.keys(grouped).sort(function(a,b){return a.localeCompare(b);}).forEach(function(d){
          var photos=grouped[d];card(photos[0],d,photos.length+' photo'+(photos.length===1?'':'s')+' ›',true,function(){current=d;render();});
        });
      }else{
        el('nyfa-album-title').textContent=current+' photographs';
        active=all.filter(function(p){return p.district===current;});
        active.forEach(function(p,i){card(p,current,'View photograph ↗',false,function(){selected=i;openPhoto();});});
      }
    }
    function load(){
      if(loading)return;
      loading=true;notice('Loading district albums…');clear();
      if(!(window.google&&google.script&&google.script.run)){loading=false;notice('Gallery connection is not available.');return;}
      google.script.run.withSuccessHandler(function(data){
        loading=false;loaded=true;all=Array.isArray(data&&data.photos)?data.photos:[];render();
      }).withFailureHandler(function(err){
        loading=false;notice('Unable to load gallery: '+String(err&&err.message||err));
      }).nyfaGalleryList(true);
    }
    function openPhoto(){
      if(!active.length)return;
      lightbox.classList.add('open');el('nyfa-album-big').src=active[selected].full||active[selected].thumb||'';
    }
    function closePhoto(){lightbox.classList.remove('open');el('nyfa-album-big').src='';}
    function move(dir){if(active.length){selected=(selected+dir+active.length)%active.length;openPhoto();}}
    el('nyfa-album-back').addEventListener('click',function(){current='';render();});
    el('nyfa-album-refresh').addEventListener('click',load);
    nav.addEventListener('click',function(){if(!loaded&&!loading)load();});
    el('nyfa-album-close').addEventListener('click',closePhoto);
    el('nyfa-album-prev').addEventListener('click',function(){move(-1);});
    el('nyfa-album-next').addEventListener('click',function(){move(1);});
    lightbox.addEventListener('click',function(e){if(e.target===lightbox)closePhoto();});
    document.addEventListener('keydown',function(e){if(!lightbox.classList.contains('open'))return;if(e.key==='Escape')closePhoto();if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
