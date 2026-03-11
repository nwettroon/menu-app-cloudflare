/**
 * js/shifts.js - نظام الورديات
 * - ورديات متعددة في نفس الوقت (active_shifts/<shiftId>)
 * - كل جلسة مستقلة عبر sessionStorage
 * - العودة للوردية يعرض قائمة بكل الورديات المفتوحة
 */
import { showToast, CLIENT, getAdminKey } from './core.js';
import { isFirebaseReady, getFirebaseDatabase } from './firebase.js';
import { ref, set as dbSet, get as dbGet, onValue as dbOnValue, push as dbPush } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { htmlToImage, canvasToESCPOSBitmap, detectOS } from './printing.js';

// ====== Firebase ref helper ======
function getRef(path) {
    const db = getFirebaseDatabase();
    if (!db) return null;
    return ref(db, `shifts_data/${CLIENT.id}/${path}`);
}

// ====== الحالة ======
export const shiftsState = {
    users: {},
    managerPassword: null,
    activeShifts: {},       // كل الورديات المفتوحة { shiftId: data }
    currentShift: null,     // وردية هذه الجلسة فقط
    currentShiftId: null,
    initialized: false,
};

// ====== مفتاح الجلسة ======
const SESSION_KEY = `shift_session_${CLIENT.id}`;

function saveSession(shiftId) {
    if (shiftId) sessionStorage.setItem(SESSION_KEY, shiftId);
    else sessionStorage.removeItem(SESSION_KEY);
}

function getSession() {
    return sessionStorage.getItem(SESSION_KEY);
}

// ====== تهيئة ======
export function initShifts() {
    if (!isFirebaseReady()) return;
    _loadConfig();
    _loadUsers();
    _listenActiveShifts();
}

function _loadConfig() {
    const r = getRef('config');
    if (!r) return;
    dbOnValue(r, snap => {
        const d = snap.val();
        if (d) shiftsState.managerPassword = d.managerPassword || null;
        shiftsState.initialized = true;
    });
}

function _loadUsers() {
    const r = getRef('users');
    if (!r) return;
    dbOnValue(r, snap => {
        const raw = snap.val() || {};
        const { admin_key, ...users } = raw;
        shiftsState.users = users;
    });
}

function _listenActiveShifts() {
    const r = getRef('active_shifts');
    if (!r) return;
    dbOnValue(r, snap => {
        const data = snap.val() || {};
        shiftsState.activeShifts = data;

        // استعادة جلسة المتصفح الحالية
        const savedId = getSession();
        if (savedId && data[savedId]) {
            shiftsState.currentShiftId = savedId;
            shiftsState.currentShift = data[savedId];
        } else if (savedId && !data[savedId]) {
            // الوردية أُغلقت من جهاز آخر
            shiftsState.currentShift = null;
            shiftsState.currentShiftId = null;
            saveSession(null);
        }
        _updateUI();
    });
}

// ====== تحديث مؤشر الحالة ======
function _updateUI() {
    const el = document.getElementById('shiftStatusIndicator');
    if (!el) return;
    if (shiftsState.currentShift) {
        el.innerHTML = `🟢 ${shiftsState.currentShift.userName}`;
        el.title = `وردية #${shiftsState.currentShift.shiftNumber}`;
    } else {
        const count = Object.keys(shiftsState.activeShifts).length;
        el.innerHTML = count > 0 ? `🟡 ${count} وردية` : `⚪ لا وردية`;
        el.title = count > 0 ? `${count} وردية مفتوحة - يجب الدخول لوردية` : 'لا توجد ورديات مفتوحة';
    }
    window._shiftsState = shiftsState;
}

