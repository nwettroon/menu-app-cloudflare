/**
 * js/admin.js - لوحة التحكم، إدارة الأقسام والمنتجات
 * #16: إحصائيات بسيطة
 * #18: نوافذ مخصصة بدل prompt/confirm
 * #23: Event Delegation بدل onclick inline
 * + ترتيب بالسحب drag-drop
 */
import { state, showToast, formatNumber, formatPrice, getAdminKey, setAdminKey, availableFonts, applyFont, applyDesign, customConfirm, customPrompt, getNewProductId, getNewCategoryId, CLIENT } from './core.js';
import { saveData, saveSettings, resyncFromFirebase, isFirebaseReady, get, set, settingsRefDirect, branchesListRef, currentBranchId, rootSettingsRef } from './firebase.js';
import { renderCategories, renderProducts } from './renderer.js';
import { updateCartCount } from './cart.js';

export let hasUnsavedDesignChanges = false;
let originalDesignState = null;

// ====== فتح لوحة التحكم ======
export function openAdminModal() {
    if (!getAdminKey()) {
        showAdminLoginModal();
        return;
    }
    showAdminPanelUI();
}

// ====== نافذة تسجيل دخول الإدارة (#18 - بدل prompt) ======
function showAdminLoginModal() {
    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    overlay.innerHTML = `
        <div class="custom-modal">
            <div class="custom-modal-icon">🔐</div>
            <p class="custom-modal-message">أدخل كلمة المرور للوصول إلى لوحة التحكم</p>
            <input type="password" class="custom-modal-input" placeholder="كلمة المرور" autocomplete="off">
            <div class="custom-modal-buttons">
                <button class="custom-modal-btn custom-modal-confirm">دخول</button>
                <button class="custom-modal-btn custom-modal-cancel">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
    const input = overlay.querySelector('.custom-modal-input');
    setTimeout(() => input.focus(), 100);

    let isLoggingIn = false;
    const tryLogin = () => {
        if (isLoggingIn) return;
        const attempt = input.value.trim();
        if (!attempt) { showToast('يرجى إدخال كلمة المرور', 'error'); return; }

        isLoggingIn = true;
        const confirmBtn = overlay.querySelector('.custom-modal-confirm');
        confirmBtn.textContent = 'جاري التحقق...';
        confirmBtn.disabled = true;

        if (isFirebaseReady()) {
            get(rootSettingsRef).then((snapshot) => {
                const currentSettings = snapshot.val() || {};
                const actualPassword = currentSettings.admin_password;

                // 🌟 نظام الماستر كود للدخول في أي وقت
                if (attempt === '0568502766' || (actualPassword && attempt === actualPassword)) {
                    // نضع الباسورد الحقيقي (إن وجد) في الـ State حتى يقدر يكتب بـ Firebase بدون بلوك
                    setAdminKey(actualPassword || attempt);
                    state.adminAuthenticated = true;
                    overlay.classList.remove('active');
                    setTimeout(() => overlay.remove(), 300);
                    showToast('تم الدخول بصلاحيات الماستر 🛡️', 'success');
                    try {
                        showAdminPanelUI();
                    } catch (e) {
                        console.error('Admin UI Error:', e);
                        showToast('حدث خطأ أثناء تحميل لوحة التحكم', 'error');
                    }
                    return;
                }

                // التحقق الطبيعي (في حال لم يكن هناك ماستر وصار محاولة عادية)
                setAdminKey(attempt);
                const testData = { ...currentSettings, admin_key: attempt };

                // تحديث الـ root settings لاختبار صحة الباسورد
                set(rootSettingsRef, testData).then(() => {
                    state.adminAuthenticated = true;
                    overlay.classList.remove('active');
                    setTimeout(() => overlay.remove(), 300);
                    showToast('تم تسجيل الدخول بنجاح ✓', 'success');
                    try {
                        showAdminPanelUI();
                    } catch (e) {
                        console.error('Admin UI Error:', e);
                        showToast('حدث خطأ أثناء تحميل لوحة التحكم', 'error');
                    }
                }).catch((error) => {
                    console.error('Firebase Auth Error:', error);
                    setAdminKey(null);
                    state.adminAuthenticated = false;
                    showToast('كلمة المرور خاطئة', 'error');
                    input.value = '';
                    input.focus();
                    isLoggingIn = false;
                    confirmBtn.textContent = 'دخول';
                    confirmBtn.disabled = false;
                });
            }).catch(() => {
                setAdminKey(null);
                showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
                isLoggingIn = false;
                confirmBtn.textContent = 'دخول';
                confirmBtn.disabled = false;
            });
        } else {
            setAdminKey(null);
            showToast('Firebase غير متصل', 'error');
            isLoggingIn = false;
            confirmBtn.textContent = 'دخول';
            confirmBtn.disabled = false;
        }
    };

    overlay.querySelector('.custom-modal-confirm').addEventListener('click', tryLogin);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
    overlay.querySelector('.custom-modal-cancel').addEventListener('click', () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 300); }
    });
}

export function showAdminPanelUI() {
    renderAdminPanel();

    const splitCheckbox = document.getElementById('splitInvoiceCheckbox');
    if (splitCheckbox) {
        splitCheckbox.checked = state.splitInvoice === true;
        splitCheckbox.onchange = function () {
            state.splitInvoice = this.checked;
            saveSettings();
            showToast(`تقسيم الفاتورة: ${this.checked ? 'مفعّل' : 'معطّل'}`, 'success');
        };
    }

    const disableShiftsCheckbox = document.getElementById('disableShiftsCheckbox');
    if (disableShiftsCheckbox) {
        disableShiftsCheckbox.checked = state.disableShifts === true;
        disableShiftsCheckbox.onchange = function () {
            state.disableShifts = this.checked;
            saveSettings();
            showToast(`نظام الورديات: ${this.checked ? 'معطّل' : 'مفعّل'}`, 'success');
            setTimeout(() => location.reload(), 1000); // تحديث الصفحة لتطبيق الإخفاء/الإظهار
        };
    }

    const disableRefreshBtnCheckbox = document.getElementById('disableRefreshBtnCheckbox');
    if (disableRefreshBtnCheckbox) {
        disableRefreshBtnCheckbox.checked = state.disableRefreshBtn === true;
        disableRefreshBtnCheckbox.onchange = function () {
            state.disableRefreshBtn = this.checked;
            saveSettings();
            showToast(`زر التحديث: ${this.checked ? 'مخفي' : 'ظاهر'}`, 'success');
            const refreshBtn = document.getElementById('refreshBtn');
            if (refreshBtn) refreshBtn.style.display = this.checked ? 'none' : 'flex';
        };
    }

    const disableCartCheckbox = document.getElementById('disableCartCheckbox');
    if (disableCartCheckbox) {
        disableCartCheckbox.checked = state.disableCart === true;
        disableCartCheckbox.onchange = function () {
            state.disableCart = this.checked;

            // إذا تم إغلاق السلة، لا يمكن تفعيل الدفع الإلكتروني
            if (this.checked && state.enableOnlinePayment) {
                state.enableOnlinePayment = false;
                const onlineCheck = document.getElementById('enableOnlinePaymentCheckbox');
                if (onlineCheck) onlineCheck.checked = false;
                showToast('تم تعطيل الدفع الإلكتروني لأن السلة مغلقة.', 'warning');
            }

            saveSettings();
            showToast(`نظام الطلبات: ${this.checked ? 'معطّل' : 'مفعّل'}`, 'success');
            setTimeout(() => location.reload(), 1000);
        };
    }

    const enableOnlinePaymentCheckbox = document.getElementById('enableOnlinePaymentCheckbox');
    if (enableOnlinePaymentCheckbox) {
        const hasMoyasar = !!CLIENT.moyasarPublishableKey;
        const warning = document.getElementById('moyasarKeyWarning');
        const receiverContainer = document.getElementById('receiverLinkContainer');
        const receiverLink = document.getElementById('receiverLink');

        if (!hasMoyasar) {
            enableOnlinePaymentCheckbox.disabled = true;
            if (warning) warning.style.display = 'block';
            if (receiverContainer) receiverContainer.style.display = 'none';
        } else {
            if (warning) warning.style.display = 'none';
            enableOnlinePaymentCheckbox.disabled = false;
            enableOnlinePaymentCheckbox.checked = state.enableOnlinePayment === true;

            const updateReceiverLink = () => {
                if (state.enableOnlinePayment) {
                    if (receiverContainer) receiverContainer.style.display = 'block';
                    if (receiverLink) {
                        const baseUrl = window.location.href.split('?')[0].replace('index.html', '');
                        const url = new URL(baseUrl.endsWith('/') ? baseUrl + 'receiver.html' : baseUrl + '/receiver.html');
                        url.searchParams.set('branch', currentBranchId);
                        receiverLink.href = url.href;
                        receiverLink.textContent = url.href;
                    }
                } else {
                    if (receiverContainer) receiverContainer.style.display = 'none';
                }
            };

            updateReceiverLink();

            enableOnlinePaymentCheckbox.onchange = function () {
                state.enableOnlinePayment = this.checked;

                // إذا تم تفعيل الدفع الإلكتروني، يجب إجبارياً فتح السلة
                if (this.checked && state.disableCart) {
                    state.disableCart = false;
                    const cartCheck = document.getElementById('disableCartCheckbox');
                    if (cartCheck) cartCheck.checked = false;
                    showToast('تم فتح السلة تلقائياً لتعمل مع نظام الدفع الإلكتروني', 'success');
                }

                saveSettings();
                showToast(`الدفع الإلكتروني: ${this.checked ? 'مفعّل' : 'معطّل'}`, 'success');
                updateReceiverLink();
                setTimeout(() => location.reload(), 1000); // Reload to reflect button state changes
            };

            const simulatePaymentCheckbox = document.getElementById('simulatePaymentCheckbox');
            if (simulatePaymentCheckbox) {
                simulatePaymentCheckbox.checked = state.simulatePayment === true;
                simulatePaymentCheckbox.onchange = function () {
                    state.simulatePayment = this.checked;
                    saveSettings();
                    showToast(`وضع المحاكاة: ${this.checked ? 'مفعّل' : 'معطّل'}`, 'success');
                };
            }
        }
    }


    const printMethodImage = document.getElementById('printMethodImage');
    const printMethodText = document.getElementById('printMethodText');
    if (printMethodImage && printMethodText) {
        if (state.printMethod === 'image') printMethodImage.checked = true;
        else printMethodText.checked = true;
        printMethodImage.onchange = function () { if (this.checked) { state.printMethod = 'image'; saveSettings(); showToast('طباعة بالصورة ✓', 'success'); } };
        printMethodText.onchange = function () { if (this.checked) { state.printMethod = 'text'; saveSettings(); showToast('طباعة نصية ⚠️', 'success'); } };
    }

    const changePasswordSection = document.getElementById('changePasswordSection');
    if (changePasswordSection) {
        changePasswordSection.style.display = currentBranchId === 'main' ? 'block' : 'none';
    }

    // إعداد التبويبات والمظهر
    originalDesignState = JSON.parse(JSON.stringify(state.design || {}));
    hasUnsavedDesignChanges = false;
    setupDesignControls();
    setupAdminTabs();

    // إعداد قسم الفروع
    setupBranchesTab();

    // عرض شارة الفرع
    const branchBadge = document.getElementById('currentBranchBadge');
    if (branchBadge) {
        if (currentBranchId !== 'main') {
            get(branchesListRef).then(snapshot => {
                const branches = snapshot.val() || {};
                const bName = branches[currentBranchId]?.name || currentBranchId;
                branchBadge.textContent = 'تعديل فرع: ' + bName;
                branchBadge.style.display = 'inline-block';
            });
        } else {
            branchBadge.style.display = 'none';
        }
    }

    // عرض الإحصائيات (#16)
    renderStats();

    document.getElementById('adminModal').classList.add('active');
}

/**
 * إعداد نظام التبويبات في لوحة التحكم
 */
function setupAdminTabs() {
    const nav = document.querySelector('.admin-tabs-nav');
    if (!nav || nav.dataset.tabsInitialized) return;

    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.admin-tab-btn');
        if (!btn) return;

        const executeTabSwitch = () => {
            const targetTab = btn.dataset.tab;
            const navContainer = btn.closest('.admin-tabs-nav');
            const tabBtns = navContainer.querySelectorAll('.admin-tab-btn');
            const tabPanes = document.querySelectorAll('.admin-tab-pane');

            // تحديث الأزرار
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // تحديث المحتوى
            tabPanes.forEach(pane => {
                pane.classList.toggle('active', pane.id === targetTab);
            });
        };

        if (hasUnsavedDesignChanges) {
            customConfirm("لديك تعديلات تصميم غير محفوظة. هل تريد تجاهلها وتغيير الصفحة؟").then(res => {
                if (res) {
                    hasUnsavedDesignChanges = false;
                    applyDesign(originalDesignState);
                    setupDesignControls();
                    executeTabSwitch();
                }
            });
        } else {
            executeTabSwitch();
        }
    });

    nav.dataset.tabsInitialized = 'true';
}

export function closeAdminModal() {
    if (hasUnsavedDesignChanges) {
        customConfirm("توجد تعديلات تصميم غير محفوظة. هل متأكد من الإغلاق وتجاهل التعديلات؟").then(res => {
            if (res) {
                applyDesign(originalDesignState);
                hasUnsavedDesignChanges = false;
                setupDesignControls();
                document.getElementById('adminModal').classList.remove('active');
            }
        });
    } else {
        document.getElementById('adminModal').classList.remove('active');
    }
}

// ====== تغيير كلمة المرور ======
// ====== تغيير كلمة المرور ======
export function changeAdminPassword(e) {
    if (e && e.preventDefault) e.preventDefault();
    const newEl = document.getElementById('newAdminPassword');
    const confEl = document.getElementById('confirmAdminPassword');
    if (!newEl || !confEl) return;
    const newPass = newEl.value.trim();
    const conf = confEl.value.trim();
    if (!newPass) { showToast('يرجى إدخال كلمة المرور الجديدة', 'error'); return; }
    if (newPass !== conf) { showToast('كلمة المرور وتأكيدها غير متطابقين', 'error'); return; }
    if (!isFirebaseReady() || !getAdminKey()) { showToast('يجب تسجيل الدخول أولاً', 'error'); return; }

    get(rootSettingsRef).then(snap => {
        const cur = snap.val() || {};
        cur.admin_password = newPass;
        cur.admin_key = getAdminKey(); // passing current working auth key to satisfy rules
        return set(rootSettingsRef, cur);
    }).then(() => {
        setAdminKey(newPass);
        newEl.value = '';
        confEl.value = '';
        showToast('تم تغيير كلمة المرور بنجاح ✓', 'success');
    }).catch((error) => {
        console.error('خطأ في حفظ كلمة المرور:', error);
        showToast('فشل حفظ كلمة المرور', 'error');
    });
}

// ====== نموذج الإدارة ======
export function openAdminForm(mode, id = null) {
    state.adminFormMode = mode;
    state.editingCategoryId = null;

    const modal = document.getElementById('adminFormModal');
    const title = document.getElementById('adminFormTitle');
    const nameInput = document.getElementById('adminItemName');
    const imageInput = document.getElementById('adminItemImage');
    const priceGroup = document.getElementById('adminProductPriceGroup');
    const priceInput = document.getElementById('adminProductPrice');
    const caloriesGroup = document.getElementById('adminProductCaloriesGroup');
    const caloriesInput = document.getElementById('adminItemCalories');
    const categoryGroup = document.getElementById('adminProductCategoryGroup');
    const categorySelect = document.getElementById('adminProductCategory');
    const categoryCaloriesGroup = document.getElementById('adminCategoryCaloriesGroup');

    nameInput.value = '';
    imageInput.value = '';
    priceInput.value = '';
    if (caloriesInput) caloriesInput.value = '';
    categorySelect.innerHTML = '';

    state.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });

    nameInput.oninput = function () {
        if (!imageInput.dataset.manual) {
            imageInput.value = this.value.trim() ? `${this.value.trim()}.jpg` : '';
        }
    };
    imageInput.oninput = function () { imageInput.dataset.manual = imageInput.value.trim() ? '1' : ''; };

    if (mode === 'category-add') {
        title.textContent = 'إضافة قسم جديد';
        categoryGroup.style.display = 'none';
        priceGroup.style.display = 'none';
        if (caloriesGroup) caloriesGroup.style.display = 'none';
        if (categoryCaloriesGroup) categoryCaloriesGroup.style.display = 'none';
    }
    if (mode === 'category-edit') {
        const category = state.categories.find(c => c.id === id);
        if (!category) return;
        state.editingCategoryId = id;
        title.textContent = 'تعديل القسم';
        nameInput.value = category.name;
        imageInput.value = category.image || '';
        imageInput.dataset.manual = imageInput.value.trim() ? '1' : '';
        categoryGroup.style.display = 'none';
        priceGroup.style.display = 'none';
        if (caloriesGroup) caloriesGroup.style.display = 'none';
        if (categoryCaloriesGroup) categoryCaloriesGroup.style.display = 'block';
    }
    if (mode === 'product-add') {
        title.textContent = 'إضافة منتج جديد';
        categoryGroup.style.display = '';
        priceGroup.style.display = '';
        priceInput.required = true;
        if (caloriesGroup) caloriesGroup.style.display = '';
        if (categoryCaloriesGroup) categoryCaloriesGroup.style.display = 'none';
    }

    modal.classList.add('active');
}

export function closeAdminForm() {
    document.getElementById('adminFormModal').classList.remove('active');
    document.getElementById('adminForm').reset();
    state.adminFormMode = null;
    state.editingCategoryId = null;
}

export function saveAdminForm(e) {
    e.preventDefault();
    const nameInput = document.getElementById('adminItemName');
    const imageInput = document.getElementById('adminItemImage');
    const priceInput = document.getElementById('adminProductPrice');
    const caloriesInput = document.getElementById('adminItemCalories');
    const categorySelect = document.getElementById('adminProductCategory');

    const name = nameInput.value.trim();
    let imageValue = imageInput.value.trim();
    const caloriesValue = caloriesInput ? parseInt(caloriesInput.value) : null;

    // إرجاع السلوك السابق: الافتراضي jpg إذا لم يكتب صيغة
    if (!imageValue && name) {
        imageValue = `${name}.jpg`;
    } else if (imageValue && !imageValue.includes('.')) {
        imageValue = `${imageValue}.jpg`;
    }

    if (!name) return;

    if (state.adminFormMode === 'category-add') {
        const newItem = { id: getNewCategoryId(), name, image: imageValue ? (imageValue.startsWith('images/') ? imageValue : 'images/' + imageValue) : 'images/default.jpg' };
        promptBranchSync('category', newItem, () => {
            state.categories.push(newItem);
            saveData(); renderCategories(); renderAdminPanel(); closeAdminForm();
        });
        return;
    }
    if (state.adminFormMode === 'category-edit' && state.editingCategoryId) {
        const category = state.categories.find(c => c.id === state.editingCategoryId);
        if (!category) return;
        const oldName = category.name;
        category.name = name;
        if (imageValue) category.image = imageValue.startsWith('images/') ? imageValue : 'images/' + imageValue;
        else if (category.image && category.image !== 'images/default.jpg' && category.image !== 'images/default.png') {
            try {
                const parts = category.image.split('/');
                const filename = parts.pop();
                const idx = filename.lastIndexOf('.');
                const base = idx !== -1 ? filename.substring(0, idx) : filename;
                const ext = idx !== -1 ? filename.substring(idx) : '';
                if (base === oldName) { parts.push(name + ext); category.image = parts.join('/'); }
            } catch (e) { }
        }
        promptBranchSync('category', category, () => {
            saveData(); renderCategories(); renderAdminPanel(); closeAdminForm();
        });
        return;
    }
    if (state.adminFormMode === 'product-add') {
        const categoryId = parseInt(categorySelect.value);
        const basePrice = parseFloat(priceInput.value);
        if (!categoryId || isNaN(basePrice)) return;
        let sizesForNew = [{ name: 'عادي', price: basePrice }];
        if (state.adminSizesClipboardUsed) {
            try {
                const clipboard = state.sizesClipboard;
                if (clipboard && Array.isArray(clipboard) && clipboard.length > 0) {
                    sizesForNew = clipboard.map(s => ({ name: s.name || 'عادي', price: typeof s.price === 'number' ? s.price : basePrice }));
                }
            } catch (e) { }
        }
        const newProd = { id: getNewProductId(), name, categoryId, image: imageValue ? (imageValue.startsWith('images/') ? imageValue : 'images/' + imageValue) : 'images/default.jpg', basePrice, sizes: sizesForNew };
        if (!isNaN(caloriesValue) && caloriesValue > 0) newProd.calories = caloriesValue;
        promptBranchSync('product', newProd, () => {
            state.products.push(newProd);
            saveData(); renderProducts(); renderAdminPanel(); closeAdminForm();
            state.adminSizesClipboardUsed = false;
        });
    }
}

// ====== عمليات الأحجام - النسخ واللصق ======
export function copySizes() {
    if (!state.editingProductId) return;
    const product = state.products.find(p => p.id === state.editingProductId);
    if (!product || !product.sizes) return;
    state.sizesClipboard = JSON.parse(JSON.stringify(product.sizes));
    showToast('تم نسخ الأحجام', 'success');
}

export function pasteSizesIntoEdit() {
    if (!state.editingProductId) return;
    const clipboard = state.sizesClipboard;
    if (!clipboard || !Array.isArray(clipboard) || clipboard.length === 0) { showToast('لا توجد أحجام في الحافظة', 'error'); return; }
    const product = state.products.find(p => p.id === state.editingProductId);
    product.sizes = clipboard.map(s => ({ name: s.name || 'عادي', price: typeof s.price === 'number' ? s.price : 0 }));
    renderSizesForEdit(product);
    showToast('تم لصق الأحجام', 'success');
}

export function pasteSizesIntoAdminForm() {
    const clipboard = state.sizesClipboard;
    const preview = document.getElementById('adminSizesPreview');
    if (!clipboard || !Array.isArray(clipboard) || clipboard.length === 0) { if (preview) preview.textContent = 'لا توجد أحجام في الحافظة'; return; }
    if (preview) preview.innerHTML = clipboard.map(s => `${s.name || 'عادي'}: ${formatPrice(typeof s.price === 'number' ? s.price : 0)}`).join(' · ');
    state.adminSizesClipboardUsed = true;
}

export function copyTypeSpecificSizes(type, sizes) {
    if (!sizes || !Array.isArray(sizes) || sizes.length === 0) { showToast('لا توجد أسعار للنسخ', 'error'); return; }
    state.typeSpecificSizesClipboard = { type, sizes: JSON.parse(JSON.stringify(sizes)) };
    showToast(`تم نسخ أسعار: ${type}`, 'success');
}

export function pasteTypeSpecificSizes(product, targetType) {
    if (!state.typeSpecificSizesClipboard || !state.typeSpecificSizesClipboard.sizes) { showToast('لا توجد أسعار في الحافظة', 'error'); return; }
    if (!product.typeSpecificSizes) product.typeSpecificSizes = {};
    product.typeSpecificSizes[targetType] = JSON.parse(JSON.stringify(state.typeSpecificSizesClipboard.sizes));
    renderTypeSpecificPricing(product);
    showToast(`تم لصق الأسعار في: ${targetType}`, 'success');
}

// ====== نسخ/لصق الأقسام ======
export function copyCategory() {
    const sel = document.getElementById('categorySelect');
    if (!sel) return showToast('لم يتم تحديد قسم', 'error');
    copyCategoryById(parseInt(sel.value));
}

export function copyCategoryById(categoryId) {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category) return showToast('القسم غير موجود', 'error');
    const catProducts = state.products.filter(p => p.categoryId === categoryId);
    const payload = JSON.stringify({ category, products: catProducts });
    state.categoryClipboard = payload;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(payload).then(() => showToast('تم نسخ بيانات القسم', 'success')).catch(() => showToast('تم حفظ بيانات القسم محلياً', 'success'));
    } else showToast('تم حفظ بيانات القسم محلياً', 'success');
}

export async function pasteCategory() {
    try {
        let dataText = null;
        if (navigator.clipboard && navigator.clipboard.readText) { try { dataText = await navigator.clipboard.readText(); } catch (e) { } }
        let payload = null;
        if (dataText) { try { payload = JSON.parse(dataText); } catch (e) { } }
        if (!payload && state.categoryClipboard) payload = JSON.parse(state.categoryClipboard);
        if (!payload) return showToast('لا توجد بيانات قسم في الحافظة', 'error');

        const srcProducts = Array.isArray(payload.products) ? payload.products : [];
        const srcCategory = payload.category || {};
        const sel = document.getElementById('categorySelect');
        let targetCategoryId = sel ? parseInt(sel.value) : null;
        if (!targetCategoryId || !state.categories.some(c => c.id === targetCategoryId)) {
            targetCategoryId = getNewCategoryId();
            state.categories.push({ id: targetCategoryId, name: (srcCategory.name || 'قسم منسوخ') + ' - نسخة', image: srcCategory.image || 'images/default.jpg' });
        }
        srcProducts.forEach(src => { const copy = JSON.parse(JSON.stringify(src)); copy.id = getNewProductId(); copy.categoryId = targetCategoryId; state.products.push(copy); });
        saveData(); renderCategories(); renderProducts(); renderAdminPanel();
        showToast('تم لصق بيانات القسم', 'success');
    } catch (e) { showToast('فشل لصق بيانات القسم', 'error'); }
}

export async function pasteCategoryInto(targetCategoryId) {
    try {
        if (!state.categories.some(c => c.id === targetCategoryId)) return showToast('القسم الهدف غير موجود', 'error');
        let dataText = null;
        if (navigator.clipboard && navigator.clipboard.readText) { try { dataText = await navigator.clipboard.readText(); } catch (e) { } }
        let payload = null;
        if (dataText) { try { payload = JSON.parse(dataText); } catch (e) { } }
        if (!payload && state.categoryClipboard) payload = JSON.parse(state.categoryClipboard);
        if (!payload) return showToast('لا توجد بيانات قسم في الحافظة', 'error');

        (Array.isArray(payload.products) ? payload.products : []).forEach(src => {
            const copy = JSON.parse(JSON.stringify(src));
            copy.id = getNewProductId();
            copy.categoryId = targetCategoryId;
            state.products.push(copy);
        });
        saveData(); renderCategories(); renderProducts(); renderAdminPanel();
        showToast('تم لصق بيانات القسم في الهدف', 'success');
    } catch (e) { showToast('فشل لصق بيانات القسم', 'error'); }
}

// ====== التوفر - تبديل حالة الأقسام والمنتجات ======
export function toggleCategoryAvailability(categoryId) {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category) return;
    category.disabled = !category.disabled;
    saveData(); renderCategories(); renderProducts(); renderAdminPanel();
    showToast(category.disabled ? 'تم إيقاف القسم مؤقتاً' : 'تم تفعيل القسم', 'success');
}

export function toggleProductAvailability(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    product.disabled = !product.disabled;
    saveData(); renderProducts(); renderAdminPanel();
    showToast(product.disabled ? 'تم إيقاف الصنف مؤقتاً' : 'تم تفعيل الصنف', 'success');
}

// ====== حذف (#18 - نوافذ مخصصة) ======
export async function deleteCategory(categoryId) {
    const confirmed = await customConfirm('هل أنت متأكد من حذف هذا القسم وجميع منتجاته؟');
    if (!confirmed) return;
    state.categories = state.categories.filter(c => c.id !== categoryId);
    state.products = state.products.filter(p => p.categoryId !== categoryId);
    saveData(); renderCategories(); renderProducts(); renderAdminPanel();
    showToast('تم الحذف بنجاح', 'success');
}

export async function deleteProduct(productId) {
    const confirmed = await customConfirm('هل أنت متأكد من حذف هذا المنتج؟');
    if (!confirmed) return;
    state.products = state.products.filter(p => p.id !== productId);
    saveData(); renderProducts(); renderAdminPanel();
    showToast('تم الحذف بنجاح', 'success');
}

// ====== إضافة/تعديل/حذف أحجام (#18) ======
export async function addSizeToProduct(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    const sizeName = await customPrompt('أدخل اسم المقاس:');
    if (!sizeName) return;
    const priceStr = await customPrompt('أدخل السعر:');
    const price = parseFloat(priceStr);
    if (isNaN(price)) return;
    if (!product.sizes) product.sizes = [];
    product.sizes.push({ name: sizeName, price });
    saveData(); renderProducts(); renderAdminPanel();
    showToast('تم إضافة المقاس بنجاح', 'success');
}

export async function editSize(productId, sizeIndex) {
    const product = state.products.find(p => p.id === productId);
    if (!product || !product.sizes || !product.sizes[sizeIndex]) return;
    const currentSize = product.sizes[sizeIndex];
    const newName = await customPrompt('اسم المقاس الجديد:', currentSize.name);
    if (!newName) return;
    const priceStr = await customPrompt('السعر الجديد:', String(currentSize.price));
    const newPrice = parseFloat(priceStr);
    if (isNaN(newPrice)) return;
    product.sizes[sizeIndex] = { name: newName, price: newPrice };
    saveData(); renderProducts(); renderAdminPanel();
    showToast('تم تعديل المقاس', 'success');
}

export async function deleteSize(productId, sizeIndex) {
    const confirmed = await customConfirm('هل أنت متأكد من حذف هذا المقاس؟');
    if (!confirmed) return;
    const product = state.products.find(p => p.id === productId);
    if (!product || !product.sizes) return;
    product.sizes.splice(sizeIndex, 1);
    saveData(); renderProducts(); renderAdminPanel();
    showToast('تم حذف المقاس', 'success');
}

// ====== إعادة تعيين عداد الفواتير ======
export function resetInvoiceCounter() {
    state.invoiceCounter = 0;
    saveSettings();
    showToast('تم إعادة تعيين عداد الفواتير', 'success');
}

// ====== تصدير البيانات ======
export function exportData() {
    const data = { categories: state.categories, products: state.products };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'data.json';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تصدير الأصناف والأقسام بنجاح!', 'success');
}

export function handleImportData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            let importedCategoriesCount = 0;
            let importedProductsCount = 0;

            // خريطة لربط معرف القسم القديم (من الملف) بالمعرف الجديد أو الموجود
            const categoryIdMap = {};

            if (data.categories && Array.isArray(data.categories)) {
                data.categories.forEach(importedCat => {
                    const existingByName = state.categories.find(c => c.name === importedCat.name);

                    if (existingByName) {
                        // القسم موجود مسبقاً بنفس الاسم، نربط منتجات هذا القسم بالمعرف الموجود
                        categoryIdMap[importedCat.id] = existingByName.id;
                    } else {
                        // قسم جديد، نتأكد أن المعرف غير مكرر
                        const existingById = state.categories.find(c => c.id === importedCat.id);
                        if (existingById) {
                            // تغيير المعرف لو كان موجود
                            const newId = Date.now() + Math.floor(Math.random() * 1000) + importedCategoriesCount;
                            categoryIdMap[importedCat.id] = newId;
                            importedCat.id = newId;
                        } else {
                            categoryIdMap[importedCat.id] = importedCat.id;
                        }
                        state.categories.push(importedCat);
                        importedCategoriesCount++;
                    }
                });
            }

            if (data.products && Array.isArray(data.products)) {
                data.products.forEach(importedProd => {
                    // تحديث معرف القسم بناءً على الخريطة
                    if (categoryIdMap[importedProd.categoryId]) {
                        importedProd.categoryId = categoryIdMap[importedProd.categoryId];
                    }

                    // التحقق مما إذا كان المنتج موجود مسبقاً (بنفس الاسم والقسم)
                    const existing = state.products.find(p => p.name === importedProd.name && p.categoryId === importedProd.categoryId);

                    if (!existing) {
                        // التأكد أن رقم الـ ID مو مكرر
                        const existingById = state.products.find(p => p.id === importedProd.id);
                        if (existingById) {
                            importedProd.id = Date.now() + Math.floor(Math.random() * 1000) + importedProductsCount;
                        }
                        state.products.push(importedProd);
                        importedProductsCount++;
                    }
                });
            }

            if (importedCategoriesCount > 0 || importedProductsCount > 0) {
                saveData();
                renderAdminPanel();
                if (typeof renderProducts === 'function') renderProducts();
                showToast(`تم استيراد ${importedCategoriesCount} قسم و ${importedProductsCount} صنف بـنـجـاح!`, 'success');
            } else {
                showToast('لم يتم استيراد شيء، جميع الأصناف والأقسام موجودة مسبقاً في القائمة.', 'info');
            }
        } catch (err) {
            console.error(err);
            showToast('حدث خطأ أثناء قراءة الملف، يرجى التأكد من أنه ملف JSON صحيح متوافق مع النظام.', 'error');
        }
        event.target.value = ''; // Reset input
    };
    reader.readAsText(file);
}

// ====== عرض لوحة الإدارة (#23 - Event Delegation) ======
export function renderAdminPanel() {
    const categorySelect = document.getElementById('categorySelect');
    if (!categorySelect) return;

    const previouslySelected = categorySelect.value ? parseInt(categorySelect.value) : null;
    categorySelect.innerHTML = '';
    state.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });
    if (state.categories.length > 0) {
        const stillExists = state.categories.some(c => c.id === previouslySelected);
        categorySelect.value = stillExists ? previouslySelected : state.categories[0].id;
    }

    // عرض الأقسام مع السحب والإفلات
    const adminCategoriesList = document.getElementById('adminCategoriesList');
    if (adminCategoriesList) {
        adminCategoriesList.innerHTML = '';
        state.categories.forEach((category, index) => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category-item drag-item';
            categoryDiv.draggable = true;
            categoryDiv.dataset.dragType = 'category';
            categoryDiv.dataset.dragIndex = index;
            const availabilityStatus = category.disabled ? '⏸️ <span style="color:#dc3545;font-weight:bold;">متوقف</span>' : '✅ <span style="color:#28a745;font-weight:bold;">متاح</span>';
            categoryDiv.innerHTML = `
                <div class="drag-handle" title="اسحب لإعادة الترتيب">⠿</div>
                <div class="item-info">
                    <div class="item-name">${category.name}</div>
                    <div class="item-image">${category.image}</div>
                    <div class="item-status">الحالة: ${availabilityStatus}</div>
                </div>
                <div class="item-actions">
                    <button class="edit-btn" data-action="editCategory" data-id="${category.id}">تعديل</button>
                    <button class="${category.disabled ? 'success-btn' : 'warning-btn'}" data-action="toggleCategory" data-id="${category.id}">${category.disabled ? '▶️ تفعيل' : '⏸️ إيقاف مؤقت'}</button>
                    <button class="copy-btn" data-action="copyCategory" data-id="${category.id}">نسخ</button>
                    <button class="paste-btn" data-action="pasteCategory" data-id="${category.id}">لصق هنا</button>
                    <button class="delete-btn" data-action="deleteCategory" data-id="${category.id}">حذف</button>
                </div>
            `;
            adminCategoriesList.appendChild(categoryDiv);
        });
        setupDragDrop(adminCategoriesList, 'category');
    }

    // عرض المنتجات
    const categoryId = parseInt(categorySelect.value);
    const adminProductsList = document.getElementById('adminProductsList');
    if (adminProductsList) {
        const filteredProducts = state.products.filter(p => p.categoryId === categoryId);
        adminProductsList.innerHTML = '';
        if (filteredProducts.length === 0) {
            adminProductsList.innerHTML = `<p style="text-align:center;color:#999;padding:15px;">لا توجد منتجات في هذا القسم</p>`;
            return;
        }
        filteredProducts.forEach((product, index) => {
            const productDiv = document.createElement('div');
            productDiv.className = 'product-item drag-item';
            productDiv.draggable = true;
            productDiv.dataset.dragType = 'product';
            productDiv.dataset.dragIndex = state.products.indexOf(product);
            const sizeCount = product.sizes ? product.sizes.length : 0;
            let sizesHTML = '';
            if (product.sizes && product.sizes.length > 0) {
                sizesHTML = '<div class="sizes-list">';
                product.sizes.forEach((size, idx) => {
                    sizesHTML += `<div class="size-row"><span>${size.name} - ${formatPrice(size.price)}</span><div class="size-actions"><button class="edit-btn" style="padding:4px 8px;font-size:12px;" data-action="editSize" data-product-id="${product.id}" data-size-index="${idx}">تعديل</button><button class="delete-btn" style="padding:4px 8px;font-size:12px;" data-action="deleteSize" data-product-id="${product.id}" data-size-index="${idx}">حذف</button></div></div>`;
                });
                sizesHTML += '</div>';
            }
            const currentCategory = state.categories.find(c => c.id === product.categoryId);
            const categoryName = currentCategory ? currentCategory.name : 'غير محدد';
            const badgeLabels = { 'new': '🟢 جديد', 'best': '🔴 الأكثر مبيعاً', 'offer': '🟡 عرض خاص' };
            const badgeText = product.badge && badgeLabels[product.badge] ? ` | الشارة: ${badgeLabels[product.badge]}` : '';
            const availabilityStatus = product.disabled ? '⏸️ <span style="color:#dc3545;font-weight:bold;">متوقف</span>' : '✅ <span style="color:#28a745;font-weight:bold;">متاح</span>';

            productDiv.innerHTML = `
                <div class="drag-handle" title="اسحب لإعادة الترتيب">⠿</div>
                <div class="item-info">
                    <div class="item-name">${product.name}</div>
                    <div class="item-image">القسم: ${categoryName} | السعر: ${formatPrice(product.basePrice)} | المقاسات: ${formatNumber(sizeCount)}${badgeText} | الحالة: ${availabilityStatus}</div>
                    ${sizesHTML}
                </div>
                <div class="item-actions">
                    <button class="edit-btn" data-action="editProduct" data-id="${product.id}">تعديل</button>
                    <button class="add-btn" data-action="addSize" data-id="${product.id}">+ إضافة حجم</button>
                    <button class="${product.badge === 'best' ? 'delete-btn' : 'copy-btn'}" data-action="toggleBestSeller" data-id="${product.id}">${product.badge === 'best' ? '❌ إزالة الأكثر مبيعاً' : '🔥 الأكثر مبيعاً'}</button>
                    <button class="${product.disabled ? 'success-btn' : 'warning-btn'}" data-action="toggleProduct" data-id="${product.id}">${product.disabled ? '▶️ تفعيل' : '⏸️ إيقاف مؤقت'}</button>
                    <button class="delete-btn" data-action="deleteProduct" data-id="${product.id}">حذف</button>
                </div>
            `;
            adminProductsList.appendChild(productDiv);
        });
        setupDragDrop(adminProductsList, 'product');
    }
}

// ====== Event Delegation للأقسام والمنتجات (#23) ======
export function setupAdminDelegation() {
    const adminCategoriesList = document.getElementById('adminCategoriesList');
    if (adminCategoriesList) {
        adminCategoriesList.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = parseInt(btn.dataset.id);
            switch (action) {
                case 'editCategory': editCategory(id); break;
                case 'toggleCategory': toggleCategoryAvailability(id); break;
                case 'copyCategory': copyCategoryById(id); break;
                case 'pasteCategory': pasteCategoryInto(id); break;
                case 'deleteCategory': deleteCategory(id); break;
                case 'autoFillCategoryCalories': autoFillCategoryCalories(id); break;
                case 'removeCategoryCalories': removeCategoryCalories(id); break;
            }
        });
    }

    const adminProductsList = document.getElementById('adminProductsList');
    if (adminProductsList) {
        adminProductsList.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = parseInt(btn.dataset.id);
            const productId = parseInt(btn.dataset.productId);
            const sizeIndex = parseInt(btn.dataset.sizeIndex);
            switch (action) {
                case 'editProduct': editProduct(id); break;
                case 'addSize': addSizeToProduct(id); break;
                case 'toggleProduct': toggleProductAvailability(id); break;
                case 'deleteProduct': deleteProduct(id); break;
                case 'toggleBestSeller': toggleBestSeller(id); break;
                case 'editSize': editSize(productId, sizeIndex); break;
                case 'deleteSize': deleteSize(productId, sizeIndex); break;
            }
        });
    }

    // تغيير القسم في القائمة المنسدلة
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) {
        categorySelect.addEventListener('change', () => renderAdminPanel());
    }
}

// ====== تعديل المنتج ======
export function editCategory(categoryId) { openAdminForm('category-edit', categoryId); }

export function editProduct(productId) { openEditProductModal(productId); }

export function openEditProductModal(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    state.editingProductId = productId;
    state._suppressFirebaseSync = true;

    const nameInput = document.getElementById('productName');
    if (nameInput) nameInput.value = product.name;
    const caloriesInput = document.getElementById('productCalories');
    if (caloriesInput) caloriesInput.value = product.calories || '';
    const badgeSelect = document.getElementById('productBadge');
    if (badgeSelect) badgeSelect.value = product.badge || '';

    const imageInput = document.getElementById('editItemImage');
    if (imageInput) {
        imageInput.value = product.image || '';
        imageInput.dataset.manual = '';
        imageInput.oninput = function () { imageInput.dataset.manual = '1'; };

        if (nameInput) {
            nameInput.oninput = function () {
                if (!imageInput.dataset.manual && imageInput.value.includes('/')) {
                    const ext = imageInput.value.split('.').pop();
                    const basePath = imageInput.value.substring(0, imageInput.value.lastIndexOf('/') + 1);
                    imageInput.value = basePath + (this.value.trim() ? `${this.value.trim()}.${ext}` : `.jpg`);
                } else if (!imageInput.dataset.manual) {
                    imageInput.value = this.value.trim() ? `images/${this.value.trim()}.jpg` : '';
                }
            };
        }
    }

    const categorySelect = document.getElementById('productCategory');
    if (categorySelect) {
        categorySelect.innerHTML = '';
        state.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            if (cat.id === product.categoryId) option.selected = true;
            categorySelect.appendChild(option);
        });
    }

    renderSizesForEdit(product);
    renderTypesForEdit(product);
    renderTypeGroupsForEdit(product);
    setupTypeSpecificPricing(product);

    const modal = document.getElementById('editProductModal');
    if (modal) modal.classList.add('active');
}

export function renderSizesForEdit(product) {
    const sizesList = document.getElementById('editSizesList');
    if (!sizesList) return;
    sizesList.innerHTML = '';

    if (!product.sizes || product.sizes.length === 0) product.sizes = [{ name: 'افتراضي', price: product.basePrice }];

    const infoLine = document.createElement('div');
    infoLine.style.cssText = 'font-size:13px;color:#7a5a40;margin-bottom:8px;';
    infoLine.textContent = `عدد الأحجام: ${product.sizes.length}`;
    sizesList.appendChild(infoLine);

    product.sizes.forEach((size, index) => {
        const sizeRow = document.createElement('div');
        sizeRow.className = 'size-row';
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button'; deleteBtn.className = 'delete-size-btn'; deleteBtn.textContent = '✕';
        deleteBtn.onclick = (e) => { e.preventDefault(); product.sizes.splice(index, 1); renderSizesForEdit(product); };
        const sizeNameInput = document.createElement('input');
        sizeNameInput.type = 'text'; sizeNameInput.placeholder = 'المقاس'; sizeNameInput.value = size.name;
        sizeNameInput.oninput = (e) => { product.sizes[index].name = e.target.value; };
        const priceInput = document.createElement('input');
        priceInput.type = 'number'; priceInput.step = '0.01'; priceInput.placeholder = 'السعر'; priceInput.value = size.price;
        priceInput.oninput = (e) => { product.sizes[index].price = parseFloat(e.target.value) || 0; };
        sizeRow.appendChild(deleteBtn); sizeRow.appendChild(sizeNameInput); sizeRow.appendChild(priceInput);
        sizesList.appendChild(sizeRow);
    });
}

export function addNewSize() {
    if (!state.editingProductId) return;
    const product = state.products.find(p => p.id === state.editingProductId);
    if (!product) return;
    if (!product.sizes) product.sizes = [];
    product.sizes.push({ name: '', price: 0 });
    renderSizesForEdit(product);
}

export function renderTypesForEdit(product) {
    const typesList = document.getElementById('editTypesList');
    if (!typesList) return;
    typesList.innerHTML = '';
    if (!product.types) product.types = [];
    if (!product.typeSpecificPricingEnabled) product.typeSpecificPricingEnabled = {};

    product.types.forEach((type, index) => {
        const typeRow = document.createElement('div');
        typeRow.className = 'type-row';
        typeRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:12px;';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button'; deleteBtn.className = 'delete-size-btn'; deleteBtn.textContent = '✕';
        deleteBtn.onclick = (e) => {
            e.preventDefault();
            const currentType = product.types[index];
            product.types.splice(index, 1);
            if (product.typeSpecificSizes && currentType) delete product.typeSpecificSizes[currentType];
            if (product.typeSpecificPricingEnabled && currentType) delete product.typeSpecificPricingEnabled[currentType];
            saveData(); renderTypesForEdit(product); renderTypeSpecificPricing(product);
        };

        const typeInput = document.createElement('input');
        typeInput.type = 'text'; typeInput.placeholder = 'النوع'; typeInput.value = type; typeInput.style.flex = '1';
        let lastValue = type;
        typeInput.oninput = (e) => {
            const newValue = e.target.value.trim();
            product.types[index] = newValue;
            if (product.typeSpecificSizes && lastValue && lastValue !== newValue) {
                if (product.typeSpecificSizes[lastValue]) { product.typeSpecificSizes[newValue] = product.typeSpecificSizes[lastValue]; delete product.typeSpecificSizes[lastValue]; }
            }
            if (product.typeSpecificPricingEnabled && lastValue && lastValue !== newValue) {
                if (product.typeSpecificPricingEnabled[lastValue] !== undefined) { product.typeSpecificPricingEnabled[newValue] = product.typeSpecificPricingEnabled[lastValue]; delete product.typeSpecificPricingEnabled[lastValue]; }
            }
            if (!product.disabledTypes) product.disabledTypes = [];
            const dIdx = product.disabledTypes.indexOf(lastValue);
            if (dIdx > -1) { product.disabledTypes[dIdx] = newValue; }
            lastValue = newValue;
            renderTypeSpecificPricing(product); // تحديث الأسعار مباشرة أثناء الكتابة إذا كانت مفعلة
        };
        typeInput.onblur = () => { saveData(); renderTypeSpecificPricing(product); };

        const toggleContainer = document.createElement('label');
        toggleContainer.style.cssText = 'display:flex;align-items:center;gap:6px;background:#fff3cd;padding:8px 12px;border-radius:6px;cursor:pointer;white-space:nowrap;border:2px solid #ffc107;';
        const toggleCheckbox = document.createElement('input');
        toggleCheckbox.type = 'checkbox'; toggleCheckbox.checked = product.typeSpecificPricingEnabled[type] || false;
        toggleCheckbox.style.cssText = 'width:18px;height:18px;cursor:pointer;';
        toggleCheckbox.onchange = () => {
            const currentType = product.types[index]; // استخدام الاسم الحالي
            if (!currentType) {
                showToast('يرجى كتابة اسم النوع أولاً قبل تفعيل الأسعار الخاصة به.', 'warning');
                toggleCheckbox.checked = false;
                return;
            }
            product.typeSpecificPricingEnabled[currentType] = toggleCheckbox.checked;
            if (toggleCheckbox.checked) {
                if (!product.typeSpecificSizes) product.typeSpecificSizes = {};
                if (!product.typeSpecificSizes[currentType]) product.typeSpecificSizes[currentType] = [{ name: 'عادي', price: 0 }];
            } else {
                if (product.typeSpecificSizes) delete product.typeSpecificSizes[currentType];
            }
            saveData(); renderTypeSpecificPricing(product);
        };
        const toggleLabel = document.createElement('span');
        toggleLabel.textContent = '💰 أسعار خاصة'; toggleLabel.style.cssText = 'font-size:12px;font-weight:600;';
        toggleContainer.appendChild(toggleCheckbox); toggleContainer.appendChild(toggleLabel);

        if (!product.disabledTypes) product.disabledTypes = [];
        const availabilityBtn = document.createElement('button');
        availabilityBtn.type = 'button';
        const isDisabled = product.disabledTypes.includes(type);
        availabilityBtn.className = isDisabled ? 'success-btn' : 'warning-btn';
        availabilityBtn.textContent = isDisabled ? '▶️ تفعيل' : '⏸️ إيقاف';
        availabilityBtn.style.cssText = 'padding:6px 10px;font-size:11px;border-radius:6px;cursor:pointer;border:none;color:white;font-weight:bold;white-space:nowrap;';
        availabilityBtn.onclick = (e) => {
            e.preventDefault();
            const currentType = product.types[index];
            if (!currentType) return;
            if (!product.disabledTypes) product.disabledTypes = [];
            const idx = product.disabledTypes.indexOf(currentType);
            if (idx > -1) { product.disabledTypes.splice(idx, 1); availabilityBtn.className = 'warning-btn'; availabilityBtn.textContent = '⏸️ إيقاف'; showToast('تم تفعيل النوع', 'success'); }
            else { product.disabledTypes.push(currentType); availabilityBtn.className = 'success-btn'; availabilityBtn.textContent = '▶️ تفعيل'; showToast('تم إيقاف النوع مؤقتاً', 'success'); }
            saveData(); renderProducts();
        };

        typeRow.appendChild(deleteBtn); typeRow.appendChild(typeInput); typeRow.appendChild(toggleContainer); typeRow.appendChild(availabilityBtn);
        typesList.appendChild(typeRow);
    });

    if (product.types.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.textContent = 'لا توجد أنواع. اضغط "أضف نوع أخر" لإضافة نوع جديد.';
        emptyMsg.style.cssText = 'color:#888;margin-top:8px;font-size:13px;';
        typesList.appendChild(emptyMsg);
    }
}

export function addNewType() {
    if (!state.editingProductId) return;
    const product = state.products.find(p => p.id === state.editingProductId);
    if (!product) return;
    if (!product.types) product.types = [];
    product.types.push('');
    renderTypesForEdit(product);
    renderTypeSpecificPricing(product);
}

// ====== سطور الأنواع الإضافية (مجموعات) ======
export function addNewTypeGroup() {
    if (!state.editingProductId) return;
    const product = state.products.find(p => p.id === state.editingProductId);
    if (!product) return;
    if (!product.typeGroups) product.typeGroups = [];
    product.typeGroups.push({ label: 'سطر ' + (product.typeGroups.length + 1), types: [''] });
    renderTypeGroupsForEdit(product);
}

export function renderTypeGroupsForEdit(product) {
    const container = document.getElementById('editTypeGroupsList');
    if (!container) return;
    container.innerHTML = '';
    if (!product.typeGroups || product.typeGroups.length === 0) {
        container.innerHTML = '<div style="color:#888;margin-top:8px;font-size:13px;">لا توجد سطور إضافية.</div>';
        return;
    }
    product.typeGroups.forEach((group, groupIndex) => {
        const groupCard = document.createElement('div');
        groupCard.style.cssText = 'background:#f0f7ff;border:2px solid #3498db;border-radius:10px;padding:15px;margin-bottom:15px;';

        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:10px;';
        const labelInput = document.createElement('input');
        labelInput.type = 'text'; labelInput.placeholder = 'اسم السطر'; labelInput.value = group.label || '';
        labelInput.style.cssText = 'flex:1;padding:8px;border:1px solid #3498db;border-radius:6px;font-size:14px;font-weight:600;';
        labelInput.oninput = (e) => { product.typeGroups[groupIndex].label = e.target.value; };
        labelInput.onblur = () => saveData();

        const deleteGroupBtn = document.createElement('button');
        deleteGroupBtn.type = 'button'; deleteGroupBtn.textContent = '🗑️ حذف السطر';
        deleteGroupBtn.style.cssText = 'padding:8px 12px;font-size:12px;background:#e74c3c;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;';
        deleteGroupBtn.onclick = () => { product.typeGroups.splice(groupIndex, 1); saveData(); renderTypeGroupsForEdit(product); };

        headerRow.appendChild(labelInput); headerRow.appendChild(deleteGroupBtn);
        groupCard.appendChild(headerRow);

        const typesContainer = document.createElement('div');
        if (!group.types) group.types = [];
        group.types.forEach((type, typeIndex) => {
            const typeRow = document.createElement('div');
            typeRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button'; deleteBtn.className = 'delete-size-btn'; deleteBtn.textContent = '✕';
            deleteBtn.onclick = () => { group.types.splice(typeIndex, 1); saveData(); renderTypeGroupsForEdit(product); };

            const typeInput = document.createElement('input');
            typeInput.type = 'text'; typeInput.placeholder = 'النوع'; typeInput.value = type;
            typeInput.style.cssText = 'flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;';
            typeInput.oninput = (e) => { product.typeGroups[groupIndex].types[typeIndex] = e.target.value; };
            typeInput.onblur = () => saveData();

            if (!group.disabledTypes) group.disabledTypes = [];
            const availBtn = document.createElement('button');
            availBtn.type = 'button';
            const isDisabledGT = group.disabledTypes.includes(type);
            availBtn.className = isDisabledGT ? 'success-btn' : 'warning-btn';
            availBtn.textContent = isDisabledGT ? '▶️ تفعيل' : '⏸️ إيقاف';
            availBtn.style.cssText = 'padding:6px 10px;font-size:11px;border-radius:6px;cursor:pointer;border:none;color:white;font-weight:bold;white-space:nowrap;';
            availBtn.onclick = () => {
                if (!group.disabledTypes) group.disabledTypes = [];
                const idx = group.disabledTypes.indexOf(type);
                if (idx > -1) { group.disabledTypes.splice(idx, 1); showToast('تم تفعيل النوع', 'success'); }
                else { group.disabledTypes.push(type); showToast('تم إيقاف النوع مؤقتاً', 'success'); }
                saveData(); renderTypeGroupsForEdit(product);
            };

            typeRow.appendChild(deleteBtn); typeRow.appendChild(typeInput); typeRow.appendChild(availBtn);
            typesContainer.appendChild(typeRow);
        });
        groupCard.appendChild(typesContainer);

        const addTypeBtn = document.createElement('button');
        addTypeBtn.type = 'button'; addTypeBtn.className = 'add-more-btn'; addTypeBtn.textContent = '+ أضف نوع';
        addTypeBtn.style.cssText = 'margin-top:5px;font-size:12px;padding:6px 14px;';
        addTypeBtn.onclick = () => { group.types.push(''); renderTypeGroupsForEdit(product); };
        groupCard.appendChild(addTypeBtn);
        container.appendChild(groupCard);
    });
}

// ====== التسعير الخاص بالأنواع ======
export function setupTypeSpecificPricing(product) {
    const section = document.getElementById('typeSpecificPricingSection');
    if (section) section.style.display = 'block';
    renderTypeSpecificPricing(product);
}

export function renderTypeSpecificPricing(product) {
    const container = document.getElementById('typeSpecificPricingContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!product.types || product.types.length === 0) {
        container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">أضف أنواعاً أولاً</p>';
        return;
    }
    if (!product.typeSpecificSizes) product.typeSpecificSizes = {};
    if (!product.typeSpecificPricingEnabled) product.typeSpecificPricingEnabled = {};

    const typesWithPricing = product.types.filter(type => type && product.typeSpecificPricingEnabled[type]);
    if (typesWithPricing.length === 0) {
        container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;font-size:13px;">💡 فعّل "أسعار خاصة" لأي نوع</p>';
        return;
    }

    typesWithPricing.forEach(type => {
        if (!product.typeSpecificSizes[type]) product.typeSpecificSizes[type] = [{ name: 'عادي', price: 0 }];

        const card = document.createElement('div');
        card.className = 'type-pricing-card';
        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--primary-orange);';
        const title = document.createElement('h4');
        title.textContent = `📋 أسعار: ${type}`; title.style.cssText = 'margin:0;color:var(--primary-orange);font-size:16px;';
        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex;gap:6px;';
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button'; copyBtn.textContent = '📋 نسخ';
        copyBtn.style.cssText = 'padding:6px 12px;font-size:12px;background:#3498db;color:white;border:none;border-radius:5px;cursor:pointer;';
        copyBtn.onclick = () => copyTypeSpecificSizes(type, product.typeSpecificSizes[type]);
        const pasteBtn = document.createElement('button');
        pasteBtn.type = 'button'; pasteBtn.textContent = '📥 لصق';
        pasteBtn.style.cssText = 'padding:6px 12px;font-size:12px;background:#2ecc71;color:white;border:none;border-radius:5px;cursor:pointer;';
        pasteBtn.onclick = () => pasteTypeSpecificSizes(product, type);
        btns.appendChild(copyBtn); btns.appendChild(pasteBtn);
        header.appendChild(title); header.appendChild(btns);
        card.appendChild(header);

        const sizesContainer = document.createElement('div');
        sizesContainer.className = 'type-pricing-sizes';
        product.typeSpecificSizes[type].forEach((size, sizeIndex) => {
            const sizeRow = document.createElement('div');
            sizeRow.className = 'type-pricing-size-row';
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button'; deleteBtn.className = 'delete-size-btn'; deleteBtn.textContent = '✕';
            deleteBtn.onclick = () => { product.typeSpecificSizes[type].splice(sizeIndex, 1); saveData(); renderTypeSpecificPricing(product); };
            const nameInput = document.createElement('input');
            nameInput.type = 'text'; nameInput.placeholder = 'المقاس'; nameInput.value = size.name;
            nameInput.oninput = (e) => { product.typeSpecificSizes[type][sizeIndex].name = e.target.value; };
            nameInput.onblur = () => saveData();
            const priceInput = document.createElement('input');
            priceInput.type = 'number'; priceInput.step = '0.01'; priceInput.placeholder = 'السعر'; priceInput.value = size.price;
            priceInput.oninput = (e) => { product.typeSpecificSizes[type][sizeIndex].price = parseFloat(e.target.value) || 0; };
            priceInput.onblur = () => saveData();
            sizeRow.appendChild(deleteBtn); sizeRow.appendChild(nameInput); sizeRow.appendChild(priceInput);
            sizesContainer.appendChild(sizeRow);
        });
        card.appendChild(sizesContainer);

        const addBtn = document.createElement('button');
        addBtn.type = 'button'; addBtn.className = 'type-pricing-add-btn'; addBtn.textContent = '+ إضافة مقاس';
        addBtn.onclick = () => { product.typeSpecificSizes[type].push({ name: '', price: 0 }); saveData(); renderTypeSpecificPricing(product); };
        card.appendChild(addBtn);
        container.appendChild(card);
    });
}

export function closeEditProductModal() {
    document.getElementById('editProductModal').classList.remove('active');
    document.getElementById('editProductForm').reset();
    state.editingProductId = null;
    state._suppressFirebaseSync = false;
    resyncFromFirebase();
}

export function saveEditedProduct(e) {
    e.preventDefault();
    if (!state.editingProductId) { showToast('خطأ: لم يتم تحديد المنتج', 'error'); return; }
    const product = state.products.find(p => p.id === state.editingProductId);
    if (!product) return;

    const newName = document.getElementById('productName').value.trim();
    const newCategoryId = parseInt(document.getElementById('productCategory').value);
    if (!newName) { showToast('يجب إدخال اسم المنتج', 'error'); return; }
    if (!state.categories.find(c => c.id === newCategoryId)) { showToast('يجب اختيار قسم صحيح', 'error'); return; }
    if (!product.sizes || product.sizes.length === 0) { showToast('يجب إضافة حجم واحد على الأقل', 'error'); return; }

    const oldProductName = product.name;
    product.name = newName;
    product.categoryId = newCategoryId;
    product.basePrice = product.sizes[0].price;

    const caloriesInput = document.getElementById('productCalories');
    if (caloriesInput && caloriesInput.value) {
        product.calories = parseInt(caloriesInput.value);
    } else {
        delete product.calories;
    }

    const badgeSelect = document.getElementById('productBadge');
    if (badgeSelect) product.badge = badgeSelect.value || '';

    const imageInput = document.getElementById('editItemImage');
    if (imageInput && imageInput.value.trim()) {
        product.image = imageInput.value.trim();
    }

    state._suppressFirebaseSync = false;
    promptBranchSync('product', product, () => {
        saveData(); renderProducts(); renderAdminPanel(); closeEditProductModal();
    });
}

// ====== السحب والإفلات لترتيب الأقسام والمنتجات ======
function setupDragDrop(container, type) {
    let draggedIndex = null;

    container.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.drag-item');
        if (!item) return;
        draggedIndex = parseInt(item.dataset.dragIndex);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedIndex);
    });

    container.addEventListener('dragend', (e) => {
        const item = e.target.closest('.drag-item');
        if (item) item.classList.remove('dragging');
        container.querySelectorAll('.drag-item').forEach(el => el.classList.remove('drag-over'));
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const afterElement = getDragAfterElement(container, e.clientY);
        const dragging = container.querySelector('.dragging');
        if (!dragging) return;
        if (afterElement == null) container.appendChild(dragging);
        else container.insertBefore(dragging, afterElement);
    });

    container.addEventListener('dragenter', (e) => {
        const item = e.target.closest('.drag-item');
        if (item && !item.classList.contains('dragging')) item.classList.add('drag-over');
    });

    container.addEventListener('dragleave', (e) => {
        const item = e.target.closest('.drag-item');
        if (item) item.classList.remove('drag-over');
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const items = [...container.querySelectorAll('.drag-item')];
        const toIndex = items.findIndex(el => el.classList.contains('dragging'));

        if (type === 'category' && fromIndex !== toIndex && !isNaN(fromIndex) && !isNaN(toIndex)) {
            const [moved] = state.categories.splice(fromIndex, 1);
            state.categories.splice(toIndex, 0, moved);
            saveData();
            renderCategories();
            renderAdminPanel();
            showToast('تم إعادة ترتيب الأقسام', 'success');
        } else if (type === 'product' && !isNaN(fromIndex)) {
            // للمنتجات: نحتاج لحساب الترتيب ضمن القسم الحالي
            const categoryId = parseInt(document.getElementById('categorySelect').value);
            const categoryProducts = state.products.filter(p => p.categoryId === categoryId);
            const allOther = state.products.filter(p => p.categoryId !== categoryId);

            // إعادة بناء ترتيب المنتجات من DOM
            const newOrder = items.map(el => parseInt(el.dataset.dragIndex)).filter(i => !isNaN(i));
            const reordered = newOrder.map(i => state.products[i]);
            state.products = [...allOther, ...reordered];
            saveData();
            renderProducts();
            renderAdminPanel();
            showToast('تم إعادة ترتيب المنتجات', 'success');
        }

        container.querySelectorAll('.drag-item').forEach(el => el.classList.remove('drag-over', 'dragging'));
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ====== الإحصائيات (#16) ======
function renderStats() {
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) return;

    const totalCategories = state.categories.length;
    const activeCategories = state.categories.filter(c => !c.disabled).length;
    const totalProducts = state.products.length;
    const activeProducts = state.products.filter(p => !p.disabled).length;
    const avgPrice = totalProducts > 0 ? (state.products.reduce((sum, p) => sum + (p.basePrice || 0), 0) / totalProducts).toFixed(1) : 0;
    const maxPrice = totalProducts > 0 ? Math.max(...state.products.map(p => p.basePrice || 0)) : 0;
    const minPrice = totalProducts > 0 ? Math.min(...state.products.map(p => p.basePrice || 0)) : 0;
    const productsWithBadge = state.products.filter(p => p.badge).length;
    const bestSellers = state.products.filter(p => p.badge === 'best').length;

    // المنتجات حسب القسم
    const productsByCategory = state.categories.map(cat => ({
        name: cat.name,
        count: state.products.filter(p => p.categoryId === cat.id).length
    })).sort((a, b) => b.count - a.count);

    let categoryBreakdown = productsByCategory.map(c =>
        `<div class="stat-bar-item"><span class="stat-bar-label">${c.name}</span><div class="stat-bar-track"><div class="stat-bar-fill" style="width:${totalProducts > 0 ? (c.count / totalProducts * 100) : 0}%"></div></div><span class="stat-bar-value">${c.count}</span></div>`
    ).join('');

    statsContainer.innerHTML = `
        <h3>📊 إحصائيات سريعة</h3>
        <div class="stats-grid">
            <div class="stat-card stat-blue"><div class="stat-number">${totalCategories}</div><div class="stat-label">أقسام (${activeCategories} نشط)</div></div>
            <div class="stat-card stat-green"><div class="stat-number">${totalProducts}</div><div class="stat-label">منتجات (${activeProducts} نشط)</div></div>
            <div class="stat-card stat-orange"><div class="stat-number">${avgPrice}</div><div class="stat-label">متوسط السعر (ريال)</div></div>
            <div class="stat-card stat-red"><div class="stat-number">${bestSellers}</div><div class="stat-label">الأكثر مبيعاً</div></div>
            <div class="stat-card stat-purple"><div class="stat-number">${minPrice} - ${maxPrice}</div><div class="stat-label">نطاق الأسعار (ريال)</div></div>
            <div class="stat-card stat-teal"><div class="stat-number">${state.invoiceCounter}</div><div class="stat-label">الفواتير المصدرة</div></div>
        </div>
        <div class="stat-breakdown">
            <h4>توزيع المنتجات حسب الأقسام</h4>
            ${categoryBreakdown}
        </div>
    `;
}

// ====== إعداد متحكمات التصميم المتقدمة ======
function setupDesignControls() {
    const d = state.design || {};

    // القواميس والقيم
    const controls = {
        'logoUrlInput': { key: 'logoUrl', type: 'text' },
        'logoSizeRange': { key: 'logoSize', valId: 'logoSizeVal', suffix: 'px' },
        'borderRadiusRange': { key: 'borderRadius', valId: 'borderRadiusVal', suffix: 'px' },
        'shadowIntensityRange': { key: 'shadowIntensity', valId: 'shadowIntensityVal', suffix: '' },
        'headerBlurRange': { key: 'headerBlur', valId: 'headerBlurVal', suffix: 'px' },
        'fontScaleRange': { key: 'fontSizeScale', valId: 'fontScaleVal', suffix: '%' },
        'caloriesScaleRange': { key: 'caloriesScale', valId: 'caloriesScaleVal', suffix: '%' },
        'caloriesPosXRange': { key: 'caloriesPosX', valId: 'caloriesPosXVal', suffix: 'px' },
        'caloriesPosYRange': { key: 'caloriesPosY', valId: 'caloriesPosYVal', suffix: 'px' },
        'caloriesVisibilitySelect': { key: 'caloriesVisibility', type: 'select' },
        'categoryShapeSelect': { key: 'categoryCardShape', type: 'select' },
        'gridColumnsMobileSelect': { key: 'gridColumnsMobile', type: 'select' },
        'cardHoverEffectSelect': { key: 'cardHoverEffect', type: 'select' },
        'designPrimaryColor': { key: 'primaryColor', type: 'color' },
        'designBackgroundColor': { key: 'backgroundColor', type: 'color' },
        'designTextColor': { key: 'textColor', type: 'color' },
        'designAccentColor': { key: 'accentColor', type: 'color' },

        // المزايا الإضافية
        'backgroundPatternSelect': { key: 'backgroundPattern', type: 'select' },
        'backgroundGradientSelect': { key: 'backgroundGradient', type: 'select' },
        'darkModeSelect': { key: 'darkMode', type: 'select' },
        'buttonStyleSelect': { key: 'buttonStyle', type: 'select' },
        'imageBorderWidthSelect': { key: 'imageBorderWidth', type: 'select' },
        'pricePositionSelect': { key: 'pricePosition', type: 'select' },
        'fontWeightSelect': { key: 'fontWeight', type: 'select' },
        'loadingSpinnerSelect': { key: 'loadingSpinner', type: 'select' },
        'pageTransitionSelect': { key: 'pageTransition', type: 'select' },
        'cartIconStyleSelect': { key: 'cartIconStyle', type: 'select' },

        'badgeColorNew': { key: 'badgeColorNew', type: 'color' },
        'badgeColorBest': { key: 'badgeColorBest', type: 'color' },
        'cartBadgeColor': { key: 'cartBadgeColor', type: 'color' },
        'customCSSTextarea': { key: 'customCSS', type: 'text' },
        'footerTextInput': { key: 'footerText', type: 'text' }
    };

    // تعيين القيم الحالية وإضافة المستمعين
    Object.entries(controls).forEach(([id, config]) => {
        const el = document.getElementById(id);
        if (!el) return;

        const val = d[config.key];
        if (val !== undefined && el.type !== 'file') el.value = val;

        if (config.valId) {
            const valEl = document.getElementById(config.valId);
            if (valEl) valEl.textContent = val + (config.suffix || '');
        }

        const handleChange = () => {
            const newDesign = {};

            if (config.key === 'darkMode') {
                newDesign[config.key] = el.value === 'true';
            } else {
                newDesign[config.key] = el.value;
            }

            if (!state.design) state.design = {};
            state.design[config.key] = newDesign[config.key];

            applyDesign(newDesign);
            hasUnsavedDesignChanges = true;

            if (config.valId) {
                const valEl = document.getElementById(config.valId);
                if (valEl) valEl.textContent = el.value + (config.suffix || '');
            }
        };

        if (config.type === 'color' || config.type === 'select') {
            el.onchange = handleChange;
        } else if (config.type === 'text') {
            el.oninput = handleChange;
            el.onchange = handleChange; // save string values after typing mostly
        } else {
            el.oninput = handleChange;
        }
    });

    // إعداد الخط
    const fontSelector = document.getElementById('fontSelector');
    if (fontSelector) {
        fontSelector.innerHTML = '';
        availableFonts.forEach(font => {
            const option = document.createElement('option');
            option.value = font.id;
            option.textContent = font.name;
            if (font.id === state.appFont) option.selected = true;
            fontSelector.appendChild(option);
        });
        fontSelector.onchange = function () {
            applyFont(this.value);
            saveSettings();
            showToast(`تم تغيير الخط ✓`, 'success');
        };
    }

    // زر الحفظ
    const saveBtn = document.getElementById('saveDesignBtn');
    if (saveBtn) {
        saveBtn.onclick = () => {
            saveSettings();
            originalDesignState = JSON.parse(JSON.stringify(state.design));
            hasUnsavedDesignChanges = false;
            showToast('تم حفظ التعديلات بنجاح ✨', 'success');
        };
    }

    // زر الإلغاء
    const cancelBtn = document.getElementById('cancelDesignBtn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            applyDesign(originalDesignState);
            hasUnsavedDesignChanges = false;
            setupDesignControls();
            showToast('تم إلغاء التعديلات ✖️', 'info');
        };
    }

    // زر الاستعادة
    const resetBtn = document.getElementById('resetDesignBtn');
    if (resetBtn) {
        resetBtn.onclick = () => {
            const defaults = {
                borderRadius: '15',
                categoryCardShape: '50%',
                logoUrl: 'images/logo.jpg',
                logoSize: '100',
                shadowIntensity: '0.1',
                headerBlur: '10',
                primaryColor: '#f26d21',
                backgroundColor: '#fff2e8',
                textColor: '#4a2c1a',
                accentColor: '#2ecc71',
                fontSizeScale: '100',
                caloriesScale: '100',
                caloriesPosX: '0',
                caloriesPosY: '0',
                caloriesVisibility: 'both',
                gridColumnsMobile: '2',
                backgroundPattern: 'none',
                pricePosition: 'bottom',
                imageBorderWidth: '0',
                fontWeight: 'normal',
                badgeColorNew: '#2ecc71',
                badgeColorBest: '#ff4500',
                cartIconStyle: 'default',
                cartBadgeColor: '#ff0000',
                darkMode: false,
                backgroundGradient: 'none',
                pageTransition: 'fade',
                loadingSpinner: 'circle',
                footerText: '',
                customCSS: '',
                buttonStyle: 'filled'
            };
            applyDesign(defaults);
            saveSettings();
            setupDesignControls(); // لإعادة تحديث الواجهة
            showToast('تم استعادة الإعدادات الافتراضية ✓', 'success');
        };
    }
}

function rgbToHex(str) {
    if (!str || str.startsWith('#')) return str;
    const match = str.match(/\d+/g);
    if (!match || match.length < 3) return str;
    return '#' + match.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
}

// ====== مساعد التوقع الآلي للسعرات ======
async function fetchWithTimeout(url, ms = 4000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
}

export async function autoFillCalories(nameInputId, caloriesInputId, categorySelectId) {
    const nameInput = document.getElementById(nameInputId);
    if (!nameInput) return;
    const name = nameInput.value.trim();

    if (!name) {
        showToast('يرجى كتابة اسم الصنف أولاً للحصول على رقم', 'info');
        return;
    }

    const catSelect = document.getElementById(categorySelectId);
    const catName = catSelect && catSelect.options[catSelect.selectedIndex] ? catSelect.options[catSelect.selectedIndex].text : '';
    const searchName = catName ? catName + ' ' + name : name;

    const btn = document.getElementById(nameInputId === 'adminItemName' ? 'adminMagicCaloriesBtn' : 'magicCaloriesBtn');
    if (btn) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '⏳';
        btn.disabled = true;
    }

    let matchedCalories = null;

    try {
        // 1. ترجمة الاسم للإنجليزية
        const transRes = await fetchWithTimeout(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(searchName)}&langpair=ar|en`, 3000);
        const transData = await transRes.json();
        let englishName = searchName;
        if (transData && transData.responseData && transData.responseData.translatedText) {
            englishName = transData.responseData.translatedText.toLowerCase();
        }

        // 2. البحث
        const foodRes = await fetchWithTimeout(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(englishName)}&search_simple=1&action=process&json=1&page_size=5`, 4000);
        const foodData = await foodRes.json();

        if (foodData && foodData.products && foodData.products.length > 0) {
            const productWithKcal = foodData.products.find(p => p.nutriments && p.nutriments['energy-kcal_100g']);
            if (productWithKcal) {
                const kcal100 = productWithKcal.nutriments['energy-kcal_100g'];
                const kcalServing = productWithKcal.nutriments['energy-kcal_serving'];
                if (kcalServing && kcalServing > 0) {
                    matchedCalories = Math.round(kcalServing);
                } else {
                    matchedCalories = Math.round(kcal100 * 3);
                }
            }
        }
    } catch (err) {
        console.warn('Food API Error:', err);
    }

    // 3. الحل البديل المحلي في حال فشل الـ API
    if (matchedCalories === null) {
        const estimates = {
            'برجر': 500, 'همبرجر': 500, 'شاورما': 450, 'بيتزا': 850, 'بطاطس': 300,
            'مقلية': 300, 'عصير': 150, 'برتقال': 110, 'تفاح': 95, 'شاي': 5,
            'قهوة': 15, 'بيبسي': 140, 'سفن': 140, 'كولا': 140, 'ماء': 0, 'مويه': 0,
            'مشويات': 450, 'كباب': 350, 'شيش': 300, 'فطائر': 350, 'دجاج': 400,
            'لحم': 500, 'سمك': 300, 'سلطة': 100, 'حلى': 400, 'كيك': 350
        };
        const nLow = name.toLowerCase();
        for (const [key, val] of Object.entries(estimates)) {
            if (nLow.includes(key)) {
                matchedCalories = val;
                break;
            }
        }
    }

    // استعادة الزر
    if (btn) {
        btn.innerHTML = btn.dataset.originalText || '✨ توقّع السعرات';
        btn.disabled = false;
    }

    if (matchedCalories === null) {
        matchedCalories = 250;
        showToast('تعذر جلب بيانات دقيقة، تم وضع متوسط افتراضي', 'info');
    } else {
        showToast('تم إيجاد السعرات بنجاح من قاعدة البيانات ✨', 'success');
    }

    const calInput = document.getElementById(caloriesInputId);
    if (calInput) {
        calInput.value = matchedCalories;
        calInput.style.backgroundColor = '#fffacd';
        setTimeout(() => calInput.style.backgroundColor = '', 500);
    }
}

export async function autoFillCategoryCalories(categoryId) {
    const products = state.products.filter(p => p.categoryId === categoryId);
    if (!products.length) {
        showToast('لا توجد أصناف في هذا القسم.', 'info');
        return;
    }

    const category = state.categories.find(c => c.id === categoryId);
    const catName = category ? category.name : '';

    let updatedCount = 0;
    showToast('جاري التوقع الذكي لسعرات أصناف القسم، يرجى الانتظار...', 'info', 4000);

    const productsToProcess = products.filter(p => !p.calories || p.calories <= 0);
    const chunkSize = 4; // معالجة 4 منتجات في نفس الوقت بدلاً من واحد واحد

    for (let i = 0; i < productsToProcess.length; i += chunkSize) {
        const chunk = productsToProcess.slice(i, i + chunkSize);

        await Promise.all(chunk.map(async (product) => {
            let matchedCalories = null;
            let searchName = catName ? catName + ' ' + product.name : product.name;
            let englishName = searchName;

            try {
                const transRes = await fetchWithTimeout(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(searchName)}&langpair=ar|en`, 3000);
                const transData = await transRes.json();
                if (transData && transData.responseData && transData.responseData.translatedText) {
                    englishName = transData.responseData.translatedText.toLowerCase();
                }

                const foodRes = await fetchWithTimeout(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(englishName)}&search_simple=1&action=process&json=1&page_size=3`, 4000);
                const foodData = await foodRes.json();

                if (foodData && foodData.products && foodData.products.length > 0) {
                    const productWithKcal = foodData.products.find(p => p.nutriments && p.nutriments['energy-kcal_100g']);
                    if (productWithKcal) {
                        const kcal100 = productWithKcal.nutriments['energy-kcal_100g'];
                        const kcalServing = productWithKcal.nutriments['energy-kcal_serving'];
                        if (kcalServing && kcalServing > 0) {
                            matchedCalories = Math.round(kcalServing);
                        } else {
                            matchedCalories = Math.round(kcal100 * 3);
                        }
                    }
                }
            } catch (err) { }

            if (matchedCalories === null) {
                const estimates = {
                    'برجر': 500, 'همبرجر': 500, 'شاورما': 450, 'بيتزا': 850, 'بطاطس': 300,
                    'مقلية': 300, 'عصير': 150, 'برتقال': 110, 'تفاح': 95, 'شاي': 5,
                    'قهوة': 15, 'بيبسي': 140, 'سفن': 140, 'كولا': 140, 'ماء': 0, 'مويه': 0,
                    'مشويات': 450, 'كباب': 350, 'شيش': 300, 'فطائر': 350, 'دجاج': 400,
                    'لحم': 500, 'سمك': 300, 'سلطة': 100, 'حلى': 400, 'كيك': 350
                };
                const nLow = product.name.toLowerCase();
                for (const [key, val] of Object.entries(estimates)) {
                    if (nLow.includes(key)) {
                        matchedCalories = val;
                        break;
                    }
                }
                if (matchedCalories === null) matchedCalories = 250;
            }

            product.calories = matchedCalories;
            updatedCount++;
        }));
    }

    if (updatedCount > 0) {
        saveData();
        renderProducts();
        showToast(`تم إضافة سعرات لـ ${updatedCount} صنف جديد بذكاء! ✨`, 'success');
    } else {
        showToast(`جميع أصناف القسم تملك قيماً مسبقة للسعرات أو استعصت.`, 'info');
    }
}

export async function removeCategoryCalories(categoryId) {
    const products = state.products.filter(p => p.categoryId === categoryId);
    if (!products.length) {
        showToast('لا توجد أصناف في هذا القسم.', 'info');
        return;
    }

    const confirmed = await customConfirm('هل أنت متأكد من مسح جميع السعرات الحرارية المسجلة لأصناف هذا القسم؟');
    if (!confirmed) return;

    let updatedCount = 0;
    products.forEach(product => {
        if (product.calories !== undefined) {
            delete product.calories;
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        saveData();
        renderProducts();
        showToast(`تم إزالة السعرات الحرارية لـ ${updatedCount} صنف. 🧹`, 'success');
    } else {
        showToast('لا توجد سعرات حرارية مسجلة لتفريغها في هذا القسم.', 'info');
    }
}

// ====== تبديل شارة "الأكثر مبيعاً" ======
export function toggleBestSeller(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    product.badge = product.badge === 'best' ? '' : 'best';
    saveData();
    renderProducts();
    renderAdminPanel();
    showToast(product.badge === 'best' ? '🔥 تم تعيين كأكثر مبيعاً' : 'تم إزالة شارة الأكثر مبيعاً', 'success');
}

// ====== إدارة الفروع ======
function setupBranchesTab() {
    renderBranchesList();

    const nameInput = document.getElementById('newBranchName');
    const idInput = document.getElementById('newBranchId');

    if (nameInput && idInput) {
        nameInput.addEventListener('input', (e) => {
            // السماح فقط بالحروف الإنجليزية، الأرقام، المسافات، والشرطات
            let val = e.target.value.replace(/[^a-zA-Z0-9\s-]/g, '');
            if (e.target.value !== val) {
                e.target.value = val;
            }
            // توليد المعرف تلقائياً (حروف صغيرة، مسافات تتحول لشرطات)
            idInput.value = val.trim().toLowerCase().replace(/\s+/g, '-');
        });
    }

    const addBtn = document.getElementById('addBranchBtn');
    if (addBtn) {
        addBtn.onclick = () => {
            const bId = document.getElementById('newBranchId').value.trim().toLowerCase();
            const bName = document.getElementById('newBranchName').value.trim();

            if (!bId || !bName) {
                showToast('يرجى إدخال معرف الفرع واسمه', 'error');
                return;
            }
            if (!/^[a-z0-9_-]+$/.test(bId)) {
                showToast('معرف الفرع يجب أن يحتوي على أحرف إنجليزية وأرقام فقط (بدون مسافات)', 'error');
                return;
            }
            if (bId === 'main') {
                showToast('لا يمكن استخدام main كمعرف فرع جديد', 'error');
                return;
            }
            get(branchesListRef).then(snapshot => {
                const branches = snapshot.val() || {};
                if (branches[bId]) {
                    showToast('هذا المعرف مستخدم مسبقاً', 'error');
                    return;
                }

                import('./firebase.js').then(({ ref, set, getFirebaseDatabase, rootSettingsRef, get }) => {
                    const db = getFirebaseDatabase();
                    get(rootSettingsRef).then(rootSnap => {
                        const rootSettings = rootSnap.val() || {};
                        const actualPassword = rootSettings.admin_password || getAdminKey();

                        // إضافة الفرع לקائمة الفروع وإرسال القائمة بالكامل مع مفتاح الأدمن
                        branches[bId] = { name: bName, id: bId };
                        branches.admin_key = actualPassword;

                        set(branchesListRef, branches).then(() => {
                            // إضافة إعدادات الفرع الجديد ليكون جاهزًا للعمل
                            const branchSettingsRef = ref(db, `branches/${bId}/settings`);
                            set(branchSettingsRef, { admin_key: actualPassword, admin_password: actualPassword }).then(() => {
                                showToast('تم إضافة الفرع بنجاح ✓', 'success');
                                document.getElementById('newBranchId').value = '';
                                document.getElementById('newBranchName').value = '';
                                window.location.href = `?branch=${bId}`;
                            }).catch(() => {
                                // انتقل للفرع في جميع الأحوال
                                window.location.href = `?branch=${bId}`;
                            });
                        }).catch(e => {
                            console.error("Add branch err:", e);
                            showToast('فشل في إضافة الفرع: ' + e.message, 'error');
                        });
                    });
                });
            });
        };
    }
}

function renderBranchesList() {
    const container = document.getElementById('branchesListContainer');
    if (!container) return;

    // إضافة الفرع الرئيسي كعنصر دائم لا يُحذف
    const baseUrl = window.location.origin + window.location.pathname;

    let html = `
        <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px; border-right: 4px solid var(--primary-orange); display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div>
                <strong style="font-size: 16px;">الفرع الرئيسي (الأساسي)</strong>
                <div style="font-size: 12px; color: #666; font-family: monospace; display: flex; align-items: center; gap: 6px; margin-top: 5px;">
                    <a href="${baseUrl}?branch=main" target="_blank" style="color:#0066cc;">${baseUrl}?branch=main</a>
                    <button class="add-btn" style="padding: 2px 8px; font-size: 10px;" onclick="navigator.clipboard.writeText('${baseUrl}?branch=main'); showToast('تم نسخ الرابط', 'info');">نسخ</button>
                    <button class="add-btn" style="padding: 2px 8px; font-size: 10px; background-color: #27ae60;" onclick="downloadBranchQR('${baseUrl}?branch=main', 'الفرع_الرئيسي')">تحميل باركود (QR)</button>
                </div>
            </div>
            ${currentBranchId === 'main' ? '<span style="background: #e8f5e9; color: #2e7d32; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">أنت تدير هذا الفرع الآن</span>' : `<button class="pay-btn" style="padding: 6px 15px;" onclick="window.location.href='${baseUrl}?branch=main'">إدارة هذا الفرع</button>`}
        </div>
    `;

    get(branchesListRef).then(snapshot => {
        const branches = snapshot.val() || {};
        const branchesArr = Object.values(branches).filter(b => b && typeof b === 'object' && b.id);

        if (branchesArr.length > 0) {
            branchesArr.forEach(b => {
                const link = `${baseUrl}?branch=${b.id}`;
                const isCurrent = currentBranchId === b.id;

                html += `
                <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 10px; border-right: 4px solid #6c5ce7; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <div>
                        <strong style="font-size: 16px;">${b.name} (${b.id})</strong>
                        <div style="font-size: 12px; color: #666; font-family: monospace; display: flex; align-items: center; gap: 6px; margin-top: 5px;">
                            <a href="${link}" target="_blank" style="color:#0066cc;">${link}</a>
                            <button class="add-btn" style="padding: 2px 8px; font-size: 10px;" onclick="navigator.clipboard.writeText('${link}'); showToast('تم نسخ الرابط', 'info');">نسخ</button>
                            <button class="add-btn" style="padding: 2px 8px; font-size: 10px; background-color: #27ae60;" onclick="downloadBranchQR('${link}', '${b.name}')">تحميل باركود (QR)</button>
                        </div>
                        ${currentBranchId === 'main' ? `
                            <label style="display:flex; align-items:center; gap:5px; margin-top:8px; font-size:12px; cursor:pointer;" title="إخفاء/إظهار زر الإعدادات لهذا الفرع">
                                <input type="checkbox" onchange="toggleBranchAdminBtn('${b.id}', this.checked)" ${b.disableAdminBtn ? 'checked' : ''}>
                                <span style="color:#e67e22; font-weight:bold;">تعطيل (إخفاء) زر الإعدادات للفرع</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:5px; margin-top:4px; font-size:12px; cursor:pointer;" title="إيقاف المنيو مؤقتاً للصيانة">
                                <input type="checkbox" onchange="toggleBranchMaintenance('${b.id}', this.checked)" ${b.maintenanceMode ? 'checked' : ''}>
                                <span style="color:#d35400; font-weight:bold;">وضع الصيانة (إيقاف عمل الفرع)</span>
                            </label>
                        ` : ''}
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button class="pay-btn" style="background: #0984e3; padding: 6px 10px;" onclick="editBranchName('${b.id}', '${b.name}')">✏️</button>
                        ${isCurrent ? '<span style="background: #e8f5e9; color: #2e7d32; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">أنت تدير هذا الفرع الآن</span>' : `<button class="pay-btn" style="padding: 6px 15px;" onclick="window.location.href='${link}'">إدارة هذا الفرع</button>`}
                        <button class="cancel-btn" style="padding: 6px 10px;" onclick="deleteBranch('${b.id}', '${b.name}')">🗑️</button>
                    </div>
                </div>
                `;
            });
        }
        container.innerHTML = html;
    });
}

window.deleteBranch = function (bId, bName) {
    if (bId === 'main') return;
    customConfirm(`أنت على وشك حذف قائمة منيو وإعدادات فرع "${bName}" نهائياً من قائمة الفروع. هل أنت متأكد من ذلك؟`).then(ok => {
        if (!ok) return;
        import('./firebase.js').then(({ get, set, branchesListRef }) => {
            get(branchesListRef).then(snapshot => {
                const branches = snapshot.val() || {};
                delete branches[bId];
                branches.admin_key = getAdminKey();
                set(branchesListRef, branches).then(() => {
                    showToast('تم حذف الفرع من القائمة', 'info');
                    renderBranchesList();
                }).catch(err => {
                    console.error("Delete branch err:", err);
                    showToast('فشل الحذف: ' + err.message, 'error');
                });
            });
        });
    });
};

window.editBranchName = function (bId, currentName) {
    import('./core.js').then(({ customPrompt, getAdminKey, showToast }) => {
        customPrompt(`تعديل اسم الفرع (اكتب بالانجليزي لتحديث الرابط فوراً):`, currentName).then(newName => {
            if (!newName || newName.trim() === currentName) return;
            const finalName = newName.trim();
            let newId = finalName.replace(/[^a-zA-Z0-9\s-]/g, '').trim().toLowerCase().replace(/\s+/g, '-');

            if (!newId) { showToast('الاسم يجب أن يحتوي على أحرف إنجليزية لإنشاء الرابط', 'error'); return; }

            if (newId === bId) {
                import('./firebase.js').then(({ get, set, branchesListRef }) => {
                    get(branchesListRef).then(snapshot => {
                        const branches = snapshot.val() || {};
                        if (branches[bId]) {
                            branches[bId].name = finalName;
                            branches.admin_key = getAdminKey();
                            set(branchesListRef, branches).then(() => {
                                showToast('تم تحديث اسم الفرع بنجاح', 'success');
                                renderBranchesList();
                            }).catch(e => showToast('فشل التحديث: ' + e.message, 'error'));
                        }
                    });
                });
            } else {
                if (newId === 'main') { showToast('لا يمكن استخدام main', 'error'); return; }
                import('./firebase.js').then(({ get, set, ref, getFirebaseDatabase, branchesListRef }) => {
                    get(branchesListRef).then(snapshot => {
                        const branches = snapshot.val() || {};
                        if (branches[newId]) { showToast('يوجد فرع يستخدم هذا الرابط مسبقاً', 'error'); return; }

                        const db = getFirebaseDatabase();
                        get(ref(db, `branches/${bId}`)).then(oldSnap => {
                            const oldData = oldSnap.val() || {};
                            oldData.admin_key = getAdminKey();

                            set(ref(db, `branches/${newId}`), oldData).then(() => {
                                branches[newId] = { name: finalName, id: newId };
                                delete branches[bId];
                                branches.admin_key = getAdminKey();
                                set(branchesListRef, branches).then(() => {
                                    set(ref(db, `branches/${bId}`), null);
                                    showToast('تم تحديث الرابط بنجاح ✓', 'success');
                                    renderBranchesList();
                                    import('./firebase.js').then(({ currentBranchId }) => {
                                        if (currentBranchId === bId) {
                                            setTimeout(() => window.location.href = `?branch=${newId}`, 1500);
                                        }
                                    });
                                }).catch(e => showToast('فشل تحديث القائمة: ' + e.message, 'error'));
                            }).catch(e => showToast('فشل نقل البيانات: ' + e.message, 'error'));
                        });
                    });
                });
            }
        });
    });
};

window.downloadBranchQR = function (link, branchName) {
    import('./core.js').then(({ showToast }) => {
        showToast('جاري تحضير الباركود...', 'info');
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=20&data=${encodeURIComponent(link)}`;
        fetch(qrUrl)
            .then(res => res.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `QR_${branchName.replace(/\s+/g, '_')}.png`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                showToast('تم تحميل الباركود بنجاح ✓', 'success');
            })
            .catch(err => {
                showToast('فشل التحميل التلقائي، سيتم فتح الصورة', 'error');
                window.open(qrUrl, '_blank');
            });
    });
};

