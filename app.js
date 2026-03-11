/**
 * app.js - نقطة الدخول الرئيسية
 * Slim entry point - imports all modules and wires them together
 */

// ====== استيراد الوحدات ======
import { state, showToast, CLIENT } from './js/core.js';
import {
    loadDataFromServer, setDataChangeHandler, saveData, saveSettings,
    refreshAllData, currentBranchId
} from './js/firebase.js';
import { openCartModal, closeCartModal, setupCartDelegation } from './js/cart.js';
import {
    renderCategories, renderProducts, openProductModal, closeProductModal,
    setupViewToggle, setupScrollToTop, updateUIMessages
} from './js/renderer.js';
import { printInvoice, calculateTotal } from './js/printing.js';
import { initShifts, openShiftsMenu, addSaleToShift, shiftsState } from './js/shifts.js';
import {
    openAdminModal, closeAdminModal, showAdminPanelUI,
    openAdminForm, closeAdminForm, saveAdminForm,
    changeAdminPassword, exportData, handleImportData, resetInvoiceCounter,
    copySizes, pasteSizesIntoEdit, pasteSizesIntoAdminForm,
    copyCategory, pasteCategory,
    addNewSize, addNewType, addNewTypeGroup,
    openEditProductModal, closeEditProductModal, saveEditedProduct,
    setupAdminDelegation, renderAdminPanel,
    editCategory, editProduct,
    toggleCategoryAvailability, toggleProductAvailability,
    copyCategoryById, pasteCategoryInto,
    deleteCategory, deleteProduct,
    addSizeToProduct, editSize, deleteSize,
    toggleBestSeller, syncAllItemsToBranches, syncDesignToBranches,
    autoFillCalories, autoFillCategoryCalories, removeCategoryCalories
} from './js/admin.js';
import { initAuth, handleOnlineCheckout, processMoyasarPayment } from './js/auth-payment.js';

// ====== ربط Firebase بالعرض ======
function applyUISettings() {
    // إخفاء زر السلة إذا كان معطلاً
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
        cartBtn.style.display = state.disableCart ? 'none' : '';
    }
    // إخفاء زر الورديات إذا كان معطلاً
    const shiftsBtn = document.getElementById('shiftsBtn');
    const shiftsIndicator = document.getElementById('shiftStatusIndicator');
    if (shiftsBtn) {
        shiftsBtn.style.display = state.disableShifts ? 'none' : '';
    }
    if (shiftsIndicator) {
        shiftsIndicator.style.display = state.disableShifts ? 'none' : 'flex';
    }
    // إخفاء زر الإعدادات
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
        if (currentBranchId === 'main') {
            adminBtn.style.display = 'inline-block'; // لا نخفيه للفرع الرئيسي أبداً
        } else {
            adminBtn.style.display = state.disableAdminBtn ? 'none' : 'inline-block';
        }
    }

    // وضع الصيانة
    let mainContent = document.getElementById('productsContainer');
    let maintenanceMask = document.getElementById('maintenanceMask');

    if (state.maintenanceMode && currentBranchId !== 'main') {
        if (!maintenanceMask) {
            maintenanceMask = document.createElement('div');
            maintenanceMask.id = 'maintenanceMask';
            maintenanceMask.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255, 255, 255, 0.95); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:20px; color:#333; backdrop-filter:blur(5px);';
            maintenanceMask.innerHTML = `
                <div style="font-size:80px; margin-bottom:20px;">🚧</div>
                <h1 style="color:#d35400; margin-bottom:15px; font-size:28px;">هذا الفرع في وضع الصيانة مؤقتاً</h1>
                <p style="font-size:18px; color:#666; max-width:400px;">نأسف، لا نستقبل الطلبات من هذا الفرع في الوقت الحالي. يرجى المحاولة في وقت لاحق.</p>
                <div style="margin-top:30px; font-weight:bold;">${CLIENT.name}</div>
            `;
            document.body.appendChild(maintenanceMask);
        }
        maintenanceMask.style.display = 'flex';
        if (mainContent) mainContent.style.visibility = 'hidden';
    } else {
        if (maintenanceMask) maintenanceMask.style.display = 'none';
        if (mainContent) mainContent.style.visibility = 'visible';
    }
}