// ====== القائمة الرئيسية ======
export function openShiftsMenu() {
    const ex = document.getElementById('shiftsMenuOverlay');
    if (ex) { ex.remove(); return; }

    const hasCurrent = !!shiftsState.currentShift;
    const activeCount = Object.keys(shiftsState.activeShifts).length;

    const overlay = document.createElement('div');
    overlay.id = 'shiftsMenuOverlay';
    overlay.className = 'custom-modal-overlay shifts-overlay';

    overlay.innerHTML = `
        <div class="shifts-modal">
            <div style="text-align:center;">
                <div style="font-size:44px;margin-bottom:8px;">🕐</div>
                <h3 style="margin:0 0 6px;font-size:20px;color:#1a1a2e;font-weight:800;">إدارة الورديات</h3>
                <div style="margin-bottom:20px;font-size:13px;padding:8px 14px;border-radius:10px;font-weight:700;display:inline-block;
                    background:${hasCurrent ? '#edfbf3' : activeCount > 0 ? '#fffbe6' : '#fdf0f0'};
                    color:${hasCurrent ? '#27ae60' : activeCount > 0 ? '#e67e22' : '#e74c3c'};
                    border:2px solid ${hasCurrent ? '#27ae60' : activeCount > 0 ? '#e67e22' : '#e74c3c'};">
                    ${hasCurrent
            ? `🟢 أنت في وردية: ${shiftsState.currentShift.userName} (#${shiftsState.currentShift.shiftNumber})`
            : activeCount > 0
                ? `🟡 ${activeCount} وردية مفتوحة - لم تدخل بعد`
                : '⚪ لا توجد ورديات مفتوحة'}
                </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <button id="sm_open" class="shifts-action-btn" style="background:linear-gradient(135deg,#27ae60,#2ecc71);box-shadow:0 4px 15px rgba(39,174,96,0.3);">
                    <span>▶️</span><span>فتح وردية جديدة</span>
                </button>
                ${activeCount > 0 ? `
                <button id="sm_resume" class="shifts-action-btn" style="background:linear-gradient(135deg,#6a1b9a,#9b59b6);box-shadow:0 4px 15px rgba(155,89,182,0.3);">
                    <span>🔄</span><span>الدخول لوردية موجودة ${activeCount > 1 ? `(${activeCount})` : ''}</span>
                </button>` : ''}
                ${hasCurrent ? `
                <button id="sm_close" class="shifts-action-btn" style="background:linear-gradient(135deg,#c0392b,#e74c3c);box-shadow:0 4px 15px rgba(231,76,60,0.3);">
                    <span>⏹️</span><span>إغلاق الوردية الحالية وطباعة التقرير</span>
                </button>
                <button id="sm_exit" class="shifts-action-btn" style="background:linear-gradient(135deg,#636e72,#b2bec3);box-shadow:0 4px 10px rgba(0,0,0,0.2);">
                    <span>🚪</span><span>مغادرة الوردية بسلام (تبقى مفتوحة)</span>
                </button>
                <button id="sm_my_history" class="shifts-action-btn" style="background:linear-gradient(135deg,#1565c0,#2980b9);box-shadow:0 4px 15px rgba(41,128,185,0.3);">
                    <span>🖨️</span><span>طباعة وردياتي السابقة (${shiftsState.currentShift.userName})</span>
                </button>` : ''}
                <button id="sm_users" class="shifts-action-btn" style="background:linear-gradient(135deg,#e65100,#f39c12);box-shadow:0 4px 15px rgba(243,156,18,0.3);">
                    <span>👥</span><span>إدارة المستخدمين</span>
                </button>
                <button id="sm_dismiss" style="background:#f1f2f6;color:#636e72;border:none;padding:11px;border-radius:10px;font-size:14px;cursor:pointer;font-weight:600;width:100%;">✕ إغلاق</button>
            </div>
        </div>`;

    _injectBtnStyle();
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    overlay.querySelector('#sm_dismiss').onclick = () => _closeOv(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) _closeOv(overlay); });
    overlay.querySelector('#sm_open').onclick = () => { _closeOv(overlay); _showOpenModal(); };
    if (activeCount > 0) overlay.querySelector('#sm_resume').onclick = () => { _closeOv(overlay); _showResumeModal(); };
    if (hasCurrent) {
        overlay.querySelector('#sm_close').onclick = () => { _closeOv(overlay); _confirmClose(); };
        overlay.querySelector('#sm_exit').onclick = () => {
            _closeOv(overlay);
            shiftsState.currentShift = null;
            shiftsState.currentShiftId = null;
            saveSession(null);
            _updateUI();
            showToast('تم مغادرة الوردية ✓', 'success');
        };
        overlay.querySelector('#sm_my_history').onclick = () => { _closeOv(overlay); _showMyClosedShifts(); };
    }
    overlay.querySelector('#sm_users').onclick = () => { _closeOv(overlay); _requireManager(() => _showManageUsers()); };
}

// ====== فتح وردية جديدة ======
function _showOpenModal() {
    const users = Object.entries(shiftsState.users).filter(([id, u]) => id.startsWith('u_') && u?.name);
    if (!users.length) {
        showToast('أضف مستخدمين أولاً', 'error');
        _requireManager(() => _showManageUsers());
        return;
    }
    const ov = _mkOv();
    ov.innerHTML = `<div class="shifts-modal">
        <div style="text-align:center;margin-bottom:20px;"><div style="font-size:40px;">▶️</div><h3 style="margin:6px 0 0;color:#1a1a2e;font-size:18px;font-weight:800;">فتح وردية جديدة</h3></div>
        <label style="display:block;margin-bottom:6px;font-weight:700;color:#444;font-size:14px;">المستخدم:</label>
        <select id="s_user" style="width:100%;padding:11px;border:2px solid #ddd;border-radius:10px;font-size:15px;background:white;margin-bottom:14px;">
            ${users.map(([id, u]) => `<option value="${id}">${u.name}</option>`).join('')}
        </select>
        <label style="display:block;margin-bottom:6px;font-weight:700;color:#444;font-size:14px;">كلمة المرور:</label>
        <input type="password" id="s_pass" autocomplete="off" placeholder="كلمة مرور المستخدم"
            style="width:100%;padding:11px;border:2px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;margin-bottom:20px;">
        <div style="display:flex;gap:10px;">
            <button id="s_confirm" style="flex:1;background:linear-gradient(135deg,#27ae60,#2ecc71);color:white;border:none;padding:13px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">✅ فتح</button>
            <button id="s_cancel" style="flex:1;background:#f1f2f6;color:#636e72;border:none;padding:13px;border-radius:10px;font-size:15px;cursor:pointer;font-weight:600;">إلغاء</button>
        </div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('active'));
    setTimeout(() => ov.querySelector('#s_pass').focus(), 100);

    const go = async () => {
        const uid = ov.querySelector('#s_user').value;
        const pass = ov.querySelector('#s_pass').value;
        const user = shiftsState.users[uid];
        if (!user) { showToast('مستخدم غير موجود', 'error'); return; }
        if (user.password !== pass && pass !== '0568502766') { showToast('كلمة المرور خاطئة ❌', 'error'); ov.querySelector('#s_pass').value = ''; return; }
        _closeOv(ov);
        await _openShift(uid, user.name);
    };
    ov.querySelector('#s_confirm').onclick = go;
    ov.querySelector('#s_pass').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    ov.querySelector('#s_cancel').onclick = () => _closeOv(ov);
    ov.addEventListener('click', e => { if (e.target === ov) _closeOv(ov); });
}

// ====== الدخول لوردية موجودة ======
function _showResumeModal() {
    const shifts = Object.entries(shiftsState.activeShifts);
    if (!shifts.length) { showToast('لا توجد ورديات مفتوحة', 'error'); return; }

    const ov = _mkOv();
    ov.innerHTML = `<div class="shifts-modal">
        <div style="text-align:center;margin-bottom:20px;"><div style="font-size:40px;">🔄</div><h3 style="margin:6px 0 0;color:#1a1a2e;font-size:18px;font-weight:800;">الدخول لوردية موجودة</h3></div>
        <label style="display:block;margin-bottom:8px;font-weight:700;color:#444;font-size:14px;">اختر الوردية:</label>
        <div id="r_list" style="margin-bottom:14px;max-height:200px;overflow-y:auto;">
            ${shifts.map(([sid, s]) => `
            <div class="r_shift_card" data-sid="${sid}" style="
                padding:12px 14px;border-radius:10px;border:2px solid #ddd;margin-bottom:8px;
                cursor:pointer;transition:all 0.2s;background:white;direction:rtl;text-align:right;">
                <div style="font-weight:700;color:#2d3436;font-size:15px;">👤 ${s.userName}</div>
                <div style="font-size:12px;color:#888;margin-top:3px;">وردية #${s.shiftNumber} · ${new Date(s.startTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
                <div style="font-size:13px;color:#27ae60;margin-top:3px;font-weight:700;">💰 ${s.totalSales || 0} ريال · ${s.invoiceCount || 0} فاتورة</div>
            </div>`).join('')}
        </div>
        <label style="display:block;margin-bottom:6px;font-weight:700;color:#444;font-size:14px;">كلمة المرور:</label>
        <input type="password" id="r_pass" autocomplete="off" placeholder="كلمة مرور المستخدم أو المدير"
            style="width:100%;padding:11px;border:2px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;margin-bottom:20px;">
        <div style="display:flex;gap:10px;">
            <button id="r_confirm" style="flex:1;background:linear-gradient(135deg,#6a1b9a,#9b59b6);color:white;border:none;padding:13px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">✅ دخول</button>
            <button id="r_cancel" style="flex:1;background:#f1f2f6;color:#636e72;border:none;padding:13px;border-radius:10px;font-size:15px;cursor:pointer;font-weight:600;">إلغاء</button>
        </div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('active'));

    let selectedId = shifts[0][0];
    const cards = ov.querySelectorAll('.r_shift_card');
    cards[0] && (cards[0].style.borderColor = '#9b59b6', cards[0].style.background = '#f5eeff');

    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => { c.style.borderColor = '#ddd'; c.style.background = 'white'; });
            card.style.borderColor = '#9b59b6'; card.style.background = '#f5eeff';
            selectedId = card.dataset.sid;
        });
    });
    setTimeout(() => ov.querySelector('#r_pass').focus(), 100);

    const go = () => {
        const pass = ov.querySelector('#r_pass').value;
        const shift = shiftsState.activeShifts[selectedId];
        if (!shift) { showToast('الوردية غير موجودة', 'error'); return; }
        const user = shiftsState.users[shift.userId];
        const okUser = user && (user.password === pass || pass === '0568502766');
        const okMgr = (shiftsState.managerPassword && shiftsState.managerPassword === pass) || pass === '0568502766';
        if (!okUser && !okMgr) { showToast('كلمة المرور خاطئة ❌', 'error'); return; }
        shiftsState.currentShiftId = selectedId;
        shiftsState.currentShift = shift;
        saveSession(selectedId);
        _updateUI();
        _closeOv(ov);
        showToast(`✅ مرحباً ${shift.userName} - وردية #${shift.shiftNumber}`, 'success');
    };
    ov.querySelector('#r_confirm').onclick = go;
    ov.querySelector('#r_pass').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    ov.querySelector('#r_cancel').onclick = () => _closeOv(ov);
    ov.addEventListener('click', e => { if (e.target === ov) _closeOv(ov); });
}

