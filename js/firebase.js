/**
 * js/firebase.js - محاكي كلاود فلير (بديل فايربيس بالكامل)
 * هذا الملف تم تعديله لفصل فايربيس واستخدام Cloudflare KV بدلاً منه عبر الـ API
 */
import { CLIENT } from '../config.js';
import { state, applyFont, applyDesign, createDefaultData, showToast, getAdminKey } from './core.js';

const urlParams = new URLSearchParams(window.location.search);
export const currentBranchId = urlParams.get('branch') || 'main';

// ====== وهميات لمنع تعطل الأكواد الأخرى (Mock Refs) ======
export const dbRef = "root";
export const categoriesRef = "categories";
export const productsRef = "products";
export const settingsRef = "settings";
export const branchesListRef = "branches_list";
export const rootSettingsRef = "root_settings";

export function isFirebaseReady() { return true; }

export function parseFirebaseData(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return Object.keys(data)
        .filter(k => k !== 'admin_key')
        .sort((a, b) => Number(a) - Number(b))
        .map(k => data[k]);
}

let _onDataChange = null;
export function setDataChangeHandler(fn) { _onDataChange = fn; }

// ====== دوال الاتصال مع Cloudflare KV API ======
async function fetchKVData() {
    // نجلب البيانات مع دعم الفروع
    const branchParam = currentBranchId === 'main' ? '' : `-${currentBranchId}`;
    const clientIdWithBranch = CLIENT.id + branchParam;
    try {
        const res = await fetch(`/api/data?client=${clientIdWithBranch}`);
        const data = await res.json();
        return (data && !data.message) ? data : null;
    } catch (e) {
        console.error("KV Fetch Error:", e);
        return null;
    }
}

async function saveKVData(payload) {
    const branchParam = currentBranchId === 'main' ? '' : `-${currentBranchId}`;
    const clientIdWithBranch = CLIENT.id + branchParam;
    try {
        await fetch(`/api/data?client=${clientIdWithBranch}`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error("KV Save Error:", e);
        throw e;
    }
}

// ====== تحميل وحفظ البيانات للنظام ======
export async function loadDataFromServer() {
    const data = await fetchKVData();
    if (data) {
        state.categories = data.categories ? parseFirebaseData(data.categories) : [];
        state.products = data.products ? parseFirebaseData(data.products) : [];

        const settings = data.settings || {};
        state.splitInvoice = settings.splitInvoice || false;
        state.printMethod = settings.printMethod || 'image';
        state.invoiceCounter = settings.invoiceCounter || 0;
        state.viewMode = settings.viewMode || 'grid';
        state.appFont = settings.appFont || 'default';
        applyFont(state.appFont);

        state.design = settings.design || null;
        if (settings.design) applyDesign(settings.design);

        state.disableCart = settings.disableCart || false;
        state.disableBestSellers = settings.disableBestSellers || false;
        state.disableShifts = settings.disableShifts || false;
        state.disableAdminBtn = settings.disableAdminBtn || false;
        state.maintenanceMode = settings.maintenanceMode || false;
        state.enableOnlinePayment = settings.enableOnlinePayment || false;
        state.simulatePayment = settings.simulatePayment || false;
    } else {
        if (state.categories.length === 0) createDefaultData();
    }
    if (_onDataChange) _onDataChange();
}

export async function saveData() {
    const adminKey = getAdminKey();
    if (!adminKey) return;

    // تحويل المصفوفات لصيغة تقرأها الدوال
    const catObj = {};
    state.categories.forEach((c, i) => { catObj[i] = c; });
    catObj.admin_key = adminKey;

    const prodObj = {};
    state.products.forEach((p, i) => { prodObj[i] = p; });
    prodObj.admin_key = adminKey;

    try {
        const currentData = await fetchKVData() || {};
        const payload = { ...currentData, categories: catObj, products: prodObj };
        await saveKVData(payload);
        console.log('تم حفظ البيانات للكلاود فلير');
    } catch (e) {
        showToast('خطأ في حفظ البيانات', 'error');
    }
}

export async function saveSettings(silent = false) {
    const adminKey = getAdminKey();
    if (!adminKey) return;

    try {
        const currentData = await fetchKVData() || {};
        const currentSettings = currentData.settings || {};
        const settingsToSave = {
            ...currentSettings,
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
        const payload = { ...currentData, settings: settingsToSave };
        await saveKVData(payload);
        if (!silent) console.log('تم حفظ الإعدادات');
    } catch (e) {
        console.error('خطأ في حفظ الإعدادات:', e);
    }
}

export async function resyncFromFirebase() {
    await loadDataFromServer();
}

export async function refreshAllData() {
    await loadDataFromServer();
}

// ====== دوال وهمية لمنع تعطل كود الريسيفر والإدارة القديم ======
export function get() { return Promise.resolve({ val: () => null }); }
export function set() { return Promise.resolve(); }
export function push() { return { key: Date.now().toString() }; }
export function ref() { return "mock_ref"; }
export function onValue() { }
export function onChildAdded() { }
export function onChildChanged() { }
export const settingsRefDirect = settingsRef;

export const database = {};
export function getFirebaseDatabase() { return database; }
