/* Service Worker：离线缓存应用外壳，使手机可离线使用
   策略：在线优先（network-first）——联网时始终拉取最新文件，
   保证已登录用户也能及时用上新版；离线时回退到缓存，保证可用。 */
const CACHE = 'suibiji-v2';
const SHELL = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', (e) => {
  // 不自动 skipWaiting：新版本先“等待”，由页面提示用户后再激活
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// 接收页面发来的“立即激活”指令
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // 只处理同源 GET 静态资源
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // 在线优先：先请求网络拿到最新文件并刷新缓存；失败（离线）再回退缓存
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