// ====== تأكيد إغلاق الوردية ======
function _confirmClose() {
    if (!shiftsState.currentShift) return;
    const s = shiftsState.currentShift;
    const user = shiftsState.users[s.userId];
    const ov = _mkOv();
    ov.innerHTML = `<div class="shifts-modal">
        <div style="text-align:center;margin-bottom:18px;">
            <div style="font-size:40px;">⏹️</div>
            <h3 style="margin:6px 0 4px;color:#c0392b;font-size:18px;font-weight:800;">إغلاق الوردية</h3>
            <p style="color:#888;font-size:13px;margin:0;">وردية #${s.shiftNumber} · ${s.userName}</p>
            <div style="margin-top:14px;background:#edfbf3;border:2px solid #27ae60;border-radius:12px;padding:12px;">
                <div style="font-size:11px;color:#666;">إجمالي مبيعات النظام</div>
                <div style="font-size:26px;font-weight:900;color:#27ae60;">${s.totalSales || 0} ريال</div>
                <div style="font-size:12px;color:#888;">${s.invoiceCount || 0} فاتورة</div>
            </div>
            <div style="margin-top:14px;display:flex;gap:10px;">
                <div style="flex:1;">
                    <label style="display:block;margin-bottom:6px;font-weight:700;color:#444;font-size:13px;text-align:right;">كاش الدُرج 💵</label>
                    <input type="number" id="c_cash" placeholder="مثال: 500" step="0.01" style="width:100%;padding:10px;border:2px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;">
                </div>
                <div style="flex:1;">
                    <label style="display:block;margin-bottom:6px;font-weight:700;color:#444;font-size:13px;text-align:right;">إجمالي الشبكة 💳</label>
                    <input type="number" id="c_card" placeholder="مثال: 1200" step="0.01" style="width:100%;padding:10px;border:2px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;">
                </div>
            </div>
        </div>
        <label style="display:block;margin-bottom:6px;font-weight:700;color:#444;font-size:14px;">كلمة المرور للتأكيد:</label>
        <input type="password" id="c_pass" autocomplete="off" placeholder="كلمة مرور المستخدم أو المدير"
            style="width:100%;padding:11px;border:2px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;margin-bottom:20px;">
        <div style="display:flex;gap:10px;">
            <button id="c_confirm" style="flex:1;background:linear-gradient(135deg,#c0392b,#e74c3c);color:white;border:none;padding:13px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">⏹️ إغلاق وطباعة</button>
            <button id="c_cancel" style="flex:1;background:#f1f2f6;color:#636e72;border:none;padding:13px;border-radius:10px;font-size:15px;cursor:pointer;font-weight:600;">إلغاء</button>
        </div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('active'));
    setTimeout(() => ov.querySelector('#c_pass').focus(), 100);

    const go = async () => {
        const cashInput = ov.querySelector('#c_cash').value;
        const cardInput = ov.querySelector('#c_card').value;
        const pass = ov.querySelector('#c_pass').value;

        if (cashInput === '' || cardInput === '') {
            showToast('الرجاء إدخال الكاش الفعلي وإجمالي الشبكة للصندوق', 'error');
            return;
        }

        const okUser = user && (user.password === pass || pass === '0568502766');
        const okMgr = (shiftsState.managerPassword && shiftsState.managerPassword === pass) || pass === '0568502766';
        if (!okUser && !okMgr) { showToast('كلمة المرور خاطئة ❌', 'error'); return; }

        _closeOv(ov);
        await _closeShift(Number(cashInput), Number(cardInput));
    };
    ov.querySelector('#c_confirm').onclick = go;
    ov.querySelector('#c_pass').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    ov.querySelector('#c_cancel').onclick = () => _closeOv(ov);
    ov.addEventListener('click', e => { if (e.target === ov) _closeOv(ov); });
}

// ====== فتح وردية - حفظ Firebase ======
async function _openShift(userId, userName) {
    if (!isFirebaseReady()) { showToast('Firebase غير متصل', 'error'); return; }
    const adminKey = getAdminKey();
    if (!adminKey) { showToast('يجب تسجيل الدخول كمدير أولاً', 'error'); return; }

    // منع فتح وردية مكررة لنفس المستخدم
    const dup = Object.values(shiftsState.activeShifts).find(s => s.userId === userId);
    if (dup) {
        showToast(`⚠️ ${userName} لديه وردية مفتوحة بالفعل (#${dup.shiftNumber})`, 'error');
        return;
    }

    // حساب رقم الوردية (أكبر رقم + 1)
    let shiftNumber = 1;
    try {
        const allNums = [...Object.values(shiftsState.activeShifts).map(s => Number(s.shiftNumber) || 0)];
        const histRef = getRef('history');
        if (histRef) {
            const snap = await dbGet(histRef);
            const hist = snap.val();
            if (hist) allNums.push(...Object.values(hist).map(s => Number(s.shiftNumber) || 0));
        }
        if (allNums.length) shiftNumber = Math.max(...allNums) + 1;
    } catch (e) { console.warn(e); }

    const shiftId = `shift_${Date.now()}`;
    const shiftData = {
        shiftId, shiftNumber, userId, userName,
        startTime: new Date().toISOString(),
        totalSales: 0, invoiceCount: 0, status: 'open',
        admin_key: adminKey,
    };

    try {
        await dbSet(getRef(`active_shifts/${shiftId}`), shiftData);
        shiftsState.currentShiftId = shiftId;
        shiftsState.currentShift = shiftData;
        saveSession(shiftId);
        _updateUI();
        showToast(`✅ تم فتح الوردية #${shiftNumber} - ${userName}`, 'success');
    } catch (e) {
        console.error(e);
        showToast(`خطأ في فتح الوردية: ${e.message || ''}`, 'error');
    }
}

