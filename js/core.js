/**
 * js/core.js - الحالة المشتركة، الأدوات المساعدة، النوافذ المخصصة، إدارة الخطوط
 */
import { CLIENT } from '../config.js';

// ====== الحالة المشتركة للتطبيق ======
export const state = {
    // البيانات
    cart: [],
    categories: [],
    products: [],

    // حالة واجهة المستخدم
    selectedCategory: null,
    currentProductQuantity: 1,
    currentProductSize: null,
    currentProductType: null,
    currentProductTypeGroups: {},
    currentSizeQuantities: {},
    viewMode: 'grid',

    // حالة الإدارة
    editingProductId: null,
    editingCategoryId: null,
    adminFormMode: null,
    adminAuthenticated: false,
    adminSizesClipboardUsed: false,

    // الإعدادات
    splitInvoice: false,
    printMethod: 'image',
    invoiceCounter: 0,
    appFont: 'default',
    disableCart: false,
    disableBestSellers: false,
    disableShifts: false,
    disableAdminBtn: false,
    disableRefreshBtn: false,
    simulatePayment: false,

    // إعدادات التصميم المتقدمة
    design: {
        borderRadius: '15',
        categoryCardShape: '50%', // 50%, 15px, 0px
        productCardRatio: '1/1',
        gridColumnsMobile: '2',
        shadowIntensity: '0.1',
        headerBlur: '10',
        logoUrl: 'images/logo.jpg',
        logoSize: '100',
        primaryColor: '#f26d21',
        backgroundColor: '#fff2e8',
        textColor: '#4a2c1a',
        accentColor: '#2ecc71',
        cardHoverEffect: 'translate', // translate, scale, glow
        fontSizeScale: '100',
        caloriesScale: '100',
        caloriesPosX: '0',
        caloriesPosY: '0',
        buttonStyle: 'filled', // filled, outline, soft

        // المزايا الإضافية
        backgroundPattern: 'none',
        pricePosition: 'bottom', // bottom, top, button
        imageBorderWidth: '0',
        fontWeight: 'normal', // normal, bold
        badgeColorNew: '#2ecc71',
        badgeColorBest: '#ff4500',
        cartIconStyle: 'default', // default, bag, basket
        cartBadgeColor: '#ff0000',
        darkMode: false,
        backgroundGradient: 'none',
        pageTransition: 'fade', // fade, slide, scale
        loadingSpinner: 'circle', // circle, dots, none
        footerText: '',
        customCSS: '',
    },

    // الحافظة
    sizesClipboard: null,
    categoryClipboard: null,
    typeSpecificSizesClipboard: null,

    // حالة Firebase
    _suppressFirebaseSync: false,
};

