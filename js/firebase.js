/**
 * js/firebase.js - خدمة Firebase: التهيئة، التحميل، الحفظ
 * #7: دالة parseFirebaseData موحدة (بدل التكرار 4 مرات)
 * #10: مستمعات منفصلة للأقسام والمنتجات والإعدادات
 */
import { initializeApp as firebaseInit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, onValue, set, get, push, onChildAdded, onChildChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { CLIENT } from '../config.js';
import { state, applyFont, applyDesign, createDefaultData, showToast, getAdminKey } from './core.js';

// ====== الاستخراج لـ Branch ======
const urlParams = new URLSearchParams(window.location.search);
export const currentBranchId = urlParams.get('branch') || 'main';

// ====== تهيئة Firebase ======
let _firebaseApp, _database;
export let dbRef, categoriesRef, productsRef, settingsRef, branchesListRef, rootSettingsRef;
let _firebaseReady = false;

try {
    _firebaseApp = firebaseInit(CLIENT.firebaseConfig);
    _database = getDatabase(_firebaseApp);
    dbRef = ref(_database);

    // إعداد مسار الفرع
    const basePath = currentBranchId === 'main' ? '' : `branches/${currentBranchId}/`;
    categoriesRef = ref(_database, basePath + 'categories');
    productsRef = ref(_database, basePath + 'products');
    settingsRef = ref(_database, basePath + 'settings');
    rootSettingsRef = ref(_database, 'settings'); // الجذر دائماً لاختبار الدخول
    branchesListRef = ref(_database, 'branches_list'); // قائمة الفروع الجذرية

    _firebaseReady = true;
} catch (e) {
    console.error('خطأ في تهيئة Firebase:', e);
}

export function isFirebaseReady() { return _firebaseReady; }

// ====== محلل بيانات Firebase الموحد (#7) ======
export function parseFirebaseData(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return Object.keys(data)
        .filter(k => k !== 'admin_key')
        .sort((a, b) => Number(a) - Number(b))
        .map(k => data[k]);
}

// ====== Callbacks للتحديث ======
let _onDataChange = null;
export function setDataChangeHandler(fn) { _onDataChange = fn; }

// ====== تحميل البيانات (#10 - مستمعات منفصلة) ======
let _categoriesListenerAttached = false;
let _productsListenerAttached = false;
let _settingsListenerAttached = false;

export function loadDataFromServer() {
    if (!_firebaseReady) {
        console.warn('Firebase غير متصل - استخدام البيانات الافتراضية');
        if (state.categories.length === 0) createDefaultData();
        if (_onDataChange) _onDataChange();
        return;
    }

    // مستمع الأقسام
    if (!_categoriesListenerAttached) {
        _categoriesListenerAttached = true;
        onValue(categoriesRef, (snapshot) => {
            if (state._suppressFirebaseSync) return;
            const data = snapshot.val();
            state.categories = data ? parseFirebaseData(data) : [];
            if (state.categories.length === 0 && state.products.length === 0) createDefaultData();
            if (_onDataChange) _onDataChange();
        }, (error) => {
            console.error('خطأ في تحميل الأقسام:', error);
            if (state.categories.length === 0) createDefaultData();
            if (_onDataChange) _onDataChange();
        });
    }

    // مستمع المنتجات
    if (!_productsListenerAttached) {
        _productsListenerAttached = true;
        onValue(productsRef, (snapshot) => {
            if (state._suppressFirebaseSync) return;
            const data = snapshot.val();
            state.products = data ? parseFirebaseData(data) : [];
            if (_onDataChange) _onDataChange();
        }, (error) => {
            console.error('خطأ في تحميل المنتجات:', error);
        });
    }

    // مستمع الإعدادات
    if (!_settingsListenerAttached) {
        _settingsListenerAttached = true;
        onValue(settingsRef, (snapshot) => {
            const settings = snapshot.val();
            if (settings) {
                state.splitInvoice = settings.splitInvoice || false;
                state.printMethod = settings.printMethod || 'image';
                state.invoiceCounter = settings.invoiceCounter || 0;
                state.viewMode = settings.viewMode || 'grid';
                state.appFont = settings.appFont || 'default';
                applyFont(state.appFont);
                state.design = settings.design || null;
                if (settings.design) {
                    applyDesign(settings.design);
                }
                state.disableCart = settings.disableCart || false;
                state.disableBestSellers = settings.disableBestSellers || false;
                state.disableShifts = settings.disableShifts || false;
                state.disableAdminBtn = settings.disableAdminBtn || false;
                state.maintenanceMode = settings.maintenanceMode || false;
                state.enableOnlinePayment = settings.enableOnlinePayment || false;
                state.simulatePayment = settings.simulatePayment || false;

                if (_onDataChange) _onDataChange();
            }
        }, (error) => {
            console.error('خطأ في تحميل الإعدادات:', error);
        });
    }
}

// ====== حفظ البيانات ======
export function saveData() {
    const adminKey = getAdminKey();
    if (!_firebaseReady || !adminKey) return;

    const catObj = {};
    state.categories.forEach((c, i) => { catObj[i] = c; });
    catObj.admin_key = adminKey;

    const prodObj = {};
    state.products.forEach((p, i) => { prodObj[i] = p; });
    prodObj.admin_key = adminKey;

    Promise.all([set(categoriesRef, catObj), set(productsRef, prodObj)])
        .then(() => console.log('تم حفظ البيانات إلى Firebase'))
        .catch((error) => {
            console.error('خطأ في حفظ البيانات:', error);
            showToast('خطأ في حفظ البيانات - تحقق من كلمة المرور', 'error');
        });
}

// ====== حفظ الإعدادات ======
export function saveSettings(silent = false) {
    const adminKey = getAdminKey();
    if (!_firebaseReady || !adminKey) return;

    get(settingsRef).then((snapshot) => {
        const currentSettings = snapshot.val() || {};
        const settingsToSave = {
            splitInvoice: state.splitInvoice,
            printMethod: state.printMethod,
            invoiceCounter: state.invoiceCounter,
            admin_password: currentSettings.admin_password || adminKey,
            admin_key: adminKey,
            viewMode: state.viewMode,
            appFont: state.appFont,
            design: state.design || null,
            disableCart: state.disableCart,
            disableBestSellers: state.disableBestSellers,
            disableShifts: state.disableShifts,
            disableAdminBtn: state.disableAdminBtn,
            maintenanceMode: state.maintenanceMode,
            enableOnlinePayment: state.enableOnlinePayment || false,
            simulatePayment: state.simulatePayment || false
        };
        set(settingsRef, settingsToSave)
            .then(() => console.log('تم حفظ الإعدادات'))
            .catch((error) => console.error('خطأ في حفظ الإعدادات:', error));
    });
}

// ====== إعادة المزامنة من Firebase ======
export function resyncFromFirebase() {
    if (!_firebaseReady) return;
    Promise.all([get(categoriesRef), get(productsRef)]).then(([catSnap, prodSnap]) => {
        const catData = catSnap.val();
        const prodData = prodSnap.val();
        if (catData) state.categories = parseFirebaseData(catData);
        if (prodData) state.products = parseFirebaseData(prodData);
        if (_onDataChange) _onDataChange();
    }).catch(err => {
        console.error('خطأ في إعادة تحميل البيانات:', err);
    });
}

// ====== تحديث فوري (زر التحديث #5) ======
export function refreshAllData() {
    return new Promise((resolve, reject) => {
        if (!_firebaseReady) {
            reject(new Error('Firebase غير متصل'));
            return;
        }
        // تحديث كل شيء: أقسام + منتجات + إعدادات
        Promise.all([get(categoriesRef), get(productsRef), get(settingsRef)]).then(([catSnap, prodSnap, setSnap]) => {
            if (catSnap.val()) state.categories = parseFirebaseData(catSnap.val());
            if (prodSnap.val()) state.products = parseFirebaseData(prodSnap.val());
            const settings = setSnap.val();
            if (settings) {
                state.splitInvoice = settings.splitInvoice || false;
                state.printMethod = settings.printMethod || 'image';
                state.invoiceCounter = settings.invoiceCounter || 0;
                state.viewMode = settings.viewMode || 'grid';
                state.appFont = settings.appFont || 'default';
                state.disableShifts = settings.disableShifts || false;
                state.disableAdminBtn = settings.disableAdminBtn || false;
                state.maintenanceMode = settings.maintenanceMode || false;
                state.disableCart = settings.disableCart || false;
                state.enableOnlinePayment = settings.enableOnlinePayment || false;
                state.simulatePayment = settings.simulatePayment || false;
                applyFont(state.appFont);
                state.design = settings.design || null;
                if (settings.design) applyDesign(settings.design);
            }
            if (_onDataChange) _onDataChange();
            resolve();
        }).catch(err => {
            console.error('خطأ في تحديث البيانات:', err);
            reject(err);
        });
    });
}

// تصدير دوال Firebase للاستخدام في الإدارة والريسيفر
export { get, set, push, ref, onValue, onChildAdded, onChildChanged, settingsRef as settingsRefDirect };

// تصدير database instance لنظام الورديات وللريسيفر
export { _database as database };
export function getFirebaseDatabase() { return _database; }