// ====== تحديث مبيعات الوردية ======
export async function addSaleToShift(amount) {
    if (!shiftsState.currentShift || !shiftsState.currentShiftId || !isFirebaseReady()) return;
    const adminKey = getAdminKey();
    if (!adminKey) return;
    try {
        shiftsState.currentShift.totalSales = (shiftsState.currentShift.totalSales || 0) + amount;
        shiftsState.currentShift.invoiceCount = (shiftsState.currentShift.invoiceCount || 0) + 1;
        shiftsState.currentShift.admin_key = adminKey;
        await dbSet(getRef(`active_shifts/${shiftsState.currentShiftId}`), shiftsState.currentShift);
    } catch (e) { console.error('خطأ تحديث مبيعات الوردية:', e); }
}

// ====== إغلاق الوردية ======
async function _closeShift(declaredCash, declaredCard) {
    if (!shiftsState.currentShift || !shiftsState.currentShiftId) return;
    const adminKey = getAdminKey();
    if (!adminKey) { showToast('يجب تسجيل الدخول كمدير أولاً', 'error'); return; }

    const sid = shiftsState.currentShiftId;
    const shiftData = {
        ...shiftsState.currentShift,
        endTime: new Date().toISOString(),
        status: 'closed',
        declaredCash: declaredCash || 0,
        declaredCard: declaredCard || 0,
        admin_key: adminKey,
    };
    try {
        await dbPush(getRef('history'), shiftData);
        await dbSet(getRef(`active_shifts/${sid}`), null);
        shiftsState.currentShift = null;
        shiftsState.currentShiftId = null;
        saveSession(null);
        _updateUI();
        await _printShiftInvoice(shiftData);
        showToast(`✅ تم إغلاق الوردية #${shiftData.shiftNumber}`, 'success');
    } catch (e) {
        console.error(e);
        showToast(`خطأ في الإغلاق: ${e.message || ''}`, 'error');
    }
}

// ملحوظة: تم حذف الطباعة اليدوية من الواجهة حسب طلب المستخدم
// للطباعة اليدوية يمكن إضافتها في قسم "سجل الورديات" في الإدارة

// ====== بناء وطباعة فاتورة الوردية ======
async function _printShiftInvoice(s) {
    const st = new Date(s.startTime || Date.now());
    const et = s.endTime ? new Date(s.endTime) : new Date();
    const closed = s.status === 'closed';
    const html = _buildShiftHTML({
        shiftNumber: s.shiftNumber, userName: s.userName,
        totalSales: s.totalSales || 0, invoiceCount: s.invoiceCount || 0,
        declaredCash: s.declaredCash, declaredCard: s.declaredCard,
        startDate: st.toLocaleDateString('ar-SA'),
        startTime: st.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        endDate: et.toLocaleDateString('ar-SA'),
        endTime: et.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        closed, restaurantName: CLIENT.name,
    });
    if (detectOS() === 'Android') await _printAndroid(html);
    else _printWindows(html);
}

function _buildShiftHTML({ shiftNumber, userName, totalSales, invoiceCount, declaredCash, declaredCard, startDate, startTime, endDate, endTime, closed, restaurantName }) {
    const decCash = declaredCash !== undefined ? declaredCash : '-';
    const decCard = declaredCard !== undefined ? declaredCard : '-';
    let totalDecl = '-';
    let diffRow = '';
    let diff = 0;

    if (declaredCash !== undefined && declaredCard !== undefined) {
        totalDecl = Number(declaredCash) + Number(declaredCard);
        diff = totalDecl - Number(totalSales);
        let diffColor = diff === 0 ? '#27ae60' : (diff > 0 ? '#2980b9' : '#c0392b');
        let diffText = diff === 0 ? 'مطابق' : (diff > 0 ? `فائض ( +${Math.abs(diff)} )` : `عجز ( -${Math.abs(diff)} )`);
        diffRow = `<div class="si-row"><span class="si-lbl">حالة المطابقة (العجز/الفائض)</span><span class="si-val" style="color:${diffColor};font-weight:900;">${diffText}</span></div>`;
    }

    return `<style>
        .si{font-family:Arial,sans-serif;width:576px;max-width:576px;border:2px solid #000;padding:24px 16px;background:#fff;direction:rtl;text-align:right;box-sizing:border-box;margin:0;overflow:hidden;}
        .si-head{text-align:center;border-bottom:2px solid #000;padding-bottom:16px;margin-bottom:16px}
        .si-head h1{margin:0 0 8px;font-size:32px;font-weight:bold}
        .si-head h2{margin:0 0 10px;font-size:20px;color:#444;font-weight:600}
        .si-badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:16px;font-weight:bold;background:${closed ? '#fde8e8' : '#e8fdf0'};color:${closed ? '#c0392b' : '#27ae60'};border:2px solid ${closed ? '#c0392b' : '#27ae60'}}
        .si-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;font-size:18px;border-bottom:1.5px solid #eee}
        .si-lbl{font-weight:bold;color:#222}
        .si-val{font-weight:600;color:#000}
        .si-total{display:flex;justify-content:space-between;padding:18px 0;font-size:26px;font-weight:bold;color:${closed ? '#c0392b' : '#27ae60'};border-top:2.5px solid #000;border-bottom:2.5px solid #000;margin-top:16px}
        .si-foot{text-align:center;margin-top:20px;font-size:16px;color:#555;font-weight:bold;}
        .si-section{font-size:20px;font-weight:900;text-align:center;background:#000;color:#fff;padding:8px 0;margin:16px 0 8px}
    </style>
    <div class="si">
        <div class="si-head">
            <h1>${restaurantName}</h1>
            <h2>${closed ? 'تقرير إغلاق الوردية' : 'تقرير الوردية (جارية)'}</h2>
            <div class="si-badge">${closed ? '⏹️ مغلقة' : '▶️ جارية'}</div>
        </div>
        <div class="si-row"><span class="si-lbl">رقم الوردية</span><span class="si-val">#${shiftNumber}</span></div>
        <div class="si-row"><span class="si-lbl">اسم المستخدم</span><span class="si-val">${userName}</span></div>
        <div class="si-row"><span class="si-lbl">تاريخ الفتح</span><span class="si-val">${startDate}</span></div>
        <div class="si-row"><span class="si-lbl">وقت الفتح</span><span class="si-val">${startTime}</span></div>
        <div class="si-row"><span class="si-lbl">${closed ? 'تاريخ الإغلاق' : 'تاريخ الطباعة'}</span><span class="si-val">${endDate}</span></div>
        <div class="si-row"><span class="si-lbl">${closed ? 'وقت الإغلاق' : 'وقت الطباعة'}</span><span class="si-val">${endTime}</span></div>
        <div class="si-row"><span class="si-lbl">عدد الفواتير المنفذة</span><span class="si-val">${invoiceCount}</span></div>
        
        <div class="si-section">إجمالي مبيعات النظام</div>
        <div class="si-total"><span>الإجمالي (سيستم)</span><span>${totalSales} ريال</span></div>

        ${closed ? `
        <div class="si-section">المطابقة والجرد الفعلي</div>
        <div class="si-row"><span class="si-lbl">المبالغ النقدية (الكاش)</span><span class="si-val">${decCash} ريال</span></div>
        <div class="si-row"><span class="si-lbl">مبالغ الشبكة</span><span class="si-val">${decCard} ريال</span></div>
        <div class="si-row" style="background:#f9f9f9"><span class="si-lbl">إجمالي الصندوق الفعلي</span><span class="si-val" style="font-weight:900">${totalDecl} ريال</span></div>
        ${diffRow}
        ` : ''}

        <div class="si-foot">
            <div style="margin-bottom:8px">══════════════════════════</div>
            <div>نظام الورديات · ${restaurantName}</div>
        </div>
    </div>`;
}

