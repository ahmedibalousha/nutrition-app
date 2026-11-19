var DATA = {ver:'', sections:[], items:[], at:0};
var CUR = null, installEvt = null;

function loadLocal(){try{var s=localStorage.getItem('na_data');if(s)DATA=JSON.parse(s);}catch(e){}}
function saveLocal(){try{localStorage.setItem('na_data',JSON.stringify(DATA));}catch(e){}}
function getSaved(){try{return JSON.parse(localStorage.getItem('na_saved')||'{}');}catch(e){return {};}}
function setSaved(o){try{localStorage.setItem('na_saved',JSON.stringify(o));}catch(e){}}
function tm(t){if(!t)return '—';var d=new Date(t);return d.toLocaleDateString('en-GB')+' '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}

function setStatus(kind){
  var el=$('st');
  if(kind==='sync')el.textContent='🔄 جارٍ المزامنة…';
  else if(kind==='ok')el.textContent='🟢 متصل · آخر مزامنة '+tm(DATA.at);
  else el.textContent=DATA.at?('🟠 بدون إنترنت · النسخة المحفوظة من '+tm(DATA.at)):'🟠 بدون إنترنت ولا توجد بيانات محفوظة بعد';
}

async function sync(){
  setStatus('sync');
  var ok=false;
  try{
    var r=await fetch(API+'?action=data&ver='+encodeURIComponent(DATA.ver||''),{cache:'no-store'});
    var j=await r.json();
    if(!j.ok)throw new Error(j.error);
    if(j.changed){DATA={ver:j.ver,sections:j.sections,items:j.items,at:Date.now()};}
    else{DATA.at=Date.now();}
    saveLocal();
    if(!CUR||!DATA.sections.some(function(s){return s.id===CUR;}))CUR=DATA.sections.length?DATA.sections[0].id:null;
    drawChips();render();setStatus('ok');ok=true;
  }catch(e){setStatus('off');if(!DATA.items.length)render();}
  if(ok)autoRefresh();
}

/* تحديث الملفات المحفوظة أوفلاين تلقائياً + حذف الملفات القديمة */
var BUSY=false;
async function autoRefresh(){
  if(BUSY||!DATA.items.length)return;BUSY=true;
  try{
    var s=getSaved(),cur={};DATA.items.forEach(function(a){cur[a.id]=a;});
    for(var id in s){
      var a=cur[id];
      if(!a){delete s[id];continue;}
      try{
        await ensureFile(a.fileId,'pdf');
        for(var k=0;k<a.images.length;k++)await ensureFile(a.images[k],'full');
        s[id]={f:a.fileId,i:a.images.slice()};
      }catch(e){}
    }
    setSaved(s);
    await purge();
    hydrate();
  }catch(e){}
  BUSY=false;
}
async function purge(){
  var kp={},kf={},kt={};
  DATA.items.forEach(function(a){kp[a.fileId]=1;(a.images||[]).forEach(function(i){kf[i]=1;kt[i]=1;});});
  var c=await caches.open(FILES),ks=await c.keys();
  for(var n=0;n<ks.length;n++){
    var p=ks[n].url.replace('https://offline.local/','').split('/'),kind=p[0],id=p.slice(1).join('/');
    var m=kind==='pdf'?kp:(kind==='full'?kf:kt);
    if(!m[id])await c.delete(ks[n]);
  }
}

function drawChips(){
  $('chips').innerHTML=DATA.sections.map(function(s){
    return '<button class="chip'+(s.id===CUR?' on':'')+'" onclick="pick(\''+s.id+'\')">'+esc(s.icon)+' '+esc(s.name)+'</button>';}).join('');
}
function pick(id){CUR=id;drawChips();render();}

function render(){
  var q=$('q').value.trim().toLowerCase();
  var items=DATA.items.filter(function(a){return a.sectionId===CUR&&(!q||(a.title+' '+a.axes.join(' ')).toLowerCase().indexOf(q)>-1);});
  $('count').textContent=items.length+' موضوع';
  var box=$('list');
  if(!items.length){box.innerHTML='<div class="empty" style="grid-column:1/-1">'+(DATA.items.length?'لا توجد مواضيع مطابقة':(DATA.at?'لا توجد مواضيع بعد':'جارٍ التحميل... (أول مرة تحتاج إنترنت)'))+'</div>';return;}
  box.innerHTML=items.map(function(a,i){
    var idx=DATA.items.indexOf(a);
    var lis=a.axes.map(function(x,k){return '<li class="'+(k>2?'hide':'')+'">'+esc(x)+'</li>';}).join('');
    var more=a.axes.length>3?'<button class="more" onclick="toggle(this)">عرض كل المحاور ('+a.axes.length+') ▾</button>':'';
    var th=(a.images||[]).map(function(id,k){return '<img data-id="'+id+'" alt="" onclick="lb('+idx+','+k+')">';}).join('');
    return '<div class="card"><div class="top"><div class="badge">'+(items.length-i)+'</div><div><h3>'+esc(a.title)+'</h3><div class="meta">📅 '+fd(a)+'</div><div class="by">✍️ أضافه: '+esc(a.addedBy||'-')+'</div></div></div>'
      +(th?'<div class="thumbs">'+th+'</div>':'')+'<ul class="axes">'+lis+'</ul>'+more
      +'<div class="actions"><button class="btn primary" onclick="openPdf('+idx+')">📄 فتح الملف</button>'
      +'<button class="btn ghost" id="off_'+idx+'" data-s="0" onclick="toggleOffline('+idx+')">⬇ حفظ أوفلاين</button></div></div>';
  }).join('');
  hydrate();
}