setDataChangeHandler(() => {
    renderCategories();
    renderProducts();
    applyUISettings(); // تطبيق إعدادات الواجهة
});

// ====== ربط saveSettings لـ renderer.js (view toggle) ======
window._saveSettings = saveSettings;

// ====== ربط الأحداث ======
function setupEventListeners() {
    // Cart
    document.getElementById('cartBtn').addEventListener('click', openCartModal);
    document.getElementById('closeCart').addEventListener('click', closeCartModal);
    document.getElementById('payBtn').addEventListener('click', async () => {
        if (state.cart.length === 0) return;
        const total = calculateTotal(state.cart);

        // Check if online payment is enabled for customers
        if (state.enableOnlinePayment && CLIENT.moyasarPublishableKey) {
            handleOnlineCheckout(total, state.cart, () => {
                // Callback proceed to moyasar ui
                closeCartModal();
                processMoyasarPayment(total, state.cart, () => {
                    // Success callback
                    state.cart = [];
                    // reset cart display
                    const b = document.getElementById('cartCount');
                    if (b) b.textContent = '0';
                    const payBtn = document.getElementById('payBtn');
                    if (payBtn) payBtn.disabled = false;
                });
            });
            return;
        }

        // Traditional checkout (cashier printing/shifts)
        if (!state.disableShifts) {
            const currentShift = window._shiftsState ? window._shiftsState.currentShift : null;
            if (!currentShift) {
                showToast('⚠️ يجب الدخول إلى وردية أولاً لتسجيل المبيعات', 'error');
                if (typeof openShiftsMenu === 'function') openShiftsMenu();
                return;
            }
            // تسجيل المبيعات في الوردية قبل الطباعة
            await addSaleToShift(total);
        }

        printInvoice();
    });

    // Product Modal
    document.getElementById('closeModal').addEventListener('click', closeProductModal);

    // Admin
    document.getElementById('adminBtn').addEventListener('click', openAdminModal);



    document.getElementById('closeAdmin').addEventListener('click', closeAdminModal);
    document.getElementById('exportDataBtn').addEventListener('click', exportData);

    const importDataBtn = document.getElementById('importDataBtn');
    const importDataFile = document.getElementById('importDataFile');
    if (importDataBtn && importDataFile) {
        importDataBtn.addEventListener('click', () => importDataFile.click());
        importDataFile.addEventListener('change', handleImportData);
    }

    document.getElementById('resetInvoiceCounterBtn').addEventListener('click', resetInvoiceCounter);
    document.getElementById('addCategoryBtn').addEventListener('click', () => openAdminForm('category-add'));
    document.getElementById('addProductBtn').addEventListener('click', () => openAdminForm('product-add'));

    const copyCategoryBtn = document.getElementById('copyCategoryBtn');
    if (copyCategoryBtn) copyCategoryBtn.addEventListener('click', copyCategory);
    const pasteCategoryBtn = document.getElementById('pasteCategoryBtn');
    if (pasteCategoryBtn) pasteCategoryBtn.addEventListener('click', pasteCategory);

    const syncAllItemsBtn = document.getElementById('syncAllItemsBtn');
    if (syncAllItemsBtn) syncAllItemsBtn.addEventListener('click', syncAllItemsToBranches);

    const syncDesignBtn = document.getElementById('syncDesignBtn');
    if (syncDesignBtn) syncDesignBtn.addEventListener('click', syncDesignToBranches);

    const changeAdminPasswordBtn = document.getElementById('changeAdminPasswordBtn');
    if (changeAdminPasswordBtn) changeAdminPasswordBtn.addEventListener('click', changeAdminPassword);

    // Refresh Button (#5 - يحدث الأصناف والأقسام والإعدادات)
    document.getElementById('refreshBtn').addEventListener('click', function () {
        const btn = this;
        btn.classList.add('spinning');
        // مسح الكاش
        if ('caches' in window) {
            caches.keys().then(names => { names.forEach(name => caches.delete(name)); });
        }
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => { regs.forEach(r => r.unregister()); });
        }
        // تحديث البيانات والإعدادات معاً (#5)
        refreshAllData().then(() => {
            renderCategories();
            renderProducts();
            btn.classList.remove('spinning');
            showToast('تم التحديث بنجاح ✓', 'success');
        }).catch(() => {
            btn.classList.remove('spinning');
            location.reload(true);
        });
    });

    // Shifts Button
    const shiftsBtn = document.getElementById('shiftsBtn');
    if (shiftsBtn) shiftsBtn.addEventListener('click', openShiftsMenu);

    // Edit Product Modal
    document.getElementById('closeEditProduct').addEventListener('click', closeEditProductModal);
    const backEditProduct = document.getElementById('backEditProduct');
    if (backEditProduct) backEditProduct.addEventListener('click', closeEditProductModal);
    document.getElementById('cancelEditProduct').addEventListener('click', closeEditProductModal);
    document.getElementById('editProductForm').addEventListener('submit', saveEditedProduct);

    // Sync Button for Product
    const syncProductBtn = document.getElementById('syncProductBtn');
    if (syncProductBtn) {
        syncProductBtn.addEventListener('click', function (e) {
            e.preventDefault();
            window.shouldSyncBranch = true;
            try { saveEditedProduct(new Event('submit')); } catch (err) { console.error(err); }
        });
    }
    const copyBtn = document.getElementById('copySizesBtn');
    if (copyBtn) copyBtn.addEventListener('click', copySizes);
    const pasteBtn = document.getElementById('pasteSizesBtn');
    if (pasteBtn) pasteBtn.addEventListener('click', pasteSizesIntoEdit);
    const pasteAdminBtn = document.getElementById('pasteSizesAdminBtn');
    if (pasteAdminBtn) pasteAdminBtn.addEventListener('click', pasteSizesIntoAdminForm);
    document.getElementById('addSizeBtn').addEventListener('click', addNewSize);
    document.getElementById('addTypeBtn').addEventListener('click', addNewType);
    document.getElementById('addTypeGroupBtn').addEventListener('click', addNewTypeGroup);

    // Magic Calories
    const magicCaloriesBtn = document.getElementById('magicCaloriesBtn');
    if (magicCaloriesBtn) magicCaloriesBtn.addEventListener('click', () => autoFillCalories('productName', 'productCalories', 'productCategory'));
    const adminMagicCaloriesBtn = document.getElementById('adminMagicCaloriesBtn');
    if (adminMagicCaloriesBtn) adminMagicCaloriesBtn.addEventListener('click', () => autoFillCalories('adminItemName', 'adminItemCalories', 'adminProductCategory'));

    const btnFillCatCalories = document.getElementById('btnFillCatCalories');
    if (btnFillCatCalories) btnFillCatCalories.addEventListener('click', () => { if (window._state && window._state.editingCategoryId) autoFillCategoryCalories(window._state.editingCategoryId); else autoFillCategoryCalories(state.editingCategoryId); });
    const btnRemoveCatCalories = document.getElementById('btnRemoveCatCalories');
    if (btnRemoveCatCalories) btnRemoveCatCalories.addEventListener('click', () => { if (window._state && window._state.editingCategoryId) removeCategoryCalories(window._state.editingCategoryId); else removeCategoryCalories(state.editingCategoryId); });

    // Admin Form Modal
    document.getElementById('closeAdminForm').addEventListener('click', closeAdminForm);
    const backAdminForm = document.getElementById('backAdminForm');
    if (backAdminForm) backAdminForm.addEventListener('click', closeAdminForm);
    document.getElementById('cancelAdminForm').addEventListener('click', closeAdminForm);
    document.getElementById('adminForm').addEventListener('submit', saveAdminForm);

    // Sync Button for Category
    const syncCategoryBtn = document.getElementById('syncCategoryBtn');
    if (syncCategoryBtn) {
        syncCategoryBtn.addEventListener('click', function (e) {
            e.preventDefault();
            window.shouldSyncBranch = true;
            try { saveAdminForm(new Event('submit')); } catch (err) { console.error(err); }
        });
    }
    const saveAdminBtn = document.getElementById('saveAdminForm');
    if (saveAdminBtn) {
        saveAdminBtn.addEventListener('click', function (e) {
            e.preventDefault();
            try { saveAdminForm(new Event('submit')); } catch (err) { console.error(err); }
        });
    }

    // Close modals on outside click
    document.getElementById('productModal').addEventListener('click', function (e) { if (e.target === this) closeProductModal(); });
    document.getElementById('cartModal').addEventListener('click', function (e) { if (e.target === this) closeCartModal(); });
    document.getElementById('adminModal').addEventListener('click', function (e) { if (e.target === this) closeAdminModal(); });
    document.getElementById('adminFormModal').addEventListener('click', function (e) { if (e.target === this) closeAdminForm(); });
}

