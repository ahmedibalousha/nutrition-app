var V = 'na-shell-v1';
var SHELL = ['./','index.html','admin.html','style.css','shared.js','app.js','admin.js','manifest.webmanifest','icon.svg'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(V).then(function(c){return c.addAll(SHELL);}).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k.indexOf('na-shell-')===0&&k!==V;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
function swr(req, cacheName){
  return caches.open(cacheName).then(function(c){
    return c.match(req,{ignoreSearch:true}).then(function(hit){
      var net=fetch(req).then(function(res){if(res&&(res.ok||res.type==='opaque'))c.put(req,res.clone());return res;}).catch(function(){return hit;});
      return hit||net;
    });
  });
}
self.addEventListener('fetch', function(e){
  var r=e.request;if(r.method!=='GET')return;
  var u=new URL(r.url);
  if(u.origin===location.origin){
    e.respondWith(swr(r,V).then(function(res){return res||caches.match('index.html');}));return;
  }
  if(/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){e.respondWith(swr(r,'na-fonts'));}
});