function toggle(btn){
  var ul=btn.previousElementSibling,open=btn.dataset.o==='1',lis=ul.querySelectorAll('li');
  for(var i=3;i<lis.length;i++)lis[i].classList.toggle('hide',open);
  btn.dataset.o=open?'0':'1';
  btn.textContent=open?'عرض كل المحاور ('+lis.length+') ▾':'إخفاء المحاور ▴';
}

/* ---- الصور المصغّرة: من الجهاز إن وُجدت، وإلا من درايف مع حفظها للأوفلاين ---- */
var io=('IntersectionObserver' in window)?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);loadThumb(e.target);}});},{rootMargin:'200px'}):null;
async function loadThumb(img){
  var id=img.dataset.id,b=await cached(id,'thumb');
  if(b){img.src=URL.createObjectURL(b);return;}
  if(navigator.onLine){img.src='https://drive.google.com/thumbnail?id='+id+'&sz=w400';queueCache(id);}
}
var Q=[],QB=0;
function queueCache(id){Q.push(id);pump();}
function pump(){while(QB<2&&Q.length){var id=Q.shift();QB++;ensureFile(id,'thumb').catch(function(){}).then(function(){QB--;pump();});}}

async function hydrate(){
  document.querySelectorAll('img[data-id]').forEach(function(img){if(io)io.observe(img);else loadThumb(img);});
  for(var i=0;i<DATA.items.length;i++){
    var btn=$('off_'+i);if(!btn)continue;
    var ok=await cached(DATA.items[i].fileId,'pdf');
    btn.dataset.s=ok?'1':'0';btn.textContent=ok?'✔ محفوظ — إزالة':'⬇ حفظ أوفلاين';
  }
}

async function toggleOffline(i){
  var a=DATA.items[i],btn=$('off_'+i),s=getSaved();
  if(btn.dataset.s==='1'){
    await dropFile(a.fileId,'pdf');
    for(var k=0;k<a.images.length;k++)await dropFile(a.images[k],'full');
    delete s[a.id];setSaved(s);
    btn.dataset.s='0';btn.textContent='⬇ حفظ أوفلاين';toast('تمت الإزالة من الجهاز');return;
  }
  if(!navigator.onLine){toast('لازم تكون متصل بالإنترنت لتنزيل الملف');return;}
  btn.disabled=true;btn.textContent='جارٍ التنزيل…';
  try{
    await ensureFile(a.fileId,'pdf');
    for(var k2=0;k2<a.images.length;k2++)await ensureFile(a.images[k2],'full');
    s[a.id]={f:a.fileId,i:a.images.slice()};setSaved(s);
    btn.dataset.s='1';btn.textContent='✔ محفوظ — إزالة';toast('تم الحفظ، الملف متاح بدون إنترنت');
  }catch(e){btn.textContent='⬇ حفظ أوفلاين';toast('تعذّر التنزيل، حاول مرة ثانية');}
  btn.disabled=false;
}

async function openPdf(i){
  var a=DATA.items[i],w=window.open('','_blank');
  var b=await cached(a.fileId,'pdf');
  if(b){var u=URL.createObjectURL(b);if(w)w.location=u;else location.href=u;return;}
  if(navigator.onLine){if(w)w.location=a.viewUrl;else location.href=a.viewUrl;return;}
  if(w)w.close();
  toast('الملف غير محفوظ — نزّله وأنت متصل بالإنترنت');
}

/* ---- عرض الصور ---- */
var LB={i:0,k:0};
async function lbShow(){
  var a=DATA.items[LB.i],id=a.images[LB.k],img=$('lbImg');
  var b=await cached(id,'full')||await cached(id,'thumb');
  if(b){img.src=URL.createObjectURL(b);return;}
  if(navigator.onLine)img.src='https://drive.google.com/thumbnail?id='+id+'&sz=w1600';
}
function lb(i,k){LB.i=i;LB.k=k;lbShow();$('lb').classList.add('on');}
function lbStep(d){var n=DATA.items[LB.i].images.length;LB.k=(LB.k+d+n)%n;lbShow();}
function lbClose(){$('lb').classList.remove('on');$('lbImg').src='';}
$('lb').addEventListener('click',function(e){if(e.target.id==='lb')lbClose();});

/* ---- التثبيت والأحداث ---- */
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();installEvt=e;$('install').hidden=false;});
$('install').onclick=async function(){if(!installEvt)return;installEvt.prompt();await installEvt.userChoice;installEvt=null;$('install').hidden=true;};
window.addEventListener('appinstalled',function(){$('install').hidden=true;});
if(/iphone|ipad/i.test(navigator.userAgent)&&!window.navigator.standalone)$('iosHint').hidden=false;

$('q').addEventListener('input',render);
$('refresh').onclick=function(){if(!navigator.onLine){toast('لا يوجد اتصال بالإنترنت');setStatus('off');return;}sync();};
window.addEventListener('online',sync);
window.addEventListener('offline',function(){setStatus('off');});
document.addEventListener('visibilitychange',function(){if(!document.hidden&&navigator.onLine)sync();});

loadLocal();
if(DATA.sections.length){CUR=DATA.sections[0].id;drawChips();}
render();
if(navigator.onLine)sync();else setStatus('off');