// ====== مراقبة تغيير اللغة ======
const originalUpdateSystemMessages = window.updateSystemMessages;
window.updateSystemMessages = function (lang) {
    if (originalUpdateSystemMessages) originalUpdateSystemMessages(lang);
    updateUIMessages(lang);
};

// ====== تشغيل التطبيق ======
function _startApp() {
    try {
        console.log('[APP] Starting app...');
        setupEventListeners();
        setupCartDelegation();
        setupAdminDelegation();
        setupViewToggle();
        setupScrollToTop();
        loadDataFromServer();
        // تهيئة نظام الورديات
        setTimeout(() => {
            if (!state.disableShifts) {
                initShifts();
                const b = document.getElementById('shiftsBtn');
                if (b) b.style.display = '';
            } else {
                const b = document.getElementById('shiftsBtn');
                if (b) b.style.display = 'none';
            }
            // تعريض shiftsState على window لـ printing.js
            window._shiftsState = shiftsState;
        }, 1500);

        // تهيئة المصادقة والدفع
        initAuth();

        console.log('[APP] App started successfully');
    } catch (err) {
        console.error('[APP] Error in _startApp:', err);
        document.title = 'ERROR: ' + err.message;
        const c = document.getElementById('productsContainer');
        if (c) c.innerHTML = '<p style="color:red;padding:20px;font-size:18px;">خطأ: ' + err.message + '</p>';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _startApp);
} else {
    _startApp();
}

