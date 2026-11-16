// ART CRM: เปิดแอปได้แม้ไม่มีเน็ต (เก็บตัวหน้าเว็บไว้ ข้อมูลอยู่ในเครื่องอยู่แล้ว)
var V='artcrm-v1',SHELL=['./','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(V).then(function(c){return c.addAll(SHELL)}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==V}).map(function(x){return caches.delete(x)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener('fetch',function(e){var r=e.request;if(r.method!=='GET')return;var u=new URL(r.url);
 if(u.origin===location.origin){ // เว็บของเรา: ลองเน็ตก่อนเพื่อได้เวอร์ชันใหม่ ไม่มีเน็ตใช้ของที่เก็บไว้
  e.respondWith(fetch(r).then(function(res){if(res&&res.ok){var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp)})}return res}).catch(function(){return caches.match(r).then(function(m){return m||caches.match('./')})}));return}
 if(/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){ // ฟอนต์: ใช้ของเก่าก่อน แล้วอัปเดตเบื้องหลัง
  e.respondWith(caches.match(r).then(function(m){var f=fetch(r).then(function(res){var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp)});return res}).catch(function(){return m});return m||f}))}});