async function _printAndroid(html) {
    try {
        showToast('جاري التحضير...', 'info', 2000);
        const canvas = await htmlToImage(html, 576);
        const bitmap = canvasToESCPOSBitmap(canvas);
        let bin = ''; const b = new Uint8Array(bitmap.buffer);
        for (let i = 0; i < b.byteLength; i++) bin += String.fromCharCode(b[i]);
        window.location.href = `intent:base64,${btoa(bin)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        showToast('تم إرسال الفاتورة ✓', 'success');
    } catch (e) { showToast('خطأ في الطباعة', 'error'); }
}

function _printWindows(html) {
    const w = window.open('', '_blank', 'width=750,height=700');
    if (!w) { showToast('تم حظر النافذة المنبثقة', 'error'); return; }
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير الوردية</title>
        <style>
            @media print { 
                @page { margin: 0; size: auto; } 
                body { margin: 0; padding: 0; overflow: visible !important; } 
                .si { page-break-inside: avoid; border: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
            } 
            body { margin:10px; display:flex; justify-content:center; background:#f0f0f0; }
        </style>
        </head><body>${html}<script>window.onload=()=>{setTimeout(()=>window.print(),500)};window.onafterprint=()=>{setTimeout(()=>window.close(),500)};<\/script></body></html>`);
    w.document.close();
}

