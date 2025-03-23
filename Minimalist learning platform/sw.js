// 服务 Worker 版本标识
const CACHE_VERSION = 'v2';
const CACHE_NAME = `${CACHE_VERSION}-static-cache`;
const OFFLINE_PAGE = '/offline.html';

// 预缓存关键资源
const PRE_CACHE = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/scripts/main.js',
  '/images/logo.png',
  
  OFFLINE_PAGE  // 将离线页面加入预缓存
];

// ================= 安装阶段 =================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 预缓存关键资源');
        return cache.addAll(PRE_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// ================= 激活阶段 =================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 清理旧版本缓存
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 清理旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ================= 请求拦截 =================
self.addEventListener('fetch', (event) => {
  // 忽略非GET请求和浏览器扩展请求
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        const networkFetch = fetch(event.request)
          .then((networkResponse) => {
            // 克隆响应以更新缓存
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
            return networkResponse;
          })
          .catch(() => {  // 网络请求失败处理
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_PAGE);
            }
            return Response.error();
          });

        // 优先返回缓存内容
        return cachedResponse || networkFetch;
      })
      .catch(() => {
        // 最终错误处理
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_PAGE);
        }
        return Response.error();
      })
  );
});