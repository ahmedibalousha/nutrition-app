var TOKEN=null, ITEMS=[], SECS=[], IMGS=[], EDIT_ID=null, FILE=null, MAX=20;
function show(el,t,type){el.className='msg '+type;el.textContent=t;}
function store(k,v){try{if(v==null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v);}catch(e){}}
function load(k){try{return sessionStorage.getItem(k);}catch(e){return null;}}
function setTab(t){document.body.className='tab-'+t;$('tabAdd').className=t==='add'?'on':'';$('tabList').className=t==='list'?'on':'';window.scrollTo(0,0);}
function today(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
function thumb(id){return 'https://drive.google.com/thumbnail?id='+id+'&sz=w200';}

function enter(info){
  TOKEN=info.token;store('tok',info.token);store('nm',info.name+'|'+info.role);
  $('loginBox').style.display='none';$('app').style.display='block';
  $('who').textContent='👋 '+info.name+' — '+(info.role==='Admin'?'مشرف':'فوكل بوينت');
  refresh();
}
function leave(){TOKEN=null;store('tok',null);store('nm',null);$('app').style.display='none';$('loginBox').style.display='block';}

$('loginBtn').onclick=function(){
  var b=this;b.disabled=true;b.innerHTML='جارٍ الدخول<span class="spin"></span>';
  callApi('login',[$('u').value,$('p').value]).then(enter).catch(function(e){show($('loginMsg'),e.message,'err');})
    .then(function(){b.disabled=false;b.textContent='دخول';});
};
$('p').addEventListener('keydown',function(e){if(e.key==='Enter')$('loginBtn').click();});
$('logoutBtn').onclick=function(){callApi('logout',[TOKEN]).catch(function(){});leave();};

function refresh(){
  callApi('adminData',[TOKEN]).then(function(r){ITEMS=r.items;SECS=r.sections;drawSecs();draw();}).catch(function(e){
    if(/الجلسة/.test(e.message)){leave();show($('loginMsg'),e.message,'err');}
    else $('items').innerHTML='<div class="empty">'+esc(e.message)+'</div>';});
}
function secName(id){var s=SECS.filter(function(x){return x.id===id;})[0];return s?s.icon+' '+s.name:'';}
function drawSecs(){var cur=$('section').value;$('section').innerHTML=SECS.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.icon)+' '+esc(s.name)+'</option>';}).join('');if(cur)$('section').value=cur;}
$('addSecBtn').onclick=function(){var b=this;b.disabled=true;
  callApi('addSection',[TOKEN,$('newSecName').value,$('newSecIcon').value]).then(function(){$('newSecName').value='';$('newSecIcon').value='';show($('msg'),'تمت إضافة القسم ✔','ok');refresh();})
    .catch(function(e){show($('msg'),e.message,'err');}).then(function(){b.disabled=false;});};
function draw(){
  if(!ITEMS.length){$('items').innerHTML='<div class="empty">لا توجد مواضيع بعد</div>';return;}
  $('items').innerHTML=ITEMS.map(function(a,i){
    return '<div class="row-item"><div class="t">'+esc(a.title)+'<small><span class="tag">'+esc(secName(a.sectionId))+'</span>'+fd(a)+' · '+a.axes.length+' محاور'+(a.addedBy?' · '+esc(a.addedBy):'')+'</small></div>'
      +'<a class="btn ghost sm" style="flex:none" target="_blank" href="'+a.viewUrl+'">PDF</a>'
      +'<button class="btn ghost sm" style="flex:none" onclick="edit('+i+')">تعديل</button>'
      +'<button class="btn danger sm" style="flex:none" onclick="del('+i+')">حذف</button></div>';
  }).join('');
}

function drawPv(){
  $('pvs').innerHTML=IMGS.map(function(m,i){return '<div class="pv"><img src="'+m.url+'"><button type="button" onclick="rmImg('+i+')">✕</button></div>';}).join('');
  $('imgBox').textContent=IMGS.length?('الصور: '+IMGS.length+' من 5 — اضغط لإضافة المزيد'):'اضغط لاختيار الصور (JPG / PNG)';
  $('imgBox').className='file'+(IMGS.length?' has':'');
}
function rmImg(i){IMGS.splice(i,1);drawPv();}
function shrink(f){return new Promise(function(ok,no){var r=new FileReader();
  r.onload=function(){var im=new Image();
    im.onload=function(){var s=Math.min(1,1400/Math.max(im.width,im.height));var c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);var u=c.toDataURL('image/jpeg',0.82);
      ok({kind:'new',name:f.name,mime:'image/jpeg',base64:u.split(',')[1],url:u});};
    im.onerror=function(){no(new Error('تعذّر قراءة الصورة'));};im.src=r.result;};
  r.readAsDataURL(f);});}