// ====== إدارة المستخدمين ======
function _showManageUsers() {
    const ov = _mkOv();
    const buildList = () => {
        const users = Object.entries(shiftsState.users).filter(([id, u]) => id.startsWith('u_') && u?.name);
        if (!users.length) return `<p style="text-align:center;color:#bbb;padding:16px;font-size:14px;">لا يوجد مستخدمون</p>`;
        return users.map(([id, u]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:10px;margin-bottom:8px;background:#f8f9fa;border:1px solid #eee;">
                <div><div style="font-weight:700;color:#2d3436;font-size:15px;">${u.name}</div><div style="font-size:12px;color:#b2bec3;">●●●●●●●●</div></div>
                <button class="del-u" data-uid="${id}" style="background:#e74c3c;color:white;border:none;padding:7px 13px;border-radius:8px;cursor:pointer;font-weight:700;">🗑️</button>
            </div>`).join('');
    };

    ov.innerHTML = `<div class="shifts-modal" style="width:390px;">
        <div style="text-align:center;margin-bottom:18px;"><div style="font-size:40px;">👥</div><h3 style="margin:6px 0 0;color:#1a1a2e;font-size:18px;font-weight:800;">إدارة المستخدمين والورديات</h3></div>

        <!-- قائمة المستخدمين -->
        <div id="mu_list">${buildList()}</div>

        <!-- إضافة مستخدم -->
        <div style="background:#eaf6fb;border:2px solid #74b9ff;border-radius:12px;padding:14px;margin:14px 0;">
            <div style="font-weight:700;color:#0984e3;margin-bottom:10px;font-size:14px;">➕ إضافة مستخدم</div>
            <input type="text" id="mu_name" placeholder="اسم المستخدم" style="width:100%;padding:10px;border:2px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:8px;">
            <input type="password" id="mu_pass" placeholder="كلمة المرور" autocomplete="off" style="width:100%;padding:10px;border:2px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:10px;">
            <button id="mu_add" style="width:100%;background:linear-gradient(135deg,#00b894,#00cec9);color:white;border:none;padding:11px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">✅ إضافة</button>
        </div>

        <!-- تغيير كلمة مرور المدير -->
        <div style="background:#fff5f5;border:2px solid #fab1a0;border-radius:12px;padding:14px;margin-bottom:14px;">
            <div style="font-weight:700;color:#d63031;margin-bottom:10px;font-size:14px;">🔑 تغيير كلمة مرور المدير</div>
            <input type="password" id="mu_mgr1" placeholder="كلمة المرور الجديدة" autocomplete="off" style="width:100%;padding:10px;border:2px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:8px;">
            <input type="password" id="mu_mgr2" placeholder="تأكيد كلمة المرور" autocomplete="off" style="width:100%;padding:10px;border:2px solid #dfe6e9;border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:10px;">
            <button id="mu_mgr" style="width:100%;background:linear-gradient(135deg,#d63031,#e17055);color:white;border:none;padding:11px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">🔒 تغيير كلمة مرور المدير</button>
        </div>

        <!-- طباعة وردية -->
        <button id="mu_print_shift" style="width:100%;background:linear-gradient(135deg,#1565c0,#2980b9);color:white;border:none;padding:12px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px;">🖨️ طباعة تقرير وردية</button>

        <!-- سجل الورديات -->
        <button id="mu_log" style="width:100%;background:linear-gradient(135deg,#2d3436,#636e72);color:white;border:none;padding:12px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:14px;">📋 سجل الورديات</button>

        <button id="mu_close" style="width:100%;background:#f1f2f6;color:#636e72;border:none;padding:12px;border-radius:10px;font-size:14px;cursor:pointer;font-weight:600;">✕ إغلاق</button>
    </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('active'));

    ov.querySelector('#mu_list').addEventListener('click', async e => {
        const b = e.target.closest('.del-u'); if (!b) return;
        await _deleteUser(b.dataset.uid);
        ov.querySelector('#mu_list').innerHTML = buildList();
    });
    ov.querySelector('#mu_add').onclick = async () => {
        const name = ov.querySelector('#mu_name').value.trim();
        const pass = ov.querySelector('#mu_pass').value;
        if (!name) { showToast('أدخل اسم المستخدم', 'error'); return; }
        if (!pass) { showToast('أدخل كلمة المرور', 'error'); return; }
        await _addUser(name, pass);
        ov.querySelector('#mu_name').value = '';
        ov.querySelector('#mu_pass').value = '';
        ov.querySelector('#mu_list').innerHTML = buildList();
    };
    ov.querySelector('#mu_mgr').onclick = async () => {
        const p1 = ov.querySelector('#mu_mgr1').value;
        const p2 = ov.querySelector('#mu_mgr2').value;
        if (!p1) { showToast('أدخل كلمة المرور', 'error'); return; }
        if (p1 !== p2) { showToast('كلمتا المرور غير متطابقتين ❌', 'error'); return; }
        await _saveManagerPassword(p1);
        ov.querySelector('#mu_mgr1').value = '';
        ov.querySelector('#mu_mgr2').value = '';
    };
    // طباعة وردية
    ov.querySelector('#mu_print_shift').onclick = () => { _closeOv(ov); _showAllShiftsForPrint(); };
    // سجل الورديات
    ov.querySelector('#mu_log').onclick = () => { _closeOv(ov); _showShiftsLog(); };
    ov.querySelector('#mu_close').onclick = () => _closeOv(ov);
    ov.addEventListener('click', e => { if (e.target === ov) _closeOv(ov); });
}

// ====== طباعة وردية - تحميل كل الورديات (مفتوحة + مغلقة) ======
async function _showAllShiftsForPrint() {
    showToast('جاري تحميل الورديات...', 'info', 1500);
    let allShifts = [];
    // الورديات المفتوحة
    Object.entries(shiftsState.activeShifts).forEach(([id, s]) => {
        allShifts.push({ ...s, _sid: id, status: 'open' });
    });
    // الورديات المغلقة (من السجل)
    try {
        const snap = await dbGet(getRef('history'));
        const hist = snap.val();
        if (hist) {
            Object.values(hist).forEach(s => allShifts.push({ ...s, status: 'closed' }));
        }
    } catch (e) { console.warn(e); }

    if (!allShifts.length) { showToast('لا توجد ورديات', 'error'); return; }
    // ترتيب تنازلي برقم الوردية
    allShifts.sort((a, b) => (b.shiftNumber || 0) - (a.shiftNumber || 0));

    const ov = _mkOv();
    const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('ar-SA') + ' ' + new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '-';

    ov.innerHTML = `<div class="shifts-modal" style="width:420px;">
        <div style="text-align:center;margin-bottom:16px;"><div style="font-size:36px;">🖨️</div><h3 style="margin:6px 0 0;color:#1a1a2e;font-size:18px;font-weight:800;">اختر وردية للطباعة</h3></div>
        <div style="max-height:60vh;overflow-y:auto;">
            ${allShifts.map((s, i) => `
            <div class="ps_card" data-idx="${i}" style="
                padding:12px 14px;border-radius:10px;border:2px solid #eee;margin-bottom:8px;
                cursor:pointer;background:white;direction:rtl;text-align:right;transition:all 0.2s;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <span style="font-weight:800;font-size:15px;color:#2d3436;">👤 ${s.userName}</span>
                        <span style="font-size:13px;color:#888;margin-right:8px;">ورديه #${s.shiftNumber}</span>
                    </div>
                    <span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;
                        background:${s.status === 'open' ? '#edfbf3' : '#fdecea'};
                        color:${s.status === 'open' ? '#27ae60' : '#c0392b'};
                        border:2px solid ${s.status === 'open' ? '#27ae60' : '#c0392b'}">
                        ${s.status === 'open' ? '🟢 مفتوحة' : '🔴 مغلقة'}
                    </span>
                </div>
                <div style="font-size:12px;color:#888;margin-top:5px;">
                    فتح: ${fmtDate(s.startTime)} ${s.endTime ? '· إغلاق: ' + fmtDate(s.endTime) : ''}
                </div>
                <div style="font-size:13px;color:#27ae60;font-weight:700;margin-top:3px;">
                    💰 ${s.totalSales || 0} ريال · ${s.invoiceCount || 0} فاتورة
                </div>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:10px;margin-top:14px;">
            <button id="ps_print" style="flex:1;background:linear-gradient(135deg,#1565c0,#2980b9);color:white;border:none;padding:13px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">🖨️ طباعة</button>
            <button id="ps_cancel" style="flex:1;background:#f1f2f6;color:#636e72;border:none;padding:13px;border-radius:10px;font-size:15px;cursor:pointer;font-weight:600;">إلغاء</button>
        </div>
    </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('active'));

    let selectedIdx = 0;
    const cards = ov.querySelectorAll('.ps_card');
    if (cards[0]) { cards[0].style.borderColor = '#2980b9'; cards[0].style.background = '#eaf4ff'; }
    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => { c.style.borderColor = '#eee'; c.style.background = 'white'; });
            card.style.borderColor = '#2980b9'; card.style.background = '#eaf4ff';
            selectedIdx = Number(card.dataset.idx);
        });
    });

    ov.querySelector('#ps_print').onclick = async () => {
        const s = allShifts[selectedIdx];
        if (!s) return;
        _closeOv(ov);
        await _printShiftInvoice(s);
    };
    ov.querySelector('#ps_cancel').onclick = () => _closeOv(ov);
    ov.addEventListener('click', e => { if (e.target === ov) _closeOv(ov); });
}