// ====== تصدير للنافذة العامة (للتوافق مع onclick في HTML) ======
if (typeof window !== 'undefined') {
    window.renderAdminPanel = renderAdminPanel;
    window.editCategory = editCategory;
    window.toggleCategoryAvailability = toggleCategoryAvailability;
    window.copyCategoryById = copyCategoryById;
    window.pasteCategoryInto = pasteCategoryInto;
    window.deleteCategory = deleteCategory;
    window.editSize = editSize;
    window.deleteSize = deleteSize;
    window.editProduct = editProduct;
    window.addSizeToProduct = addSizeToProduct;
    window.toggleProductAvailability = toggleProductAvailability;
    window.deleteProduct = deleteProduct;
    window.toggleBestSeller = toggleBestSeller;
    window.openAdminForm = openAdminForm;
    window.openEditProductModal = openEditProductModal;
    window.renderProducts = renderProducts;
    window.renderCategories = renderCategories;
    window.saveData = saveData;
    window.saveSettings = saveSettings;
    window.exportData = exportData;
    window.resetInvoiceCounter = resetInvoiceCounter;
    window.openAdminModal = openAdminModal;
    window.closeAdminModal = closeAdminModal;
    window.copyCategory = copyCategory;
    window.pasteCategory = pasteCategory;
    window.copySizes = copySizes;
    window.pasteSizesIntoEdit = pasteSizesIntoEdit;
    window.pasteSizesIntoAdminForm = pasteSizesIntoAdminForm;
    window.addNewSize = addNewSize;
    window.addNewType = addNewType;
    window.openCartModal = openCartModal;
    window.closeCartModal = closeCartModal;
    window.openProductModal = openProductModal;
    window.closeProductModal = closeProductModal;
    window.openShiftsMenu = openShiftsMenu;
}