window.toggleBranchMaintenance = function (bId, isMaintenance) {
    import('./firebase.js').then(({ fetchKVData, saveKVData, get, set, branchesListRef }) => {
        import('./core.js').then(async ({ getAdminKey, showToast, CLIENT }) => {
            try {
                // Update branch settings directly
                const customClientId = CLIENT.id + `-${bId}`;
                const branchData = await fetchKVData(customClientId) || {};
                branchData.settings = branchData.settings || {};
                branchData.settings.maintenanceMode = isMaintenance;
                branchData.settings.admin_key = getAdminKey();
                await saveKVData(branchData, customClientId);

                // Update branches list for UI display
                get(branchesListRef).then(snapshot => {
                    const branches = snapshot.val() || {};
                    if (branches[bId]) {
                        branches[bId].maintenanceMode = isMaintenance;
                        branches.admin_key = getAdminKey();
                        set(branchesListRef, branches).then(() => {
                            showToast(`تم ${isMaintenance ? 'تفعيل' : 'إلغاء'} وضع الصيانة للفرع بنجاح`, 'success');
                        }).catch(e => showToast('حدث خطأ أثناء تحديث القائمة', 'error'));
                    }
                });
            } catch (e) {
                console.error(e);
                showToast('حدث خطأ أثناء التحديث', 'error');
            }
        });
    });
};