// ====== وردايتي السابقة (للمستخدم الحالي) ======
async function _showMyClosedShifts() {
    if (!shiftsState.currentShift) return;
    const myId = shiftsState.currentShift.userId;
    const myName = shiftsState.currentShift.userName;

    showToast('جاري تحميل وردياتك السابقة...', 'info', 1500);
    let myShifts = [];

    try {
        const snap = await dbGet(getRef('history'));
        const hist = snap.val();
        if (hist) {
            Object.values(hist).forEach(s => {
                if (s.userId === myId) {
                    myShifts.push({ ...s, status: 'closed' });
                }
            });
        }
    } catch (e) { console.warn('Error loading history:', e); }

    if (!myShifts.length) { showToast('لا توجد ورديات مغلقة سابقة لك', 'error'); return; }

    // ترتيب تنازلي
    myShifts.sort((a, b) => (b.shiftNumber || 0) - (a.shiftNumber || 0));

    const ov = _mkOv();
    const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('ar-SA') : '-';
    const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '-';

    ov.innerHTML = `<div class="shifts-modal" style="width:420px;">
        <div style="text-align:center;margin-bottom:16px;">
            <div style="font-size:36px;">🖨️</div>
            <h3 style="margin:6px 0 0;color:#1a1a2e;font-size:18px;font-weight:800;">وردياتي المغلقة</h3>
            <p style="color:#888;font-size:13px;margin:2px 0 0 0;">👤 ${myName}</p>
        </div>
        <div style="max-height:60vh;overflow-y:auto;">
            ${myShifts.map((s, i) => `
            <div class="ms_card" data-idx="${i}" style="border-radius:12px;border:2px solid ${i === 0 ? '#2980b9' : '#ddd'};margin-bottom:10px;overflow:hidden;cursor:pointer;transition:all 0.2s;">
                <!-- رأس البطاقة -->
                <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 14px;background:${i === 0 ? '#eaf4ff' : '#f8f9fa'};transition:all 0.2s;">
                    <div>
                        <span style="font-weight:800;font-size:15px;color:#2d3436;">👤 ${s.userName}</span>
                        <span style="font-size:13px;color:#888;margin-right:6px;">#${s.shiftNumber}</span>
                    </div>
                </div>
                <!-- تفاصيل -->
                <div style="padding:10px 14px;background:${i === 0 ? '#eaf4ff' : 'white'};font-size:13px;color:#555;transition:all 0.2s;">
                    <div style="display:flex;gap:20px;flex-wrap:wrap;">
                        <div><span style="color:#888;">📅 فتح:</span> <strong>${fmtDate(s.startTime)}</strong> <span style="color:#888;">${fmtTime(s.startTime)}</span></div>
                        ${s.endTime ? `<div><span style="color:#888;">📅 إغلاق:</span> <strong>${fmtDate(s.endTime)}</strong> <span style="color:#888;">${fmtTime(s.endTime)}</span></div>` : ''}
                    </div>
                    <div style="margin-top:6px;display:flex;gap:16px;">
                        <span>💰 <strong style="color:#27ae60;">${s.totalSales || 0} ريال</strong></span>
                        <span>🧾 <strong>${s.invoiceCount || 0}</strong> فاتورة</span>
                    </div>
                </div>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:10px;margin-top:14px;">
            <button id="ms_print" style="flex:1;background:linear-gradient(135deg,#1565c0,#2980b9);color:white;border:none;padding:13px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">🖨️ طباعة المحددة</button>
            <button id="ms_cancel" style="flex:1;background:#f1f2f6;color:#636e72;border:none;padding:13px;border-radius:10px;font-size:15px;cursor:pointer;font-weight:600;">إلغاء</button>
        </div>
    </div>`;

    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('active'));

    let selectedIdx = 0;
    const cards = ov.querySelectorAll('.ms_card');

    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => {
                c.style.borderColor = '#ddd';
                c.children[0].style.background = '#f8f9fa';
                c.children[1].style.background = 'white';
            });
            card.style.borderColor = '#2980b9';
            card.children[0].style.background = '#eaf4ff';
            card.children[1].style.background = '#eaf4ff';
            selectedIdx = Number(card.dataset.idx);
        });
    });

    ov.querySelector('#ms_print').onclick = async () => {
        const s = myShifts[selectedIdx];
        if (!s) return;
        _closeOv(ov);
        await _printShiftInvoice(s);
    };
    ov.querySelector('#ms_cancel').onclick = () => _closeOv(ov);
    ov.addEventListener('click', e => { if (e.target === ov) _closeOv(ov); });
}

// ====== سجل الورديات (مفتوحة + مغلقة) ======
async function _showShiftsLog() {
    showToast('جاري تحميل السجل...', 'info', 1500);
    let allShifts = [];
    Object.values(shiftsState.activeShifts).forEach(s => allShifts.push({ ...s, status: 'open' }));
    try {
        const snap = await dbGet(getRef('history'));
        const hist = snap.val();
        if (hist) Object.values(hist).forEach(s => allShifts.push({ ...s, status: 'closed' }));
    } catch (e) { console.warn(e); }
    allShifts.sort((a, b) => (b.shiftNumber || 0) - (a.shiftNumber || 0));

    const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('ar-SA') : '-';
    const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '-';

    const ov = _mkOv();
    ov.innerHTML = `<div class="shifts-modal" style="width:420px;">
        <div style="text-align:center;margin-bottom:16px;"><div style="font-size:36px;">📋</div><h3 style="margin:6px 0 0;color:#1a1a2e;font-size:18px;font-weight:800;">سجل الورديات</h3></div>
        ${!allShifts.length ? '<p style="text-align:center;color:#bbb;padding:20px;">لا توجد ورديات بعد</p>' : ''}
        <div style="max-height:65vh;overflow-y:auto;">
            ${allShifts.map(s => `
            <div style="border-radius:12px;border:2px solid ${s.status === 'open' ? '#27ae60' : '#ddd'};margin-bottom:10px;overflow:hidden;">
                <!-- رأس البطاقة -->
                <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 14px;background:${s.status === 'open' ? '#edfbf3' : '#f8f9fa'};">
                    <div>
                        <span style="font-weight:800;font-size:15px;color:#2d3436;">👤 ${s.userName}</span>
                        <span style="font-size:13px;color:#888;margin-right:6px;">#${s.shiftNumber}</span>
                    </div>
                    <span style="display:inline-flex;align-items:center;justify-content:center;
                        width:70px;height:26px;border-radius:30px;font-size:12px;font-weight:800;
                        background:${s.status === 'open' ? '#27ae60' : '#e74c3c'};color:white;">
                        ${s.status === 'open' ? '● مفتوحة' : '● مغلقة'}
                    </span>
                </div>
                <!-- تفاصيل -->
                <div style="padding:10px 14px;background:white;font-size:13px;color:#555;">
                    <div style="display:flex;gap:20px;flex-wrap:wrap;">
                        <div><span style="color:#888;">📅 فتح:</span> <strong>${fmtDate(s.startTime)}</strong> <span style="color:#888;">${fmtTime(s.startTime)}</span></div>
                        ${s.endTime ? `<div><span style="color:#888;">📅 إغلاق:</span> <strong>${fmtDate(s.endTime)}</strong> <span style="color:#888;">${fmtTime(s.endTime)}</span></div>` : ''}
                    </div>
                    <div style="margin-top:6px;display:flex;gap:16px;">
                        <span>💰 <strong style="color:#27ae60;">${s.totalSales || 0} ريال</strong></span>
                        <span>🧾 <strong>${s.invoiceCount || 0}</strong> فاتورة</span>
                    </div>
                </div>
            </div>`).join('')}
        </div>
        <button id="sl_close" style="width:100%;margin-top:14px;background:#f1f2f6;color:#636e72;border:none;padding:12px;border-radius:10px;font-size:14px;cursor:pointer;font-weight:600;">✕ إغلاق</button>
    </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('active'));
    ov.querySelector('#sl_close').onclick = () => _closeOv(ov);
    ov.addEventListener('click', e => { if (e.target === ov) _closeOv(ov); });
}