// ====== قائمة الخطوط ======
export const availableFonts = [
    { id: 'default', name: 'الافتراضي (Segoe UI)', family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", url: null },
    { id: 'cairo', name: 'Cairo', family: "'Cairo', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap' },
    { id: 'tajawal', name: 'Tajawal', family: "'Tajawal', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap' },
    { id: 'almarai', name: 'Almarai', family: "'Almarai', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700&display=swap' },
    { id: 'ibm-plex', name: 'IBM Plex Sans Arabic', family: "'IBM Plex Sans Arabic', sans-serif", url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap' },
    { id: 'noto-kufi', name: 'Noto Kufi Arabic', family: "'Noto Kufi Arabic', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@300;400;600;700&display=swap' },
    { id: 'readex', name: 'Readex Pro', family: "'Readex Pro', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap' },
    { id: 'changa', name: 'Changa', family: "'Changa', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Changa:wght@300;400;500;600;700&display=swap' },
    { id: 'rubik', name: 'Rubik', family: "'Rubik', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&display=swap' },
    { id: 'noto-sans', name: 'Noto Sans (متعدد اللغات)', family: "'Noto Sans', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600;700&display=swap' }
];

// ====== إدارة الخطوط ======
export function applyFont(fontId) {
    const font = availableFonts.find(f => f.id === fontId) || availableFonts[0];
    if (font.url) {
        const existingLink = document.getElementById('app-font-link');
        if (existingLink) existingLink.remove();
        const link = document.createElement('link');
        link.id = 'app-font-link';
        link.rel = 'stylesheet';
        link.href = font.url;
        document.head.appendChild(link);
    } else {
        const existingLink = document.getElementById('app-font-link');
        if (existingLink) existingLink.remove();
    }
    document.body.style.fontFamily = font.family;
    state.appFont = fontId;
}

// ====== تطبيق إعدادات التصميم المتقدمة ======
export function applyDesign(design) {
    if (!design) return;
    const root = document.documentElement;

    // الهوية البصرية
    if (design.primaryColor) root.style.setProperty('--primary-orange', design.primaryColor);
    if (design.backgroundColor) root.style.setProperty('--light-peach', design.backgroundColor);
    if (design.textColor) root.style.setProperty('--dark-chocolate', design.textColor);
    if (design.accentColor) root.style.setProperty('--emerald-green', design.accentColor);

    // الأبعاد والأحجام
    if (design.borderRadius) root.style.setProperty('--border-radius', design.borderRadius + 'px');
    if (design.logoSize) root.style.setProperty('--logo-size', design.logoSize + 'px');
    if (design.logoUrl) {
        const logoEl = document.getElementById('headerLogo');
        if (logoEl) logoEl.src = design.logoUrl;
    }
    if (design.shadowIntensity) root.style.setProperty('--card-shadow', `rgba(0,0,0,${design.shadowIntensity})`);
    if (design.headerBlur) root.style.setProperty('--header-blur', design.headerBlur + 'px');

    // الخطوط
    if (design.fontSizeScale) root.style.setProperty('--font-scale', design.fontSizeScale + '%');
    if (design.caloriesScale) root.style.setProperty('--calories-scale', design.caloriesScale / 100);
    if (design.caloriesPosX !== undefined) root.style.setProperty('--calories-x', design.caloriesPosX + 'px');
    if (design.caloriesPosY !== undefined) root.style.setProperty('--calories-y', design.caloriesPosY + 'px');

    // التنسيق (Layout)
    if (design.categoryCardShape) root.style.setProperty('--category-card-radius', design.categoryCardShape);
    if (design.gridColumnsMobile) root.style.setProperty('--grid-columns-mobile', design.gridColumnsMobile);

    // تأثير التفاعل (Hover)
    if (design.cardHoverEffect) {
        if (design.cardHoverEffect === 'translate') {
            root.style.setProperty('--hover-transform', 'translateY(-10px)');
            root.style.setProperty('--hover-shadow', '0 15px 35px var(--card-shadow)');
        } else if (design.cardHoverEffect === 'scale') {
            root.style.setProperty('--hover-transform', 'scale(1.05)');
            root.style.setProperty('--hover-shadow', '0 10px 25px var(--card-shadow)');
        } else if (design.cardHoverEffect === 'glow') {
            root.style.setProperty('--hover-transform', 'none');
            root.style.setProperty('--hover-shadow', '0 0 25px var(--primary-orange)');
        }
    }

    // إعدادات إضافية
    if (design.backgroundPattern) root.style.setProperty('--bg-pattern', design.backgroundPattern);
    if (design.imageBorderWidth) root.style.setProperty('--image-border-width', design.imageBorderWidth + 'px');
    if (design.fontWeight) root.style.setProperty('--global-font-weight', design.fontWeight);
    if (design.badgeColorNew) root.style.setProperty('--badge-new-color', design.badgeColorNew);
    if (design.badgeColorBest) root.style.setProperty('--badge-best-color', design.badgeColorBest);
    if (design.cartBadgeColor) root.style.setProperty('--cart-badge-color', design.cartBadgeColor);
    if (design.backgroundGradient) root.style.setProperty('--bg-gradient', design.backgroundGradient);

    // Custom CSS
    if (design.customCSS !== undefined) {
        let styleTag = document.getElementById('admin-custom-css');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'admin-custom-css';
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = design.customCSS;
    }

    // الوضع الليلي و الأنماط الإضافية
    if (design.darkMode !== undefined) {
        if (design.darkMode) document.body.classList.add('dark-mode');
        else document.body.classList.remove('dark-mode');
    }

    if (design.buttonStyle) document.body.setAttribute('data-button-style', design.buttonStyle);
    if (design.pricePosition) document.body.setAttribute('data-price-position', design.pricePosition);
    if (design.cartIconStyle) document.body.setAttribute('data-cart-icon', design.cartIconStyle);
    if (design.pageTransition) document.body.setAttribute('data-page-transition', design.pageTransition);
    if (design.loadingSpinner) document.body.setAttribute('data-loading-spinner', design.loadingSpinner);

    const footerEl = document.getElementById('siteFooter');
    if (footerEl) {
        footerEl.textContent = design.footerText !== undefined ? design.footerText : '';
    }

    // تغيير أيقونة السلة في زر الكاشير
    const cartIconEl = document.querySelector('.cart-icon');
    if (cartIconEl) {
        if (design.cartIconStyle === 'bag') cartIconEl.textContent = '🛍️';
        else if (design.cartIconStyle === 'basket') cartIconEl.textContent = '🧺';
        else cartIconEl.textContent = '🛒';
    }

    // تحديث الحالة
    state.design = { ...state.design, ...design };
}

// ====== مفتاح الإدارة (الجلسة) ======
export function getAdminKey() {
    return sessionStorage.getItem('adminKey');
}

export function setAdminKey(key) {
    if (key) {
        sessionStorage.setItem('adminKey', key);
    } else {
        sessionStorage.removeItem('adminKey');
    }
}

// ====== التنسيق ======
export function formatNumber(value) {
    return value.toString();
}

export function formatPrice(value) {
    return `${formatNumber(value)} ريال`;
}

// ====== إشعارات Toast ======
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ====== البيانات الافتراضية ======
export function createDefaultData() {
    state.categories = [
        { id: 1, name: 'بيتزا', image: 'images/بيبروني.jpg' },
        { id: 2, name: 'الشورما', image: 'images/شورما.jpg' },
        { id: 3, name: 'عصائر', image: 'images/عصائر.jpg' }
    ];
    state.products = [
        { id: 1, name: 'بيبروني', categoryId: 1, image: 'images/بيبروني.jpg', basePrice: 35, sizes: [{ name: 'صغير', price: 35 }, { name: 'وسط', price: 50 }, { name: 'كبير', price: 65 }], types: ['حراق', 'عادي'] },
        { id: 2, name: 'عربي', categoryId: 2, image: 'images/عربي.jpg', basePrice: 12, sizes: [{ name: 'صغير', price: 12 }, { name: 'كبير', price: 18 }], types: ['حراق', 'عادي'] },
        { id: 3, name: 'برتقال', categoryId: 3, image: 'images/برتقال.jpg', basePrice: 15, sizes: [{ name: 'صغير', price: 15 }, { name: 'كبير', price: 20 }] }
    ];
}

// ====== نوافذ مخصصة (بديل prompt و confirm) ======
export function customConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        overlay.innerHTML = `
            <div class="custom-modal">
                <div class="custom-modal-icon">⚠️</div>
                <p class="custom-modal-message">${message}</p>
                <div class="custom-modal-buttons">
                    <button class="custom-modal-btn custom-modal-confirm">تأكيد</button>
                    <button class="custom-modal-btn custom-modal-cancel">إلغاء</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));

        const close = (result) => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
            resolve(result);
        };

        overlay.querySelector('.custom-modal-confirm').addEventListener('click', () => close(true));
        overlay.querySelector('.custom-modal-cancel').addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    });
}

export function customPrompt(message, defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        overlay.innerHTML = `
            <div class="custom-modal">
                <p class="custom-modal-message">${message}</p>
                <input type="text" class="custom-modal-input" value="${defaultValue}" autocomplete="off">
                <div class="custom-modal-buttons">
                    <button class="custom-modal-btn custom-modal-confirm">تأكيد</button>
                    <button class="custom-modal-btn custom-modal-cancel">إلغاء</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));
        const input = overlay.querySelector('.custom-modal-input');
        setTimeout(() => input.focus(), 100);

        const confirm = () => {
            const value = input.value;
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
            resolve(value);
        };
        const cancel = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
            resolve(null);
        };

        overlay.querySelector('.custom-modal-confirm').addEventListener('click', confirm);
        overlay.querySelector('.custom-modal-cancel').addEventListener('click', cancel);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') cancel();
        });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel(); });
    });
}