$('imgs').onchange=function(){
  var fs=[].slice.call(this.files);this.value='';
  var room=5-IMGS.length;if(fs.length>room){show($('msg'),'الحد الأقصى 5 صور','err');fs=fs.slice(0,Math.max(room,0));}
  Promise.all(fs.map(shrink)).then(function(r){IMGS=IMGS.concat(r);drawPv();}).catch(function(e){show($('msg'),e.message,'err');});
};

$('file').onchange=function(){
  var f=this.files[0];if(!f)return;
  if(!/pdf/i.test(f.type)&&!/\.pdf$/i.test(f.name)){show($('msg'),'الملف يجب أن يكون PDF','err');this.value='';return;}
  if(f.size>MAX*1024*1024){show($('msg'),'حجم الملف أكبر من '+MAX+' ميغابايت','err');this.value='';return;}
  var r=new FileReader();
  r.onload=function(){FILE={name:f.name,mime:'application/pdf',base64:String(r.result).split(',')[1]};
    $('fileBox').className='file has';$('fileBox').textContent='✔ '+f.name+' ('+(f.size/1048576).toFixed(1)+' MB)';$('msg').className='msg';};
  r.readAsDataURL(f);
};
function resetForm(){IMGS=[];drawPv();$('actDate').value=today();EDIT_ID=null;FILE=null;$('title').value='';$('axes').value='';$('file').value='';
  $('fileBox').className='file';$('fileBox').textContent='اضغط لاختيار ملف PDF (حتى '+MAX+' ميغابايت)';$('fileHint').textContent='';
  $('formTitle').textContent='➕ إضافة موضوع جديد';$('saveBtn').textContent='حفظ ونشر';$('cancelBtn').style.display='none';}
$('cancelBtn').onclick=function(){resetForm();$('msg').className='msg';};

function edit(i){var a=ITEMS[i];resetForm();EDIT_ID=a.id;
  IMGS=(a.images||[]).map(function(id){return {kind:'old',id:id,url:thumb(id)};});drawPv();
  $('actDate').value=a.activityDate||today();$('section').value=a.sectionId;$('title').value=a.title;$('axes').value=a.axes.join('\n');
  $('formTitle').textContent='✏️ تعديل الموضوع';$('saveBtn').textContent='حفظ التعديل';$('cancelBtn').style.display='';
  $('fileHint').textContent='اترك الملف فارغاً للإبقاء على ملف PDF الحالي.';setTab('add');}
function del(i){var a=ITEMS[i];if(!confirm('حذف «'+a.title+'» من الموقع؟'))return;
  callApi('deleteActivity',[TOKEN,a.id]).then(refresh).catch(function(e){alert(e.message);});}

$('saveBtn').onclick=function(){
  var b=this;
  var data={sectionId:$('section').value,title:$('title').value,activityDate:$('actDate').value,axes:$('axes').value,file:FILE,
    images:IMGS.filter(function(m){return m.kind==='new';}).map(function(m){return {name:m.name,mime:m.mime,base64:m.base64};}),
    keepImages:IMGS.filter(function(m){return m.kind==='old';}).map(function(m){return m.id;})};
  b.disabled=true;b.innerHTML='جارٍ الحفظ<span class="spin"></span>';
  var editing=!!EDIT_ID;
  var p=editing?callApi('updateActivity',[TOKEN,EDIT_ID,data]):callApi('addActivity',[TOKEN,data]);
  p.then(function(){show($('msg'),editing?'تم حفظ التعديل ✔':'تمت الإضافة ونُشر الموضوع ✔','ok');resetForm();refresh();})
   .catch(function(e){show($('msg'),e.message,'err');if(/الجلسة/.test(e.message))leave();})
   .then(function(){b.disabled=false;b.textContent=EDIT_ID?'حفظ التعديل':'حفظ ونشر';});
};

$('actDate').value=today();
setTab('add');
(function(){var t=load('tok'),n=load('nm');if(t&&n){var s=n.split('|');enter({token:t,name:s[0],role:s[1]});}})();
