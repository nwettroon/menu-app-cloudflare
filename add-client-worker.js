/**
 * سكربت إضافة عميل جديد (يُستدعى من add-client.bat)
 * يقوم بتحديث clients.json و config.js تلقائياً
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 8) {
    console.error('بيانات ناقصة!');
    process.exit(1);
}

const [clientName, projectId, apiKey, authDomain, databaseURL, storageBucket, messagingSenderId, appId, measurementId] = args;

// === 1. تحديث clients.json ===
const clientsFile = path.join(__dirname, 'clients.json');
let clientsData = { clients: {} };

if (fs.existsSync(clientsFile)) {
    clientsData = JSON.parse(fs.readFileSync(clientsFile, 'utf8'));
}

// التأكد من عدم وجود نفس العميل
if (clientsData.clients[projectId]) {
    console.log(`⚠️ العميل "${projectId}" موجود بالفعل. سيتم تحديث بياناته.`);
}

// إضافة العميل الجديد
clientsData.clients[projectId] = {
    name: clientName,
    firebaseProjectId: projectId,
    domains: [`${projectId}.web.app`, `${projectId}.firebaseapp.com`],
    firebaseConfig: {
        apiKey: apiKey,
        authDomain: authDomain,
        databaseURL: databaseURL,
        projectId: projectId,
        storageBucket: storageBucket,
        messagingSenderId: messagingSenderId,
        appId: appId,
        ...(measurementId ? { measurementId: measurementId } : {})
    }
};

fs.writeFileSync(clientsFile, JSON.stringify(clientsData, null, 2), 'utf8');
console.log(`✅ تم تحديث clients.json`);

// === 2. إعادة توليد config.js ===
generateConfigJS(clientsData);
console.log(`✅ تم تحديث config.js`);

// === 3. إضافة المشروع لـ .firebaserc ===
const firebasercFile = path.join(__dirname, '.firebaserc');
let firebaserc = { projects: {} };

if (fs.existsSync(firebasercFile)) {
    firebaserc = JSON.parse(fs.readFileSync(firebasercFile, 'utf8'));
}

firebaserc.projects[projectId] = projectId;
// أول مشروع يكون الافتراضي
if (!firebaserc.projects.default) {
    firebaserc.projects.default = projectId;
}

fs.writeFileSync(firebasercFile, JSON.stringify(firebaserc, null, 2), 'utf8');
console.log(`✅ تم تحديث .firebaserc`);

console.log(`\n🎉 تم إضافة "${clientName}" (${projectId}) بنجاح!`);

// ========================================
// دالة توليد config.js من بيانات العملاء
// ========================================
function generateConfigJS(data) {
    let clientEntries = '';
    
    for (const [id, client] of Object.entries(data.clients)) {
        const configLines = Object.entries(client.firebaseConfig)
            .map(([key, val]) => `            ${key}: "${val}"`)
            .join(',\n');
        
        clientEntries += `    "${id}": {
        name: "${client.name}",
        domains: ${JSON.stringify(client.domains)},
        firebaseConfig: {
${configLines}
        }
    },\n`;
    }

    const configJS = `/**
 * ===== إعدادات العملاء =====
 * هذا الملف يُولَّد تلقائياً - لا تعدّله يدوياً!
 * لإضافة عميل جديد: شغّل add-client.bat
 * آخر تحديث: ${new Date().toLocaleString('ar-SA')}
 */

const CLIENTS_DATA = {
${clientEntries}};

/**
 * كشف العميل الحالي من الرابط تلقائياً
 */
function detectClient() {
    const hostname = window.location.hostname;
    
    for (const [clientId, client] of Object.entries(CLIENTS_DATA)) {
        if (client.domains.includes(hostname)) {
            console.log(\`✅ تم التعرف على العميل: \${client.name} (\${clientId})\`);
            return { id: clientId, ...client };
        }
    }
    
    const firstKey = Object.keys(CLIENTS_DATA)[0];
    const fallback = CLIENTS_DATA[firstKey];
    console.log(\`⚠️ دومين غير معروف (\${hostname}) - استخدام: \${fallback.name}\`);
    return { id: firstKey, ...fallback };
}

const CLIENT = detectClient();

export { CLIENT, CLIENTS_DATA };
`;

    fs.writeFileSync(path.join(__dirname, 'config.js'), configJS, 'utf8');
}