// ====== مساعدات عامة ======
export function getNewProductId() {
    return (state.products && state.products.length ? Math.max(...state.products.map(p => p.id)) : 0) + 1;
}

export function getNewCategoryId() {
    return (state.categories && state.categories.length ? Math.max(...state.categories.map(c => c.id)) : 0) + 1;
}

// تصدير اسم العميل
export { CLIENT };

// ====== دالة مساعدة لدعم جميع صيغ الصور ======
window.handleImageFallback = function (img, fallbackSvg) {
    let exts = img.dataset.fallbacks;
    if (exts === undefined) {
        let currentExtMatch = img.src.match(/\.([a-z0-9]+)(?:[\?#]|$)/i);
        let currentExt = currentExtMatch ? currentExtMatch[1].toLowerCase() : '';
        let allExts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
        exts = allExts.filter(e => e !== currentExt);
    } else if (exts) {
        exts = exts.split(',');
    } else {
        exts = [];
    }
    if (exts.length === 0) {
        img.src = fallbackSvg || 'images/default.jpg';
        return;
    }
    let nextExt = exts.shift();
    img.dataset.fallbacks = exts.length > 0 ? exts.join(',') : '';
    let targetSrc = img.src;
    if (targetSrc.match(/\.[a-z0-9]+(?:[\?#]|$)/i)) {
        targetSrc = targetSrc.replace(/\.[a-z0-9]+(?:[\?#]|$)/i, '.' + nextExt);
    } else {
        targetSrc = targetSrc + '.' + nextExt;
    }
    img.src = targetSrc;
};