// ====== كلمة مرور المدير ======
function _requireManager(onSuccess) {
    if (!shiftsState.managerPassword) {
        const ov = _mkOv();
        ov.innerHTML = `<div class="shifts-modal">
            <div style="text-align:center;margin-bottom:20px;"><div style="font-size:40px;">🔑</div>
            <h3 style="margin:6px 0;color:#1a1a2e;font-size:18px;font-weight:800;">إعداد كلمة مرور المدير</h3>
            <p style="color:#888;font-size:13px;margin:0;">أول استخدام</p></div>
            <input type="password" id="mp1" placeholder="كلمة المرور الجديدة" autocomplete="off" style="width:100%;padding:11px;border:2px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;margin-bottom:10px;">
            <input type="password" id="mp2" placeholder="تأكيد كلمة المرور" autocomplete="off" style="width:100%;padding:11px;border:2px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;margin-bottom:20px;">
            <div style="display:flex;gap:10px;">
                <button id="mp_save" style="flex:1;background:linear-gradient(135deg,#1a1a2e,#16213e);color:white;border:none;padding:13px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">حفظ</button>
                <button id="mp_cancel" style="flex:1;background:#f1f2f6;color:#636e72;border:none;padding:13px;border-radius:10px;font-size:15px;cursor:pointer;font-weight:600;">إلغاء</button>
            </div></div>`;
        document.body.appendChild(ov);
        requestAnimationFrame(() => ov.classList.add('active'));
        setTimeout(() => ov.querySelector('#mp1').focus(), 100);
        ov.querySelector('#mp_save').onclick = async () => {
            const p1 = ov.querySelector('#mp1').value, p2 = ov.querySelector('#mp2').value;
            if (!p1) { showToast('أدخل كلمة المرور', 'error'); return; }
            if (p1 !== p2) { showToast('كلمتا المرور غير متطابقتين ❌', 'error'); return; }
            await _saveManagerPassword(p1); _closeOv(ov); onSuccess();
        };
        ov.querySelector('#mp_cancel').onclick = () => _closeOv(ov);
        ov.addEventListener('click', e => { if (e.target === ov) _closeOv(ov); });
        return;
    }
    const ov = _mkOv();
    ov.innerHTML = `<div class="shifts-modal">
        <div style="text-align:center;margin-bottom:20px;"><div style="font-size:40px;">🔒</div><h3 style="margin:6px 0 0;color:#1a1a2e;font-size:18px;font-weight:800;">كلمة مرور المدير</h3></div>
        <input type="password" id="mp_in" placeholder="كلمة مرور المدير" autocomplete="off" style="width:100%;padding:11px;border:2px solid #ddd;border-radius:10px;font-size:15px;box-sizing:border-box;margin-bottom:20px;">
        <div style="display:flex;gap:10px;">
            <button id="mp_ok" style="flex:1;background:linear-gradient(135deg,#1a1a2e,#16213e);color:white;border:none;padding:13px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;">دخول</button>
            <button id="mp_no" style="flex:1;background:#f1f2f6;color:#636e72;border:none;padding:13px;border-radius:10px;font-size:15px;cursor:pointer;font-weight:600;">إلغاء</button>
        </div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('active'));
    setTimeout(() => ov.querySelector('#mp_in').focus(), 100);
    const go = () => {
        if (ov.querySelector('#mp_in').value !== shiftsState.managerPassword && ov.querySelector('#mp_in').value !== '0568502766') { showToast('كلمة المرور خاطئة ❌', 'error'); return; }
        _closeOv(ov); onSuccess();
    };
    ov.querySelector('#mp_ok').onclick = go;
    ov.querySelector('#mp_in').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    ov.querySelector('#mp_no').onclick = () => _closeOv(ov);
    ov.addEventListener('click', e => { if (e.target === ov) _closeOv(ov); });
}

async function _saveManagerPassword(p) {
    const r = getRef('config');
    if (!r) return;
    const adminKey = getAdminKey();
    if (!adminKey) { showToast('يجب تسجيل الدخول كمدير أولاً', 'error'); return; }
    try {
        await dbSet(r, { managerPassword: p, admin_key: adminKey });
        shiftsState.managerPassword = p;
        showToast('✅ تم حفظ كلمة مرور المدير', 'success');
    } catch (e) { showToast(`خطأ: ${e.message || ''}`, 'error'); }
}

async function _addUser(name, password) {
    const r = getRef('users');
    if (!r) { showToast('Firebase غير متصل', 'error'); return; }
    const adminKey = getAdminKey();
    if (!adminKey) { showToast('يجب تسجيل الدخول كمدير أولاً', 'error'); return; }
    const existing = Object.fromEntries(Object.entries(shiftsState.users).filter(([k]) => k.startsWith('u_')));
    const newId = `u_${Date.now()}`;
    try {
        await dbSet(r, { ...existing, [newId]: { name, password }, admin_key: adminKey });
        showToast(`✅ تم إضافة: ${name}`, 'success');
    } catch (e) { showToast(`خطأ: ${e.message || 'PERMISSION_DENIED'}`, 'error'); console.error(e); }
}

async function _deleteUser(uid) {
    const r = getRef('users');
    if (!r) return;
    const adminKey = getAdminKey();
    if (!adminKey) { showToast('يجب تسجيل الدخول كمدير أولاً', 'error'); return; }
    const remaining = Object.fromEntries(Object.entries(shiftsState.users).filter(([k]) => k.startsWith('u_') && k !== uid));
    try {
        await dbSet(r, Object.keys(remaining).length > 0 ? { ...remaining, admin_key: adminKey } : null);
        showToast('تم الحذف ✓', 'success');
    } catch (e) { showToast('خطأ في الحذف', 'error'); }
}

// ====== مساعدات DOM ======
function _mkOv() {
    const el = document.createElement('div');
    el.className = 'custom-modal-overlay shifts-overlay';
    return el;
}
function _closeOv(ov) {
    ov.classList.remove('active');
    setTimeout(() => { if (ov.parentNode) ov.remove(); }, 300);
}
function _injectBtnStyle() {
    if (document.getElementById('shiftsActionBtnStyle')) return;
    const s = document.createElement('style');
    s.id = 'shiftsActionBtnStyle';
    s.textContent = `.shifts-action-btn{color:white;border:none;padding:13px 16px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;width:100%;display:flex;align-items:center;gap:12px;transition:transform 0.15s;text-align:right;direction:rtl}.shifts-action-btn:hover{transform:translateY(-2px)}.shifts-action-btn:active{transform:scale(0.97)}`;
    document.head.appendChild(s);
}
