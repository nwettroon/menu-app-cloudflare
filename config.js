/**
 * ===== إعدادات العملاء =====
 * هذا الملف يكشف تلقائياً أي عميل من الرابط (domain)
 * لإضافة عميل جديد: شغّل add-client.bat أو عدّل clients.json
 */

// بيانات العملاء - يتم تحميلها من clients.json
const CLIENTS_DATA = {
    "thejuicytaste": {
        name: "الكوخ",
        domains: ["thejuicytaste.web.app", "thejuicytaste.firebaseapp.com"],
        firebaseConfig: {
            apiKey: "AIzaSyAMp7SMpsiq6ri8zuvpVzN0nq_ydd8tODE",
            authDomain: "thejuicytaste.firebaseapp.com",
            databaseURL: "https://thejuicytaste-default-rtdb.firebaseio.com",
            projectId: "thejuicytaste",
            storageBucket: "thejuicytaste.firebasestorage.app",
            messagingSenderId: "423331500604",
            appId: "1:423331500604:web:c457a9e1d930bb24bc6939",
            measurementId: "G-K14QMMVMS1"
        }
    },
    "vitamin-c-5c074": {
        name: "ثمرة المذاق المنعش",
        domains: ["vitamin-c-5c074.web.app", "vitamin-c-5c074.firebaseapp.com"],
        moyasarPublishableKey: "pk_test_h67jUi6ZKv49amLbX9c3uu74av5ddUP9UEPntMQt",
        firebaseConfig: {
            apiKey: "AIzaSyDtYw7Znwp9jO2npbNP361SZnUQWivk6bM",
            authDomain: "vitamin-c-5c074.firebaseapp.com",
            databaseURL: "https://vitamin-c-5c074-default-rtdb.firebaseio.com",
            projectId: "vitamin-c-5c074",
            storageBucket: "vitamin-c-5c074.firebasestorage.app",
            messagingSenderId: "315684932125",
            appId: "1:315684932125:web:f927928ed8d361cbb094f4",
            measurementId: "G-T129CGNESM"
        }
    }
};

/**
 * كشف العميل الحالي من الرابط تلقائياً
 */
function detectClient() {
    const hostname = window.location.hostname;

    // البحث في كل العملاء عن الدومين المطابق
    for (const [clientId, client] of Object.entries(CLIENTS_DATA)) {
        if (client.domains.includes(hostname)) {
            console.log(`✅ تم التعرف على العميل: ${client.name} (${clientId})`);
            return { id: clientId, ...client };
        }
    }

    // لو localhost أو غير معروف - استخدم أول عميل (للتطوير المحلي)
    const firstKey = Object.keys(CLIENTS_DATA)[0];
    const fallback = CLIENTS_DATA[firstKey];
    console.log(`⚠️ دومين غير معروف (${hostname}) - استخدام: ${fallback.name}`);
    return { id: firstKey, ...fallback };
}

// === العميل الحالي ===
const CLIENT = detectClient();

// تصدير للاستخدام في app.js
export { CLIENT, CLIENTS_DATA };
