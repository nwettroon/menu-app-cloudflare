// Service Worker - PWA (#12)
const CACHE_NAME = 'menu-app-v8'; // Remove admin/receiver from initial payload
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/config.js',
    '/google-translate-controller.js',
    '/js/core.js',
    '/js/firebase.js',
    '/js/cart.js',
    '/js/renderer.js',
    '/js/printing.js',
    // '/js/admin.js', // يتم استبعاده لعدم تحميله للعملاء العاديين
    '/js/auth-payment.js',
    // '/receiver.html', // يتم استبعاده
    // '/js/receiver.js', // يتم استبعاده
    '/manifest.json',
    '/images/logo.jpg'
];

// تثبيت Service Worker وتخزين الملفات
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS).catch(err => {
                console.warn('SW: بعض الملفات لم يتم تخزينها:', err);
            });
        })
    );
    self.skipWaiting();
});

// تنظيف الكاش القديم
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) => {
            return Promise.all(
                names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// استراتيجية التحميل (Fetch Strategy)
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // تجاهل طلبات قواعد البيانات والترجمة
    if (url.includes('firebaseio.com') ||
        url.includes('googleapis.com') ||
        url.includes('gstatic.com') ||
        url.includes('translate.google.com')) {
        return;
    }

    // استراتيجية 1: (Cache First) للصور لتوفير الباندويث 
    // إذا كانت الصورة في بيناتا أو تنتهي بصيغة صورة
    const isImage = url.includes('pinata.cloud') ||
        url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i) ||
        event.request.destination === 'image';

    if (isImage) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // إذا كانت الصورة في الكاش (الذاكرة)، أرجعها فوراً بدون أي سحب للانترنت
                if (cachedResponse) {
                    return cachedResponse;
                }
                // وإلا قم بتحميلها لمرة واحدة واحفظها بالكاش
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque' || networkResponse.status === 0)) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // في حال انقطاع النت حتى لو لم تكن في الكاش (للمنع من الانهيار)
                    return new Response('', { status: 408, statusText: 'Offline' });
                });
            })
        );
        return;
    }

    // استراتيجية 2: (Network First) لباقي التحديثات والملفات النصية (HTML, JS, CSS)
    event.respondWith(
        fetch(event.request).then((response) => {
            if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
            }
            return response;
        }).catch(() => {
            return caches.match(event.request);
        })
    );
});