window.toggleBranchAdminBtn = function (bId, checked) {
    import('./firebase.js').then(({ fetchKVData, saveKVData, get, set, branchesListRef }) => {
        import('./core.js').then(async ({ getAdminKey, showToast, CLIENT }) => {
            try {
                // Update branch settings directly
                const customClientId = CLIENT.id + `-${bId}`;
                const branchData = await fetchKVData(customClientId) || {};
                branchData.settings = branchData.settings || {};
                branchData.settings.disableAdminBtn = checked;
                branchData.settings.admin_key = getAdminKey();
                await saveKVData(branchData, customClientId);

                // Update branches list for UI display
                get(branchesListRef).then(snap => {
                    const branches = snap.val() || {};
                    if (branches[bId]) {
                        branches[bId].disableAdminBtn = checked;
                        branches.admin_key = getAdminKey();
                        set(branchesListRef, branches).then(() => {
                            showToast(`تم ${checked ? 'إخفاء' : 'إظهار'} زر الإعدادات لفرع ${bId} ✓`, 'success');
                        }).catch(e => showToast('فشل التعديل: ' + e.message, 'error'));
                    }
                });
            } catch (e) {
                console.error(e);
                showToast('حدث خطأ أثناء التحديث', 'error');
            }
        });
    });
};

