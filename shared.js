var API = 'https://script.google.com/macros/s/AKfycbzGBYz8ClTk4WY2oHqCZd0DTqlKRNzG6UzJzK90GHapNSeV9UzXgJ51_4YcorFq4wCz/exec';
var FILES = 'na-files-v1';

function $(id){return document.getElementById(id);}
function esc(s){var d=document.createElement('div');d.textContent=s==null?'':s;return d.innerHTML;}
function fd(a){var s=a.activityDate;if(s&&s.split('-').length===3){var p=s.split('-');return p[2]+'/'+p[1]+'/'+p[0];}
  try{var d=new Date(a.date);return isNaN(d)?'':d.toLocaleDateString('en-GB');}catch(e){return '';}}
function toast(t){var el=document.createElement('div');el.className='toast';el.textContent=t;document.body.appendChild(el);setTimeout(function(){el.remove();},3200);}

function callApi(action,args){
  return fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:action,args:args||[]})})
    .then(function(r){return r.json();})
    .then(function(j){if(!j.ok)throw new Error(j.error||'حدث خطأ');return j.data;})
    .catch(function(e){if(e instanceof TypeError)throw new Error('تعذّر الاتصال بالإنترنت');throw e;});
}

function b64ToBlob(b64,mime){var bin=atob(b64),n=bin.length,u=new Uint8Array(n);for(var i=0;i<n;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:mime});}
function fkey(id,kind){return 'https://offline.local/'+kind+'/'+id;}
async function cached(id,kind){try{var c=await caches.open(FILES);var r=await c.match(fkey(id,kind));return r?await r.blob():null;}catch(e){return null;}}
async function ensureFile(id,kind){
  var b=await cached(id,kind);if(b)return b;
  var r=await fetch(API+'?action=file&id='+encodeURIComponent(id)+'&kind='+kind,{cache:'no-store'});
  var j=await r.json();if(!j.ok)throw new Error(j.error||'تعذّر التنزيل');
  b=b64ToBlob(j.base64,j.mime);
  var c=await caches.open(FILES);await c.put(fkey(id,kind),new Response(b,{headers:{'Content-Type':j.mime}}));
  return b;
}
async function dropFile(id,kind){try{var c=await caches.open(FILES);await c.delete(fkey(id,kind));}catch(e){}}

if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});}