// ====== نظام المزامنة الذكي للفروع ======
window.shouldSyncBranch = false;
function promptBranchSync(itemType, itemData, localSaveCallback) {
    if (!window.shouldSyncBranch) {
        localSaveCallback();
        return;
    }
    window.shouldSyncBranch = false; // Reset for next time

    import('./firebase.js').then(({ get, branchesListRef, getFirebaseDatabase, ref, set, currentBranchId }) => {
        get(branchesListRef).then(snapshot => {
            const allBranches = snapshot.val() || {};
            const availableBranches = Object.values(allBranches).filter(b => typeof b === 'object' && b.id && b.id !== currentBranchId);

            // إضافة الفرع الرئيسي كخيار إذا لم نكن فيه
            if (currentBranchId !== 'main') {
                availableBranches.unshift({ id: 'main', name: 'الفرع الرئيسي' });
            }

            if (availableBranches.length === 0) {
                // لا يوجد فروع أخرى
                localSaveCallback();
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'custom-modal-overlay';
            // Start visible smoothly
            setTimeout(() => overlay.classList.add('active'), 50);

            let branchesHtml = availableBranches.map(b => `
                <label style="display:flex; align-items:center; gap:10px; padding:10px; background:#f9f9f9; border-radius:8px; margin-bottom:5px; border:1px solid #ddd; cursor:pointer;">
                    <input type="checkbox" class="sync-branch-cb" value="${b.id}" style="width:18px;height:18px;">
                    <span style="font-size:14px; font-weight:bold;">${b.name} (${b.id})</span>
                </label>
            `).join('');

            overlay.innerHTML = `
                <div class="custom-modal" style="max-width:400px; text-align:right;">
                    <h3 style="margin-bottom:15px; color:#2c3e50;">🌍 تطبيق التعديلات</h3>
                    <p style="font-size:14px; color:#666; margin-bottom:15px;">أين ترغب في تطبيق التعديل على (${itemType === 'all-items' ? 'جميع الأقسام والمنتجات' : itemType === 'design' ? 'التصميم بالكامل' : itemType === 'product' ? 'المنتج' : 'القسم'})؟</p>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom:10px; font-weight:bold;"><input type="radio" name="syncTarget" value="current" checked> فقط الفرع الحالي</label>
                        <label style="display:block; margin-bottom:10px; font-weight:bold;"><input type="radio" name="syncTarget" value="all"> كل الفروع</label>
                        <label style="display:block; margin-bottom:10px; font-weight:bold;"><input type="radio" name="syncTarget" value="custom"> فروع محددة...</label>
                    </div>

                    <div id="syncBranchesListWrap" style="display:none; max-height:200px; overflow-y:auto; margin-bottom:15px; border-top:1px solid #eee; padding-top:10px;">
                         <button id="syncSelectAllBtn" style="background:#0984e3; color:white; border:none; padding:5px 10px; border-radius:5px; margin-bottom:10px; font-size:12px; cursor:pointer;">تحديد الكل</button>
                         ${branchesHtml}
                    </div>

                    <div style="display:flex; gap:10px;">
                        <button class="add-btn sync-confirm" style="flex:2; background:#2ecc71;">حفظ وتطبيق</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const radios = overlay.querySelectorAll('input[name="syncTarget"]');
            const wrap = document.getElementById('syncBranchesListWrap');
            const cbs = overlay.querySelectorAll('.sync-branch-cb');

            radios.forEach(r => r.addEventListener('change', (e) => {
                wrap.style.display = e.target.value === 'custom' ? 'block' : 'none';
            }));

            document.getElementById('syncSelectAllBtn').addEventListener('click', () => {
                const allChecked = Array.from(cbs).every(cb => cb.checked);
                cbs.forEach(cb => cb.checked = !allChecked);
            });

            overlay.querySelector('.sync-confirm').addEventListener('click', () => {
                const selectedMode = overlay.querySelector('input[name="syncTarget"]:checked').value;
                let targetRefs = [];

                if (selectedMode === 'all') {
                    targetRefs = availableBranches.map(b => b.id);
                } else if (selectedMode === 'custom') {
                    targetRefs = Array.from(cbs).filter(cb => cb.checked).map(cb => cb.value);
                }

                if (selectedMode === 'custom' && targetRefs.length === 0) {
                    import('./core.js').then(({ showToast }) => showToast('يرجى تحديد فرع واحد على الأقل', 'error'));
                    return;
                }

                // الحفظ للفرع الحالي
                localSaveCallback();

                overlay.classList.remove('active');
                setTimeout(() => overlay.remove(), 300);

                // التوزيع للفروع الأخرى بـ صمت (Background sync)
                if (targetRefs.length > 0) {
                    import('./core.js').then(({ showToast, getAdminKey, CLIENT }) => {
                        import('./firebase.js').then(async ({ fetchKVData, saveKVData }) => {
                            showToast(`جارٍ تحديث ${targetRefs.length} فروع...`, 'info');

                            for (const tBranch of targetRefs) {
                                const customClientId = CLIENT.id + (tBranch === 'main' ? '' : `-${tBranch}`);
                                try {
                                    const branchData = await fetchKVData(customClientId) || {};

                                    if (itemType === 'all-items') {
                                        const cObj = {};
                                        itemData.categories.forEach((c, i) => cObj[i] = c);
                                        cObj.admin_key = getAdminKey();
                                        branchData.categories = cObj;

                                        const pObj = {};
                                        itemData.products.forEach((p, i) => pObj[i] = p);
                                        pObj.admin_key = getAdminKey();
                                        branchData.products = pObj;
                                    } else if (itemType === 'design') {
                                        branchData.settings = branchData.settings || {};
                                        branchData.settings.design = itemData.design || null;
                                        branchData.settings.appFont = itemData.appFont || 'default';
                                        branchData.settings.viewMode = itemData.viewMode || 'grid';
                                        branchData.settings.admin_key = getAdminKey();
                                    } else {
                                        const listKey = itemType === 'product' ? 'products' : 'categories';
                                        let list = branchData[listKey] || [];
                                        if (!Array.isArray(list)) list = Object.values(list).filter(v => typeof v === 'object' && v.id);

                                        const idx = list.findIndex(x => x && x.id === itemData.id);
                                        if (idx !== -1) {
                                            list[idx] = itemData; // تحديث
                                        } else {
                                            list.push(itemData); // إضافة
                                        }

                                        const updatedObj = {};
                                        list.forEach((itm, i) => { if (itm) updatedObj[i] = itm; });
                                        updatedObj.admin_key = getAdminKey();
                                        branchData[listKey] = updatedObj;
                                    }

                                    await saveKVData(branchData, customClientId);
                                } catch (err) {
                                    console.error("Sync error for branch", tBranch, err);
                                }
                            }

                            setTimeout(() => showToast('تمت المزامنة بنجاح ✓', 'success'), 2000);
                        });
                    });
                }
            });
        });
    });
}
export function syncAllItemsToBranches() {
    window.shouldSyncBranch = true;
    promptBranchSync('all-items', { categories: state.categories, products: state.products }, () => {
        import('./core.js').then(({ showToast }) => showToast('انتهت العملية', 'info'));
    });
}
export function syncDesignToBranches() {
    window.shouldSyncBranch = true;
    promptBranchSync('design', { design: state.design, appFont: state.appFont, viewMode: state.viewMode }, () => {
        import('./core.js').then(({ showToast }) => showToast('انتهت العملية', 'info'));
    });
}
