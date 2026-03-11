// Firebase Imports (required when loading this file as module)
import { initializeApp as firebaseInit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, onValue, set, get } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// === استيراد إعدادات العميل من config.js ===
import { CLIENT } from './config.js';

// Firebase Configuration - يتم تحميلها تلقائياً حسب الرابط
const firebaseConfig = CLIENT.firebaseConfig;

// Initialize Firebase app + database reference
let _firebaseApp, _database, dbRef, categoriesRef, productsRef, settingsRef;
let _firebaseReady = false;
try {
    _firebaseApp = firebaseInit(firebaseConfig);
    _database = getDatabase(_firebaseApp);
    dbRef = ref(_database); // الجذر - للقراءة
    categoriesRef = ref(_database, 'categories');
    productsRef = ref(_database, 'products');
    settingsRef = ref(_database, 'settings');
    _firebaseReady = true;
} catch (e) {
    console.error('خطأ في تهيئة Firebase:', e);
}

// In-memory runtime settings (no localStorage/sessionStorage)
let splitInvoice = false; // replace localStorage 'splitInvoice'
let printMethod = 'image'; // replace localStorage 'printMethod'
let invoiceCounter = 0; // replace localStorage 'invoiceCounter'
let sizesClipboard = null; // replace localStorage 'sizesClipboard'
let categoryClipboard = null; // replace localStorage 'categoryClipboard'
let typeSpecificSizesClipboard = null; // existing global used earlier
let viewMode = 'grid'; // replace localStorage 'viewMode'
let appFont = 'default'; // الخط المختار (default = Segoe UI)
let adminAuthenticated = false; // session auth

// قائمة الخطوط المتاحة - متوافقة مع العربية والإنجليزية وغيرها
const availableFonts = [
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

// تحميل وتطبيق الخط
function applyFont(fontId) {
    const font = availableFonts.find(f => f.id === fontId) || availableFonts[0];
    
    // تحميل الخط من Google Fonts إذا لزم الأمر
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
    
    // تطبيق الخط على كامل الصفحة
    document.body.style.fontFamily = font.family;
    appFont = fontId;
}

// Helper: get/set admin key from sessionStorage
function getAdminKey() {
    return sessionStorage.getItem('adminKey');
}
function setAdminKey(key) {
    if (key) {
        sessionStorage.setItem('adminKey', key);
    } else {
        sessionStorage.removeItem('adminKey');
    }
}

// زر إيقاف/تفعيل القسم مؤقتاً
function toggleCategoryAvailability(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    category.disabled = !category.disabled;
    saveData();
    renderCategories();
    renderProducts();
    renderAdminPanel();
    const statusMsg = category.disabled ? 'تم إيقاف القسم مؤقتاً' : 'تم تفعيل القسم';
    showToast(statusMsg, 'success');
}
// Global State
let cart = [];
let categories = [];
let products = [];
let selectedCategory = null;
let currentProductQuantity = 1;
let currentProductSize = null;
let currentProductType = null; // النوع المختار حالياً (حراق، عادي، إلخ)
let currentProductTypeGroups = {}; // الأنواع المختارة من المجموعات الإضافية {0: 'بدون رز', 1: 'مع ليمون'}
let editingProductId = null;
let currentSizeQuantities = {};
let adminFormMode = null;
let editingCategoryId = null;
// Flag to indicate admin paste action was used for sizes
let adminSizesClipboardUsed = false;
// Clipboard for type-specific sizes
// (already declared above, do not redeclare)

let _dataListenerAttached = false;
let _settingsListenerAttached = false;
let _suppressFirebaseSync = false; // منع إعادة تحميل البيانات أثناء التعديل

// Initialize App
function _startApp() {
    try {
        console.log('[APP] _startApp called, readyState:', document.readyState);
        setupEventListeners();
        console.log('[APP] setupEventListeners done');
        setupViewToggle();
        console.log('[APP] setupViewToggle done');
        setupScrollToTop();
        console.log('[APP] setupScrollToTop done');
        loadDataFromServer();
        console.log('[APP] loadDataFromServer done');
    } catch (err) {
        console.error('[APP] Error in _startApp:', err);
        document.title = 'ERROR: ' + err.message;
        const c = document.getElementById('productsContainer');
        if (c) c.innerHTML = '<p style="color:red;padding:20px;font-size:18px;">خطأ: ' + err.message + '</p>';
    }
}
console.log('[APP] Module loaded, readyState:', document.readyState, 'firebaseReady:', _firebaseReady);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _startApp);
} else {
    _startApp();
}

function initializeApp() {
    // kept for compatibility
    loadDataFromServer();
}

function createDefaultData() {
    categories = [
        { id: 1, name: 'بيتزا', image: 'images/بيبروني.jpg' },
        { id: 2, name: 'الشورما', image: 'images/شورما.jpg' },
        { id: 3, name: 'عصائر', image: 'images/عصائر.jpg' }
    ];
    
    products = [
        {
            id: 1,
            name: 'بيبروني',
            categoryId: 1,
            image: 'images/بيبروني.jpg',
            basePrice: 35,
            sizes: [
                { name: 'صغير', price: 35 },
                { name: 'وسط', price: 50 },
                { name: 'كبير', price: 65 }
            ],
            types: ['حراق', 'عادي', 'إضافة جبن'],
            typeSpecificPricingEnabled: {
                'حراق': true,
                'عادي': false,
                'إضافة جبن': true
            },
            typeSpecificSizes: {
                'حراق': [
                    { name: 'صغير', price: 40 },
                    { name: 'وسط', price: 55 },
                    { name: 'كبير', price: 70 }
                ],
                'إضافة جبن': [
                    { name: 'صغير', price: 45 },
                    { name: 'وسط', price: 60 },
                    { name: 'كبير', price: 75 }
                ]
            }
        },
        {
            id: 2,
            name: 'عربي',
            categoryId: 2,
            image: 'images/عربي.jpg',
            basePrice: 12,
            sizes: [
                { name: 'صغير', price: 12 },
                { name: 'كبير', price: 18 }
            ],
            types: ['حراق', 'عادي']
        },
        {
            id: 3,
            name: 'برتقال',
            categoryId: 3,
            image: 'images/برتقال.jpg',
            basePrice: 15,
            sizes: [
                { name: 'صغير', price: 15 },
                { name: 'كبير', price: 20 }
            ]
        }
    ];
    
    // لا نحفظ للسيرفر - البيانات الافتراضية للعرض فقط
}

function setupEventListeners() {
    // Cart
    document.getElementById('cartBtn').addEventListener('click', openCartModal);
    document.getElementById('closeCart').addEventListener('click', closeCartModal);
    document.getElementById('payBtn').addEventListener('click', printInvoice);
    
    // Product Modal
    document.getElementById('closeModal').addEventListener('click', closeProductModal);
    
    // Admin
    document.getElementById('adminBtn').addEventListener('click', openAdminModal);
    document.getElementById('closeAdmin').addEventListener('click', closeAdminModal);
    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('resetInvoiceCounterBtn').addEventListener('click', resetInvoiceCounter);
    document.getElementById('addCategoryBtn').addEventListener('click', () => openAdminForm('category-add'));
    document.getElementById('addProductBtn').addEventListener('click', () => openAdminForm('product-add'));
    const copyCategoryBtn = document.getElementById('copyCategoryBtn');
    if (copyCategoryBtn) copyCategoryBtn.addEventListener('click', copyCategory);
    const pasteCategoryBtn = document.getElementById('pasteCategoryBtn');
    if (pasteCategoryBtn) pasteCategoryBtn.addEventListener('click', pasteCategory);
    // Change admin password button (in admin settings)
    const changeAdminPasswordBtn = document.getElementById('changeAdminPasswordBtn');
    if (changeAdminPasswordBtn) changeAdminPasswordBtn.addEventListener('click', changeAdminPassword);

    // Refresh Button - تحديث البيانات من Firebase
    document.getElementById('refreshBtn').addEventListener('click', function() {
        const btn = this;
        btn.classList.add('spinning');
        // Clear browser caches
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }
        // Unregister service workers
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(reg => reg.unregister());
            });
        }
        // Re-fetch data from Firebase to update categories & products immediately
        if (_firebaseReady) {
            get(dbRef).then(snapshot => {
                const data = snapshot.val();
                if (data) {
                    if (data.categories) {
                        if (Array.isArray(data.categories)) {
                            categories = data.categories;
                        } else {
                            categories = Object.keys(data.categories)
                                .filter(k => k !== 'admin_key')
                                .sort((a, b) => Number(a) - Number(b))
                                .map(k => data.categories[k]);
                        }
                    }
                    if (data.products) {
                        if (Array.isArray(data.products)) {
                            products = data.products;
                        } else {
                            products = Object.keys(data.products)
                                .filter(k => k !== 'admin_key')
                                .sort((a, b) => Number(a) - Number(b))
                                .map(k => data.products[k]);
                        }
                    }
                }
                renderCategories();
                renderProducts();
                btn.classList.remove('spinning');
            }).catch(err => {
                console.error('خطأ في تحديث البيانات:', err);
                location.reload(true);
            });
        } else {
            // Firebase not ready, just reload
            setTimeout(() => {
                location.reload(true);
            }, 500);
        }
    });
    
    // Edit Product Modal
    document.getElementById('closeEditProduct').addEventListener('click', closeEditProductModal);
    document.getElementById('cancelEditProduct').addEventListener('click', closeEditProductModal);
    document.getElementById('editProductForm').addEventListener('submit', saveEditedProduct);
    const copyBtn = document.getElementById('copySizesBtn');
    if (copyBtn) copyBtn.addEventListener('click', copySizes);
    const pasteBtn = document.getElementById('pasteSizesBtn');
    if (pasteBtn) pasteBtn.addEventListener('click', pasteSizesIntoEdit);
    const pasteAdminBtn = document.getElementById('pasteSizesAdminBtn');
    if (pasteAdminBtn) pasteAdminBtn.addEventListener('click', pasteSizesIntoAdminForm);
    document.getElementById('addSizeBtn').addEventListener('click', addNewSize);
    document.getElementById('addTypeBtn').addEventListener('click', addNewType);
    document.getElementById('addTypeGroupBtn').addEventListener('click', addNewTypeGroup);

    // Admin Form Modal
    document.getElementById('closeAdminForm').addEventListener('click', closeAdminForm);
    document.getElementById('cancelAdminForm').addEventListener('click', closeAdminForm);
    document.getElementById('adminForm').addEventListener('submit', saveAdminForm);
    const saveAdminBtn = document.getElementById('saveAdminForm');
    if (saveAdminBtn) {
        saveAdminBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // call save handler directly in case form submit is blocked by browser validation
            try { saveAdminForm(new Event('submit')); } catch (err) { console.error(err); }
        });
    }
    
    // Close modal on outside click
    document.getElementById('productModal').addEventListener('click', function(e) {
        if (e.target === this) closeProductModal();
    });
    
    document.getElementById('cartModal').addEventListener('click', function(e) {
        if (e.target === this) closeCartModal();
    });
    
    document.getElementById('adminModal').addEventListener('click', function(e) {
        if (e.target === this) closeAdminModal();
    });

    document.getElementById('adminFormModal').addEventListener('click', function(e) {
        if (e.target === this) closeAdminForm();
    });
}

function formatNumber(value) {
    // Always use English numbers
    return value.toString();
}

function formatPrice(value) {
    return `${formatNumber(value)} ريال`;
}

function loadDataFromServer() {
    // If Firebase is not ready, use default data
    if (!_firebaseReady) {
        console.warn('Firebase غير متصل - استخدام البيانات الافتراضية');
        if (categories.length === 0) createDefaultData();
        renderCategories();
        renderProducts();
        return;
    }

    // Prevent duplicate onValue listeners
    if (_dataListenerAttached) return;
    _dataListenerAttached = true;

    // Load data from Firebase Realtime Database
    try {
        onValue(dbRef, (snapshot) => {
            // لا تعيد تحميل البيانات أثناء تعديل المنتج
            if (_suppressFirebaseSync) return;
            const data = snapshot.val();
            if (data) {
                // قراءة الأقسام - قد تكون array أو object مع admin_key
                if (data.categories) {
                    if (Array.isArray(data.categories)) {
                        categories = data.categories;
                    } else {
                        categories = Object.keys(data.categories)
                            .filter(k => k !== 'admin_key')
                            .sort((a, b) => Number(a) - Number(b))
                            .map(k => data.categories[k]);
                    }
                } else {
                    categories = [];
                }
                // قراءة المنتجات
                if (data.products) {
                    if (Array.isArray(data.products)) {
                        products = data.products;
                    } else {
                        products = Object.keys(data.products)
                            .filter(k => k !== 'admin_key')
                            .sort((a, b) => Number(a) - Number(b))
                            .map(k => data.products[k]);
                    }
                } else {
                    products = [];
                }
            } else {
                // Use default data when nothing stored yet
                createDefaultData();
            }
            renderCategories();
            renderProducts();
        }, (error) => {
            console.error('خطأ في تحميل البيانات من Firebase:', error);
            // Fallback: use default data and render
            if (categories.length === 0) createDefaultData();
            renderCategories();
            renderProducts();
        });
    } catch (e) {
        console.error('Firebase data listener error:', e);
        if (categories.length === 0) createDefaultData();
        renderCategories();
        renderProducts();
    }

    // Load settings from Firebase
    if (_settingsListenerAttached) return;
    _settingsListenerAttached = true;

    try {
        onValue(settingsRef, (snapshot) => {
            const settings = snapshot.val();
            if (settings) {
                splitInvoice = settings.splitInvoice || false;
                printMethod = settings.printMethod || 'image';
                invoiceCounter = settings.invoiceCounter || 0;
                // admin_password is stored in Firebase, we don't load it client-side
                viewMode = settings.viewMode || 'grid';
                appFont = settings.appFont || 'default';
                applyFont(appFont);
            }
        }, (error) => {
            console.error('خطأ في تحميل الإعدادات من Firebase:', error);
        });
    } catch (e) {
        console.error('Firebase settings listener error:', e);
    }
}

function loadData() {
    loadDataFromServer();
}

// إعادة تحميل البيانات من Firebase بعد إغلاق نموذج التعديل
function resyncFromFirebase() {
    if (!_firebaseReady) return;
    get(dbRef).then(snapshot => {
        const data = snapshot.val();
        if (data) {
            if (data.categories) {
                if (Array.isArray(data.categories)) {
                    categories = data.categories;
                } else {
                    categories = Object.keys(data.categories)
                        .filter(k => k !== 'admin_key')
                        .sort((a, b) => Number(a) - Number(b))
                        .map(k => data.categories[k]);
                }
            }
            if (data.products) {
                if (Array.isArray(data.products)) {
                    products = data.products;
                } else {
                    products = Object.keys(data.products)
                        .filter(k => k !== 'admin_key')
                        .sort((a, b) => Number(a) - Number(b))
                        .map(k => data.products[k]);
                }
            }
        }
        renderCategories();
        renderProducts();
    }).catch(err => {
        console.error('خطأ في إعادة تحميل البيانات:', err);
    });
}

function saveData() {
    const adminKey = getAdminKey();
    if (!_firebaseReady || !adminKey) {
        return;
    }
    // حفظ الأقسام - admin_key يُرسل مع البيانات للتحقق في القواعد
    const catObj = {};
    categories.forEach((c, i) => { catObj[i] = c; });
    catObj.admin_key = adminKey;

    // حفظ المنتجات
    const prodObj = {};
    products.forEach((p, i) => { prodObj[i] = p; });
    prodObj.admin_key = adminKey;

    Promise.all([
        set(categoriesRef, catObj),
        set(productsRef, prodObj)
    ])
    .then(() => {
        console.log('تم حفظ البيانات إلى Firebase بنجاح');
    })
    .catch((error) => {
        console.log('خطأ في حفظ البيانات إلى Firebase:', error);
        showToast('خطأ في حفظ البيانات - تحقق من كلمة المرور', 'error');
    });
}

function saveSettings(silent = false) {
    const adminKey = getAdminKey();
    if (!_firebaseReady || !adminKey) {
        return;
    }
    // نقرأ الإعدادات الحالية أولاً للحفاظ على admin_password
    get(settingsRef).then((snapshot) => {
        const currentSettings = snapshot.val() || {};
        const settingsToSave = {
            splitInvoice,
            printMethod,
            invoiceCounter,
            admin_password: currentSettings.admin_password || adminKey,
            admin_key: adminKey,
            viewMode,
            appFont
        };

        set(settingsRef, settingsToSave)
            .then(() => {
                console.log('تم حفظ الإعدادات إلى Firebase بنجاح');
            })
            .catch((error) => {
                console.log('خطأ في حفظ الإعدادات إلى Firebase:', error);
            });
    });
}

function exportData() {
    const data = { categories, products };
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تحميل ملف data.json بنجاح!', 'success');
}

function renderCategories() {
    // Render in fixed bar
    const barContainer = document.getElementById('categoriesList');
    barContainer.innerHTML = '';
    
    categories.forEach(category => {
        if (category.disabled) return; // إخفاء القسم المعطل
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.textContent = category.name;
        if (selectedCategory === category.id) {
            btn.classList.add('active');
        }
        btn.addEventListener('click', function() {
            selectedCategory = category.id;
            renderCategories();
            renderProducts();
            const section = document.getElementById(`category-section-${category.id}`);
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        barContainer.appendChild(btn);
    });
    
    // Render in header section
    const headerContainer = document.getElementById('categoriesSection');
    if (headerContainer) {
        headerContainer.innerHTML = '';
        categories.forEach(category => {
            if (category.disabled) return; // إخفاء القسم المعطل
            const card = document.createElement('div');
            card.className = 'category-card';
            card.innerHTML = `
                <img src="${category.image}" alt="${category.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23f0e6d8%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E'">
                <div class="category-card-name">${category.name}</div>
            `;
            card.addEventListener('click', function() {
                selectedCategory = category.id;
                renderCategories();
                renderProducts();
                const section = document.getElementById(`category-section-${category.id}`);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    document.getElementById('productsContainer').scrollIntoView({ behavior: 'smooth' });
                }
            });
            headerContainer.appendChild(card);
        });
    }
}

function renderProducts() {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    if (!categories.length) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">لا توجد أقسام</p>`;
        return;
    }

    categories.forEach(category => {
        if (category.disabled) return; // إخفاء القسم المعطل
        const section = document.createElement('section');
        section.className = 'category-section-block';
        section.id = `category-section-${category.id}`;

        const title = document.createElement('h3');
        title.className = 'category-section-title';
        title.textContent = category.name;

        const grid = document.createElement('div');
        grid.className = 'category-products-grid';

        const categoryProducts = products.filter(p => p.categoryId === category.id);
        // فلترة المنتجات: إخفاء المنتجات المعطلة
        const activeProducts = categoryProducts.filter(p => !p.disabled);
        
        if (activeProducts.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'category-empty';
            empty.textContent = 'لا توجد منتجات في هذا القسم';
            grid.appendChild(empty);
        } else {
            activeProducts.forEach(product => {
                const card = document.createElement('div');
                card.className = 'product-card';

                const minPrice = product.sizes && product.sizes.length > 0
                    ? Math.min(...product.sizes.map(s => s.price))
                    : product.basePrice;

                // Badge
                if (product.badge) {
                    if (product.badge === 'best') {
                        // Fire effect for best seller
                        card.classList.add('card-on-fire');
                        
                        // Fire particles
                        const fireContainer = document.createElement('div');
                        fireContainer.className = 'fire-particles';
                        const fireEmojis = ['🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥'];
                        fireEmojis.forEach(emoji => {
                            const particle = document.createElement('span');
                            particle.className = 'fire-particle';
                            particle.textContent = emoji;
                            fireContainer.appendChild(particle);
                        });
                        card.appendChild(fireContainer);
                        
                        // Fire label
                        const fireLabel = document.createElement('span');
                        fireLabel.className = 'fire-label';
                        fireLabel.textContent = '🔥 الأكثر مبيعاً';
                        card.appendChild(fireLabel);
                    } else {
                        const badgeEl = document.createElement('span');
                        const badgeMap = {
                            'new': { class: 'badge-new', text: 'جديد' },
                            'offer': { class: 'badge-offer', text: 'عرض خاص' }
                        };
                        const badgeInfo = badgeMap[product.badge];
                        if (badgeInfo) {
                            badgeEl.className = `product-badge ${badgeInfo.class}`;
                            badgeEl.textContent = badgeInfo.text;
                            card.appendChild(badgeEl);
                        }
                    }
                }

                const imgElement = document.createElement('img');
                imgElement.className = 'product-image';
                imgElement.src = product.image;
                imgElement.alt = product.name;
                imgElement.onerror = function() {
                    this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f5f5f5" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" font-size="14" fill="%23999" text-anchor="middle" dy=".3em" font-family="Arial"%3Eصورة غير متوفرة%3C/text%3E%3C/svg%3E';
                };

                const infoDiv = document.createElement('div');
                infoDiv.className = 'product-info';

                const nameDiv = document.createElement('div');
                nameDiv.className = 'product-name';
                nameDiv.textContent = product.name;

                const priceBtn = document.createElement('div');
                priceBtn.className = 'product-price';
                priceBtn.textContent = `من ${formatNumber(minPrice)} ريال`;

                infoDiv.appendChild(nameDiv);
                infoDiv.appendChild(priceBtn);

                card.appendChild(imgElement);
                card.appendChild(infoDiv);

                card.addEventListener('mouseenter', function() {
                    this.classList.add('glowing');
                });

                card.addEventListener('mouseleave', function() {
                    this.classList.remove('glowing');
                });

                card.addEventListener('click', function() {
                    openProductModal(product);
                });

                grid.appendChild(card);
            });
        }

        section.appendChild(title);
        section.appendChild(grid);
        container.appendChild(section);
    });
}

function openProductModal(product) {
    currentProductQuantity = 1;
    currentProductSize = null;
    currentSizeQuantities = {};
    
    const imgElement = document.getElementById('modalProductImg');
    imgElement.src = product.image;
    imgElement.onerror = function() {
        this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300"%3E%3Crect fill="%23f5f5f5" width="300" height="300"/%3E%3Ctext x="50%25" y="50%25" font-size="16" fill="%23999" text-anchor="middle" dy=".3em" font-family="Arial"%3Eصورة غير متوفرة%3C/text%3E%3C/svg%3E';
    };
    
    document.getElementById('modalProductName').textContent = product.name;
    
    // عرض الأنواع إذا كانت موجودة
    const typesSection = document.getElementById('typesSection');
    const typesList = document.getElementById('productTypesList');
    if (product.types && product.types.length > 0) {
        typesSection.style.display = 'flex';
        typesList.innerHTML = '';
        
        // فلترة الأنواع النشطة فقط
        const activeTypes = product.types.filter(type => {
            return !product.disabledTypes || !product.disabledTypes.includes(type);
        });
        
        if (activeTypes.length === 0) {
            typesSection.style.display = 'none';
            currentProductType = null;
        } else {
            currentProductType = activeTypes[0]; // اختيار النوع الأول افتراضياً
            
            activeTypes.forEach((type, index) => {
                const typeBtn = document.createElement('button');
                typeBtn.type = 'button';
                typeBtn.className = 'type-item' + (index === 0 ? ' selected' : '');
                typeBtn.textContent = type;
                typeBtn.addEventListener('click', function() {
                    // إزالة التحديد من جميع الأنواع
                    typesList.querySelectorAll('.type-item').forEach(btn => btn.classList.remove('selected'));
                    // تحديد النوع المختار
                    this.classList.add('selected');
                    currentProductType = type;
                    
                    // تحديث الأسعار حسب النوع المختار
                    renderProductSizes(product, type);
                });
                typesList.appendChild(typeBtn);
            });
        }
    } else {
        typesSection.style.display = 'none';
        currentProductType = null;
    }
    
    // عرض سطور الأنواع الإضافية (المجموعات) - للعميل
    currentProductTypeGroups = {};
    const typeGroupsSection = document.getElementById('typeGroupsSection');
    if (typeGroupsSection) {
        typeGroupsSection.innerHTML = '';
        if (product.typeGroups && product.typeGroups.length > 0) {
            product.typeGroups.forEach((group, groupIndex) => {
                if (!group.types || group.types.length === 0) return;
                
                // فلترة الأنواع النشطة فقط
                const activeGroupTypes = group.types.filter(t => {
                    return t && (!group.disabledTypes || !group.disabledTypes.includes(t));
                });
                
                if (activeGroupTypes.length === 0) return;
                
                const groupDiv = document.createElement('div');
                groupDiv.className = 'types-section';
                groupDiv.style.display = 'flex';
                
                const label = document.createElement('label');
                label.textContent = (group.label || 'سطر ' + (groupIndex + 1)) + ':';
                groupDiv.appendChild(label);
                
                const groupTypesList = document.createElement('div');
                groupTypesList.className = 'types-list';
                
                // اختيار أول نوع افتراضياً
                currentProductTypeGroups[groupIndex] = activeGroupTypes[0];
                
                activeGroupTypes.forEach((type, typeIdx) => {
                    const typeBtn = document.createElement('button');
                    typeBtn.type = 'button';
                    typeBtn.className = 'type-item' + (typeIdx === 0 ? ' selected' : '');
                    typeBtn.textContent = type;
                    typeBtn.addEventListener('click', function() {
                        groupTypesList.querySelectorAll('.type-item').forEach(btn => btn.classList.remove('selected'));
                        this.classList.add('selected');
                        currentProductTypeGroups[groupIndex] = type;
                    });
                    groupTypesList.appendChild(typeBtn);
                });
                
                groupDiv.appendChild(groupTypesList);
                typeGroupsSection.appendChild(groupDiv);
            });
        }
    }
    
    // عرض الأسعار
    renderProductSizes(product, currentProductType);
    
    document.getElementById('productModal').classList.add('active');
}

function renderProductSizes(product, selectedType) {
    const sizesList = document.getElementById('productSizesList');
    sizesList.innerHTML = '';
    currentSizeQuantities = {};
    
    let sizesToShow = [];
    
    // تحديد الأسعار المراد عرضها
    if (selectedType && 
        product.typeSpecificPricingEnabled && 
        product.typeSpecificPricingEnabled[selectedType] && 
        product.typeSpecificSizes && 
        product.typeSpecificSizes[selectedType]) {
        // استخدام الأسعار الخاصة بالنوع
        sizesToShow = product.typeSpecificSizes[selectedType];
    } else if (product.sizes && product.sizes.length > 0) {
        // استخدام الأسعار العامة
        sizesToShow = product.sizes;
    }

    const quantitySection = document.querySelector('.quantity-section');
    if (sizesToShow && sizesToShow.length > 0) {
        if (quantitySection) quantitySection.style.display = 'none';

        sizesToShow.forEach((size, index) => {
            currentSizeQuantities[index] = 0;
            const sizeRow = document.createElement('div');
            sizeRow.className = 'size-item size-item-row';
            sizeRow.innerHTML = `
                <div class="size-info">
                    <span class="size-name">${size.name}</span>
                    <span class="size-price">${formatPrice(size.price)}</span>
                </div>
                <div class="size-qty-controls">
                    <button class="qty-btn" type="button" data-action="plus" data-index="${index}" data-product-id="${product.id}">+</button>
                    <span class="qty-display" data-index="${index}">0</span>
                    <button class="qty-btn" type="button" data-action="minus" data-index="${index}" data-product-id="${product.id}">−</button>
                </div>
            `;
            sizesList.appendChild(sizeRow);
        });

        sizesList.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const idx = parseInt(this.getAttribute('data-index'));
                const action = this.getAttribute('data-action');
                const productId = parseInt(this.getAttribute('data-product-id'));
                const current = currentSizeQuantities[idx] || 0;
                const next = action === 'plus' ? current + 1 : Math.max(0, current - 1);
                currentSizeQuantities[idx] = next;
                const display = sizesList.querySelector(`.qty-display[data-index="${idx}"]`);
                if (display) display.textContent = next;
                
                // Add to cart immediately
                const prod = products.find(p => p.id === productId);
                if (prod && sizesToShow[idx]) {
                    const size = sizesToShow[idx];
                    addToCartDirectly(prod, size, next - current);
                }
            });
        });

        // استعادة الكميات من السلة عند إعادة فتح بطاقة الصنف
        let fullType = currentProductType || '';
        const groupSelections = Object.values(currentProductTypeGroups || {}).filter(v => v);
        if (groupSelections.length > 0) {
            fullType = fullType ? fullType + ' - ' + groupSelections.join(' - ') : groupSelections.join(' - ');
        }
        const typeForRestore = fullType || null;

        sizesToShow.forEach((size, index) => {
            const cartItem = cart.find(item =>
                item.productId === product.id &&
                item.size === size.name &&
                item.type === typeForRestore
            );
            if (cartItem && cartItem.quantity > 0) {
                currentSizeQuantities[index] = cartItem.quantity;
                const display = sizesList.querySelector(`.qty-display[data-index="${index}"]`);
                if (display) display.textContent = cartItem.quantity;
            }
        });
    } else {
        if (quantitySection) quantitySection.style.display = '';
        // If no sizes, use base price
        currentProductSize = { name: '', price: product.basePrice };

        // استعادة الكمية من السلة للمنتجات بدون مقاسات
        let fullTypeNoSize = currentProductType || '';
        const groupSelectionsNoSize = Object.values(currentProductTypeGroups || {}).filter(v => v);
        if (groupSelectionsNoSize.length > 0) {
            fullTypeNoSize = fullTypeNoSize ? fullTypeNoSize + ' - ' + groupSelectionsNoSize.join(' - ') : groupSelectionsNoSize.join(' - ');
        }
        const typeForRestoreNoSize = fullTypeNoSize || null;
        const cartItemNoSize = cart.find(item =>
            item.productId === product.id &&
            item.size === '' &&
            item.type === typeForRestoreNoSize
        );
        if (cartItemNoSize && cartItemNoSize.quantity > 0) {
            currentProductQuantity = cartItemNoSize.quantity;
        }

        updateQuantityDisplay();
    }
}

function addToCartDirectly(product, size, quantityChange) {
    if (quantityChange === 0) return;
    
    // بناء سلسلة النوع الكاملة (النوع الأساسي + المجموعات الإضافية)
    let fullType = currentProductType || '';
    const groupSelections = Object.values(currentProductTypeGroups || {}).filter(v => v);
    if (groupSelections.length > 0) {
        if (fullType) {
            fullType += ' - ' + groupSelections.join(' - ');
        } else {
            fullType = groupSelections.join(' - ');
        }
    }
    const typeForCart = fullType || null;
    
    // Find if item already exists in cart (مع النوع)
    const existingItemIndex = cart.findIndex(item => 
        item.productId === product.id && 
        item.size === size.name && 
        item.type === typeForCart
    );
    
    if (existingItemIndex !== -1) {
        // Update existing item
        cart[existingItemIndex].quantity += quantityChange;
        if (cart[existingItemIndex].quantity <= 0) {
            cart.splice(existingItemIndex, 1);
        }
    } else if (quantityChange > 0) {
        // Add new item with type
        cart.push({
            productId: product.id,
            productName: product.name,
            categoryId: product.categoryId,
            size: size.name,
            type: typeForCart, // حفظ النوع المختار مع المجموعات الإضافية
            price: size.price,
            quantity: quantityChange
        });
    }
    
    // Fly-to-cart animation on add
    if (quantityChange > 0) {
        flyToCartAnimation();
    }
    
    updateCartCount();
}

function flyToCartAnimation() {
    const cartBtn = document.getElementById('cartBtn');
    if (!cartBtn) return;
    
    // Get the last clicked button position
    const clickedBtn = document.querySelector('.qty-btn:focus, .qty-btn:active');
    let startX, startY;
    
    if (clickedBtn) {
        const btnRect = clickedBtn.getBoundingClientRect();
        startX = btnRect.left + btnRect.width / 2;
        startY = btnRect.top + btnRect.height / 2;
    } else {
        // Fallback to center of modal
        const modal = document.getElementById('productModal');
        const modalRect = modal.getBoundingClientRect();
        startX = modalRect.left + modalRect.width / 2;
        startY = modalRect.top + modalRect.height / 2;
    }
    
    const cartRect = cartBtn.getBoundingClientRect();
    const endX = cartRect.left + cartRect.width / 2;
    const endY = cartRect.top + cartRect.height / 2;
    
    // Create flying element
    const flyEl = document.createElement('div');
    flyEl.className = 'fly-to-cart';
    flyEl.textContent = '+1';
    flyEl.style.left = startX - 18 + 'px';
    flyEl.style.top = startY - 18 + 'px';
    document.body.appendChild(flyEl);
    
    // Trigger animation
    requestAnimationFrame(() => {
        flyEl.style.left = endX - 18 + 'px';
        flyEl.style.top = endY - 18 + 'px';
        flyEl.classList.add('animate');
    });
    
    // Shake cart on arrival
    setTimeout(() => {
        const cartFixed = document.querySelector('.cart-fixed');
        if (cartFixed) {
            cartFixed.classList.remove('shake');
            void cartFixed.offsetWidth; // force reflow
            cartFixed.classList.add('shake');
        }
    }, 500);
    
    // Remove flying element
    setTimeout(() => {
        flyEl.remove();
    }, 650);
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

function updateQuantityDisplay() {
    document.getElementById('qtyDisplay').textContent = formatNumber(currentProductQuantity);
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = formatNumber(count);
}

function openCartModal() {
    const cartItemsList = document.getElementById('cartItemsList');
    cartItemsList.innerHTML = '';
    
    let total = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const cartItemDiv = document.createElement('div');
        cartItemDiv.className = 'cart-item';
        const displayName = item.size ? `${item.productName} - ${item.size}` : item.productName;
        cartItemDiv.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${displayName}</div>
                ${item.type ? `<div class="cart-item-type" style="color: #e67e22; font-weight: 600; font-size: 13px;">النوع: ${item.type}</div>` : ''}
                <div>السعر: ${formatPrice(itemTotal)}</div>
            </div>
            <div class="cart-item-controls">
                <button class="qty-btn" onclick="increaseCartItem(${index})">+</button>
                <span>${item.quantity}</span>
                <button class="qty-btn" onclick="decreaseCartItem(${index})">−</button>
                <button class="cart-remove-btn" onclick="removeFromCart(${index})">✕</button>
            </div>
        `;
        cartItemsList.appendChild(cartItemDiv);
    });
    
    document.getElementById('totalPrice').textContent = formatNumber(total);
    document.getElementById('cartModal').classList.add('active');
}

function closeCartModal() {
    document.getElementById('cartModal').classList.remove('active');
}

function increaseCartItem(index) {
    if (cart[index]) {
        cart[index].quantity++;
        updateCartCount();
        openCartModal();
    }
}

function decreaseCartItem(index) {
    if (cart[index] && cart[index].quantity > 1) {
        cart[index].quantity--;
        updateCartCount();
        openCartModal();
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartCount();
    openCartModal();
}

// ====================================
// نظام الطباعة الجديد - New Print System
// ====================================

/**
 * التحقق من تفعيل خاصية تقسيم الفاتورة
 * Check if invoice splitting is enabled
 */
function isSplitInvoiceEnabled() {
    return splitInvoice === true;
}

/**
 * الحصول على طريقة الطباعة المحفوظة
 * Get saved print method (image or text)
 */
function getPrintMethod() {
    // الافتراضي: طباعة بالصورة (الأفضل للعربية)
    return printMethod || 'image';
}

/**
 * اكتشاف نظام التشغيل
 * Detect operating system (Android, Windows, iOS, etc.)
 */
function detectOS() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    // Android detection
    if (/android/i.test(userAgent)) {
        return 'Android';
    }
    
    // iOS detection
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return 'iOS';
    }
    
    // Windows detection
    if (/Win/i.test(userAgent)) {
        return 'Windows';
    }
    
    // Mac detection
    if (/Mac/i.test(userAgent)) {
        return 'Mac';
    }
    
    // Linux detection
    if (/Linux/i.test(userAgent)) {
        return 'Linux';
    }
    
    return 'Unknown';
}

/**
 * توليد رقم فاتورة جديد
 * Generate new invoice number
 */
function getNextInvoiceNumber() {
    // Sequential invoice counter (persisted to Firebase)
    invoiceCounter = (typeof invoiceCounter === 'number' ? invoiceCounter + 1 : 1);
    saveSettings(true);
    return String(invoiceCounter);
}

/**
 * إنشاء محتوى الفاتورة بتنسيق حراري 80mm
 * Generate thermal invoice content for 80mm paper
 */
function generateInvoiceText(items, invoiceNumber, total, categoryName = null) {
    const date = new Date();
    const dateStr = date.toLocaleDateString('ar-SA');
    const timeStr = date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    
    const restaurantName = CLIENT.name;
    const doubleLine = '================================';
    const singleLine = '--------------------------------';
    const thinLine = '- - - - - - - - - - - - - - - -';
    
    // فواتير الأقسام لا تحتاج اسم المحل والإجمالي ورسالة الشكر
    const isCategoryInvoice = categoryName !== null;
    
    let text = '';
    
    // مسافة في البداية
    text += '\n';
    
    // العنوان - Header (فقط للفاتورة الرئيسية)
    if (!isCategoryInvoice) {
        text += doubleLine + '\n';
        text += centerText('■ ' + restaurantName + ' ■', 32) + '\n';
        text += doubleLine + '\n';
        text += '\n';
    }
    
    // معلومات الفاتورة - Invoice Info
    text += singleLine + '\n';
    text += formatItemLine('رقم الفاتورة:', `[ ${invoiceNumber} ]`) + '\n';
    
    // اسم القسم إذا كانت فاتورة قسم (بشكل بارز)
    if (categoryName) {
        text += doubleLine + '\n';
        text += centerText(`■■■ ${categoryName} ■■■`, 32) + '\n';
        text += doubleLine + '\n';
    }
    
    text += singleLine + '\n';
    text += formatItemLine('التاريخ:', dateStr) + '\n';
    text += formatItemLine('الوقت:', timeStr) + '\n';
    text += singleLine + '\n';
    text += '\n';
    
    // الأصناف - Items
    text += centerText('*** الأصناف المطلوبة ***', 32) + '\n';
    text += doubleLine + '\n';
    
    items.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        const size = item.size ? ` (${item.size})` : '';
        const type = item.type ? ` - ${item.type}` : '';
        const itemName = `${item.productName}${type}${size}`;
        
        // رقم الصنف واسمه
        text += `${index + 1}. ${itemName}\n`;
        
        // الكمية والسعر في سطر واحد مع تنسيق واضح
        text += formatItemLine(
            `   الكمية: ${item.quantity} ×`,
            `${itemTotal} ريال`
        ) + '\n';
        
        text += thinLine + '\n';
    });
    
    text += '\n';
    
    // الإجمالي - Total (فقط للفاتورة الرئيسية)
    if (!isCategoryInvoice) {
        text += doubleLine + '\n';
        text += formatItemLine('المجموع الكلي:', `${total} ريال`) + '\n';
        text += doubleLine + '\n';
        text += '\n';
    }
    
    // رسالة الشكر - Thank you message (فقط للفاتورة الرئيسية)
    if (!isCategoryInvoice) {
        text += centerText('═══════════════════════════════', 32) + '\n';
        text += centerText('توجه للكاشير للدفع', 32) + '\n';
        text += centerText('نسعد بخدمتكم دائماً', 32) + '\n';
        text += centerText('═══════════════════════════════', 32) + '\n';
    }
    
    text += '\n\n\n';
    
    return text;
}

/**
 * توسيط النص
 * Center text for thermal printer
 */
function centerText(text, width = 32) {
    const padding = Math.floor((width - text.length) / 2);
    return ' '.repeat(Math.max(0, padding)) + text;
}

/**
 * تنسيق سطر الصنف (اسم على اليسار، سعر على اليمين)
 * Format item line with left and right alignment
 */
function formatItemLine(left, right, bold = false) {
    const totalWidth = 32;
    const spaces = totalWidth - left.length - right.length;
    return left + ' '.repeat(Math.max(1, spaces)) + right;
}

/**
 * تحويل النص إلى Base64 لدعم العربية
 * Convert text to Base64 for Arabic support
 */
function encodeToBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
}

/**
 * تحويل array buffer إلى Base64
 * Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * تحويل HTML إلى صورة باستخدام html2canvas
 * Convert HTML to image using html2canvas
 */
async function htmlToImage(invoiceHTML, width = 560) {
    return new Promise((resolve, reject) => {
        // إنشاء عنصر مؤقت
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'fixed';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.style.width = `${width}px`;
        tempDiv.style.maxWidth = `${width}px`;
        tempDiv.style.background = 'white';
        tempDiv.style.padding = '0';
        tempDiv.style.margin = '0';
        tempDiv.style.overflow = 'hidden';
        tempDiv.style.direction = 'ltr';
        tempDiv.innerHTML = invoiceHTML;
        document.body.appendChild(tempDiv);
        
        // استخدام html2canvas مع scale 2 للجودة
        html2canvas(tempDiv, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            width: width,
            windowWidth: width,
            useCORS: true
        }).then(hiResCanvas => {
            document.body.removeChild(tempDiv);
            
            // تصغير الصورة إلى العرض المطلوب
            const targetWidth = width;
            const targetHeight = Math.round(hiResCanvas.height / 2);
            const resizedCanvas = document.createElement('canvas');
            resizedCanvas.width = targetWidth;
            resizedCanvas.height = targetHeight;
            const rCtx = resizedCanvas.getContext('2d');
            rCtx.imageSmoothingEnabled = false; // حواف حادة للنص
            rCtx.drawImage(hiResCanvas, 0, 0, targetWidth, targetHeight);
            
            resolve(resizedCanvas);
            
            resolve(resizedCanvas);
        }).catch(error => {
            if (document.body.contains(tempDiv)) {
                document.body.removeChild(tempDiv);
            }
            reject(error);
        });
    });
}

/**
 * تحويل Canvas إلى ESC/POS Bitmap
 * Convert Canvas to ESC/POS Bitmap commands
 */
function canvasToESCPOSBitmap(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    let height = canvas.height;
    
    // الحصول على بيانات الصورة
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    
    // قص المسافة البيضاء من أسفل الصورة
    let lastNonWhiteRow = 0;
    for (let y = height - 1; y >= 0; y--) {
        let rowHasContent = false;
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            if (r < 250 || g < 250 || b < 250) {
                rowHasContent = true;
                break;
            }
        }
        if (rowHasContent) {
            lastNonWhiteRow = y;
            break;
        }
    }
    // إضافة 1 بكسل فقط بعد آخر محتوى (قص الهامش الأبيض السفلي تماماً)
    height = Math.min(lastNonWhiteRow + 1, canvas.height);
    
    // تحويل إلى أبيض وأسود - تقوية التباين للطباعة الواضحة
    const threshold = 150;  // قيمة أقل لجعل الخط أغمق وأوضح
    const bitmapWidth = Math.ceil(width / 8) * 8; // تقريب لأقرب 8
    const bytesPerLine = bitmapWidth / 8;
    
    // إنشاء bitmap data
    const bitmapData = [];
    
    for (let y = 0; y < height; y++) {
        const line = new Uint8Array(bytesPerLine);
        
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            
            // تحويل إلى grayscale
            const gray = (r + g + b) / 3;
            
            // إذا كان داكن، ضع 1 (أسود)
            if (gray < threshold) {
                const byteIndex = Math.floor(x / 8);
                const bitIndex = 7 - (x % 8);
                line[byteIndex] |= (1 << bitIndex);
            }
        }
        
        bitmapData.push(...line);
    }
    
    // إنشاء أوامر ESC/POS
    const ESC = 0x1B;
    const GS = 0x1D;
    
    const commands = [];
    
    // تهيئة الطابعة
    commands.push(ESC, 0x40);
    
    // محاذاة للوسط
    commands.push(ESC, 0x61, 0x01);
    
    // طباعة الصورة باستخدام GS v 0
    // GS v 0 m xL xH yL yH d1...dk
    commands.push(GS, 0x76, 0x30, 0x00);
    
    // العرض (بايتات)
    commands.push(bytesPerLine & 0xFF, (bytesPerLine >> 8) & 0xFF);
    
    // الارتفاع
    commands.push(height & 0xFF, (height >> 8) & 0xFF);
    
    // البيانات
    commands.push(...bitmapData);
    
    // تغذية ورق بسيطة (سطر واحد فقط)
    commands.push(0x0A);
    
    // قطع الورق - بدون تغذية إضافية
    commands.push(GS, 0x56, 0x41, 0x00);
    
    return new Uint8Array(commands);
}

/**
 * إنشاء بيانات ESC/POS مع أوامر الطابعة للعربية
 * Create ESC/POS data with printer commands for Arabic
 */
function createESCPOSData(text) {
    // ESC/POS Commands
    const ESC = '\x1B';
    const GS = '\x1D';
    
    let escposData = '';
    
    // 1. تهيئة الطابعة (Initialize printer)
    escposData += ESC + '@';
    
    // 2. تعيين Code Page إلى CP864 (Arabic)
    // ESC t n - where n=22 (0x16) for CP864
    escposData += ESC + 't' + '\x16';
    
    // محاولة بديلة: Windows-1256 (إذا فشل CP864)
    // بعض الطابعات تستخدم: ESC t 28 للـ Windows-1256
    // escposData += ESC + 't' + '\x1C';
    
    // 3. تعيين محاذاة النص للوسط (Center alignment for header)
    escposData += ESC + 'a' + '\x01';
    
    // 4. إضافة النص
    escposData += text;
    
    // 5. قطع الورق (Paper cut)
    escposData += '\n\n\n';
    escposData += GS + 'V' + '\x41' + '\x03'; // Partial cut
    
    return escposData;
}

/**
 * طباعة على أندرويد باستخدام RawBT (مع دعم الطريقتين)
 * Print on Android using RawBT (Supports both methods)
 */
async function printOnAndroid(invoices) {
    const printMethod = getPrintMethod();
    
    // اختيار الطريقة حسب إعدادات المستخدم
    if (printMethod === 'image') {
        await printOnAndroidAsImage(invoices);
    } else {
        await printOnAndroidAsText(invoices);
    }
}

/**
 * طباعة على أندرويد باستخدام RawBT (حل الصور)
 * Print on Android using RawBT (Image-based solution)
 */
async function printOnAndroidAsImage(invoices) {
    try {
        // التحقق من وجود html2canvas
        if (typeof html2canvas === 'undefined') {
            showToast('جاري تحميل مكتبة الطباعة... يرجى الانتظار', 'info', 2000);
            // الانتظار قليلاً ثم إعادة المحاولة
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas library not loaded');
            }
        }
        
        showToast('جاري تحضير الفواتير للطباعة...', 'info', 2000);
        
        // طباعة كل فاتورة على حدة
        for (let i = 0; i < invoices.length; i++) {
            const invoice = invoices[i];
            
            // التحقق من وجود البيانات المطلوبة
            if (!invoice || !invoice.items || !invoice.items.length) {
                console.error(`الفاتورة ${i + 1} لا تحتوي على منتجات`);
                showToast(`خطأ: الفاتورة ${i + 1} فارغة`, 'error', 2000);
                continue;
            }
            
            // إنشاء HTML للفاتورة بخطوط كبيرة للطباعة الحرارية
            const invoiceHTML = generateInvoiceHTML(
                invoice.items,
                invoice.invoiceNumber || 'N/A',
                invoice.total || 0,
                invoice.categoryName || null,
                576,  // عرض الطباعة 80mm = 576 dots @ 203 DPI
                true  // خطوط كبيرة للجوال
            );
            
            try {
                // تحويل HTML إلى صورة
                const canvas = await htmlToImage(invoiceHTML, 576);
                
                if (!canvas) {
                    throw new Error('فشل في إنشاء الصورة');
                }
                
                // تحويل الصورة إلى ESC/POS bitmap
                const bitmapCommands = canvasToESCPOSBitmap(canvas);
                
                if (!bitmapCommands || !bitmapCommands.buffer) {
                    throw new Error('فشل في تحويل الصورة إلى bitmap');
                }
                
                // تحويل إلى Base64
                const base64Data = arrayBufferToBase64(bitmapCommands.buffer);
                
                if (!base64Data) {
                    throw new Error('فشل في تحويل البيانات إلى Base64');
                }
                
                // إرسال للطابعة
                const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
                
                // تأخير بين الفواتير
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                window.location.href = intentUrl;
                
                showToast(`تم إرسال فاتورة ${i + 1} من ${invoices.length}`, 'success', 1500);
                
            } catch (error) {
                console.error(`خطأ في معالجة الفاتورة ${i + 1}:`, error);
                console.error('تفاصيل الفاتورة:', invoice);
                showToast(`خطأ في الفاتورة ${i + 1}: ${error.message}`, 'error', 3000);
            }
        }
        
        showToast('تم إرسال جميع الفواتير للطباعة! ✓', 'success', 3000);
        
        // تنظيف السلة بعد الطباعة
        setTimeout(() => {
            cart = [];
            updateCartCount();
            closeCartModal();
        }, 2000);
        
    } catch (error) {
        console.error('خطأ في الطباعة على أندرويد:', error);
        showToast('حدث خطأ في الطباعة. تأكد من الاتصال بالإنترنت وتثبيت RawBT', 'error', 5000);
    }
}

/**
 * طباعة على أندرويد باستخدام RawBT (حل نصي)
 * Print on Android using RawBT (Text-based solution)
 */
async function printOnAndroidAsText(invoices) {
    try {
        // التحقق من وجود الفواتير
        if (!invoices || !invoices.length) {
            showToast('لا توجد فواتير للطباعة', 'error', 2000);
            return;
        }
        
        // دمج جميع الفواتير في نص واحد
        let combinedText = '';
        invoices.forEach((invoice, index) => {
            // التحقق من وجود النص
            if (!invoice || !invoice.text) {
                console.error(`الفاتورة ${index + 1} لا تحتوي على نص`);
                return;
            }
            
            combinedText += invoice.text;
            // إضافة فاصل بين الفواتير
            if (index < invoices.length - 1) {
                combinedText += '\n\n';
                combinedText += '■'.repeat(32) + '\n';
                combinedText += centerText('▼ الفاتورة التالية ▼', 32) + '\n';
                combinedText += '■'.repeat(32) + '\n\n';
            }
        });
        
        if (!combinedText) {
            showToast('فشل في إنشاء نص الفواتير', 'error', 2000);
            return;
        }
        
        // إضافة أوامر ESC/POS لتحسين العربية
        const escposData = createESCPOSData(combinedText);
        
        // تحويل إلى Base64
        const base64Text = encodeToBase64(escposData);
        
        // إنشاء intent URL لتطبيق RawBT بالصيغة الصحيحة
        const intentUrl = `intent:base64,${base64Text}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        
        // محاولة فتح التطبيق
        window.location.href = intentUrl;
        
        showToast('تم إرسال الفواتير إلى تطبيق RawBT', 'success');
        
        // تنظيف السلة بعد الطباعة
        setTimeout(() => {
            cart = [];
            updateCartCount();
            closeCartModal();
        }, 1000);
        
    } catch (error) {
        console.error('خطأ في الطباعة على أندرويد:', error);
        showToast('حدث خطأ في الطباعة. تأكد من تثبيت تطبيق RawBT', 'error', 5000);
    }
}

/**
 * إنشاء HTML فاتورة محسّنة
 * Generate enhanced HTML invoice
 */
function generateInvoiceHTML(items, invoiceNumber, total, categoryName = null, width = 560, largeFonts = false) {
    const date = new Date();
    const dateStr = date.toLocaleDateString('ar-SA');
    const timeStr = date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    
    const restaurantName = CLIENT.name;
    
    // بناء HTML للأصناف
    let itemsHTML = '';
    items.forEach((item) => {
        const itemTotal = item.price * item.quantity;
        const size = item.size ? ` (${item.size})` : '';
        const type = item.type ? ` - ${item.type}` : '';
        const itemName = `${item.productName}${type}${size}`;
        
        itemsHTML += `
            <div class="item">
                <div class="item-left">
                    <div class="item-name">${itemName}</div>
                    <div class="item-qty">× ${item.quantity}</div>
                </div>
                <div class="item-price">${itemTotal} ريال</div>
            </div>
        `;
    });
    
    // عنوان إضافي للفاتورة المقسمة
    const categoryLabel = categoryName ? 
        `<div class="category-label">القسم: ${categoryName}</div>` : '';
    
    const isCategoryInvoice = categoryName !== null;
    
    const headerHTML = !isCategoryInvoice ? `
        <div class="header">
            <h1>${restaurantName}</h1>
            <div class="sub-header">وجه الى الكاشير للدفع</div>
        </div>
    ` : '';
    
    const totalHTML = !isCategoryInvoice ? `
        <div class="total">
            <span>الإجمالي:</span>
            <span>${total} ريال</span>
        </div>
    ` : '';
    
    // أحجام الخطوط - كبيرة للجوال/الطباعة الحرارية (576px)، عادية للكمبيوتر (560px)
    const fs = largeFonts ? {
        h1: 34, subHeader: 20, meta: 20, label: 20, value: 20,
        datetime: 18, catLabel: 18, item: 18, itemName: 20,
        qty: 18, price: 20, total: 26, padding: '22px 16px 0 16px',
        headerPb: 14, headerMb: 16, metaMargin: 14, invMb: 10,
        valuePad: '5px 14px', dtMt: 10, catMargin: 10, catPad: 8,
        itemsMt: 14, itemsPad: 12, itemPad: 10, gap: 8,
        qtyMin: 42, priceW: 100, totalMt: 14, totalPad: '12px 0 18px 0'
    } : {
        h1: 30, subHeader: 18, meta: 18, label: 18, value: 18,
        datetime: 16, catLabel: 16, item: 16, itemName: 18,
        qty: 16, price: 18, total: 22, padding: '20px 16px 0 16px',
        headerPb: 12, headerMb: 16, metaMargin: 12, invMb: 10,
        valuePad: '5px 12px', dtMt: 10, catMargin: 10, catPad: 6,
        itemsMt: 14, itemsPad: 10, itemPad: 8, gap: 8,
        qtyMin: 40, priceW: 95, totalMt: 12, totalPad: '12px 0 20px 0'
    };

    return `
    <style>
        .invoice {
            font-family: Arial, sans-serif;
            width: ${width}px;
            max-width: ${width}px;
            border: 2px solid #000;
            padding: ${fs.padding};
            background: white;
            direction: rtl;
            text-align: right;
            box-sizing: border-box;
            margin: 0;
            overflow: hidden;
        }
        .header {
            border-bottom: 2px solid #000;
            padding-bottom: ${fs.headerPb}px;
            margin-bottom: ${fs.headerMb}px;
            text-align: center;
        }
        .header h1 {
            margin: 0 0 8px 0;
            padding: 0;
            font-size: ${fs.h1}px;
            font-weight: bold;
        }
        .sub-header {
            font-size: ${fs.subHeader}px;
            color: #444;
            font-weight: 500;
        }
        .invoice-meta {
            font-size: ${fs.meta}px;
            margin: ${fs.metaMargin}px 0;
        }
        .invoice-number-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: ${fs.invMb}px;
        }
        .inv-label {
            font-size: ${fs.label}px;
            font-weight: bold;
        }
        .inv-value {
            font-size: ${fs.value}px;
            font-weight: 700;
            border: 1.5px solid #999;
            padding: ${fs.valuePad};
            border-radius: 5px;
            background: #f5f5f5;
        }
        .invoice-datetime {
            margin-top: ${fs.dtMt}px;
            font-size: ${fs.datetime}px;
            font-weight: bold;
            color: #000;
        }
        .category-label {
            font-size: ${fs.catLabel}px;
            margin: ${fs.catMargin}px 0;
            color: #000;
            font-weight: bold;
            text-align: center;
            background: #f9f9f9;
            padding: ${fs.catPad}px;
            border: 2px solid #000;
            border-radius: 5px;
        }
        .items {
            margin: ${fs.itemsMt}px 0 0 0;
            border-top: 1.5px solid #ddd;
            border-bottom: 1.5px solid #ddd;
            padding: ${fs.itemsPad}px 0;
        }
        .item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: ${fs.itemPad}px 0;
            font-size: ${fs.item}px;
            border-bottom: 1px solid #eee;
        }
        .item:last-child {
            border-bottom: none;
        }
        .item-left {
            display: flex;
            flex: 1;
            gap: ${fs.gap}px;
            align-items: center;
            justify-content: flex-end;
            min-width: 0;
            flex-wrap: wrap;
        }
        .item-name {
            font-size: ${fs.itemName}px;
            font-weight: 600;
            word-wrap: break-word;
            white-space: normal;
        }
        .item-qty {
            min-width: ${fs.qtyMin}px;
            text-align: center;
            font-weight: 700;
            font-size: ${fs.qty}px;
            flex-shrink: 0;
        }
        .item-price {
            width: ${fs.priceW}px;
            text-align: left;
            font-size: ${fs.price}px;
            font-weight: 700;
            flex-shrink: 0;
        }
        .total {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            margin-top: ${fs.totalMt}px;
            margin-bottom: 0;
            padding: ${fs.totalPad};
            border-top: 2.5px solid #000;
            border-bottom: 2.5px solid #000;
            font-size: ${fs.total}px;
        }
    </style>
    <div class="invoice">
        ${headerHTML}
        <div class="invoice-meta">
            <div class="invoice-number-row">
                <span class="inv-label">رقم الفاتورة:</span>
                <span class="inv-value">${invoiceNumber}</span>
            </div>
            ${categoryLabel}
            <div class="invoice-datetime">
                <div>التاريخ: ${dateStr}</div>
                <div>الوقت: ${timeStr}</div>
            </div>
        </div>
        <div class="items">
            ${itemsHTML}
        </div>
        ${totalHTML}
    </div>
    `;
}

/**
 * طباعة على ويندوز باستخدام نافذة طباعة واحدة
 * Print on Windows using single print window
 */
function printOnWindows(invoices) {
    try {
        // إنشاء HTML لجميع الفواتير
        let htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>طباعة الفواتير</title>
    <style>
        @media print {
            body { margin: 0; padding: 0; }
            .invoice-wrapper {
                page-break-after: always;
                page-break-inside: avoid;
            }
            .invoice-wrapper:last-child {
                page-break-after: auto;
            }
        }
        
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: white;
        }
        
        .invoice-wrapper {
            display: flex;
            justify-content: center;
            padding: 5px;
            background: white;
        }
        
        @media screen {
            body {
                background: #f0f0f0;
            }
            .invoice-wrapper {
                margin-bottom: 20px;
            }
            .invoice {
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
        }
    </style>
</head>
<body>
`;

        // إضافة كل فاتورة في صفحة منفصلة
        invoices.forEach((invoice) => {
            // تحويل النصوص إلى HTML للفواتير
            const items = invoice.items || cart;
            const total = invoice.total || calculateTotal(items);
            const invoiceHTML = generateInvoiceHTML(items, invoice.invoiceNumber, total, invoice.categoryName || null, 560);
            
            htmlContent += `    <div class="invoice-wrapper">
        ${invoiceHTML}
    </div>
`;
        });

        htmlContent += `    <script>
        // الطباعة التلقائية عند تحميل الصفحة
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        };
        
        // إغلاق النافذة بعد الطباعة
        window.onafterprint = function() {
            setTimeout(function() {
                window.close();
            }, 500);
        };
    </script>
</body>
</html>`;

        // فتح نافذة جديدة للطباعة
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        
        if (!printWindow) {
            showToast('تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة', 'error', 5000);
            return;
        }
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        showToast('جاري تحضير الفواتير للطباعة...', 'info');
        
        // تنظيف السلة بعد الطباعة
        setTimeout(() => {
            cart = [];
            updateCartCount();
            closeCartModal();
        }, 1500);
        
    } catch (error) {
        console.error('خطأ في الطباعة على ويندوز:', error);
        showToast('حدث خطأ في الطباعة', 'error');
    }
}

/**
 * تجميع الأصناف حسب القسم
 * Group cart items by category
 */
function groupItemsByCategory() {
    const grouped = {};
    
    cart.forEach(item => {
        // البحث عن المنتج للحصول على القسم
        const product = products.find(p => p.id === item.productId);
        if (!product) return;
        
        const categoryId = product.categoryId;
        
        if (!grouped[categoryId]) {
            const category = categories.find(c => c.id === categoryId);
            grouped[categoryId] = {
                categoryId: categoryId,
                categoryName: category ? category.name : 'غير محدد',
                items: []
            };
        }
        
        grouped[categoryId].items.push(item);
    });
    
    return Object.values(grouped);
}

/**
 * حساب إجمالي الأصناف
 * Calculate total for items
 */
function calculateTotal(items) {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

/**
 * الوظيفة الرئيسية للطباعة
 * Main print function
 */
function printInvoice() {
    if (cart.length === 0) {
        showToast('السلة فارغة', 'error');
        return;
    }
    
    const os = detectOS();
    const splitEnabled = isSplitInvoiceEnabled();
    const invoices = [];
    
    // رقم الفاتورة الرئيسية
    const mainInvoiceNumber = getNextInvoiceNumber();
    
    if (splitEnabled) {
        // فاتورة كاملة للعميل
        const totalAmount = calculateTotal(cart);
        const mainInvoiceText = generateInvoiceText(cart, mainInvoiceNumber, totalAmount, null);
        invoices.push({
            text: mainInvoiceText,
            type: 'main',
            invoiceNumber: mainInvoiceNumber,
            items: cart,
            total: totalAmount,
            categoryName: null
        });
        
        // فاتورة لكل قسم
        const groupedItems = groupItemsByCategory();
        groupedItems.forEach((group, index) => {
            const groupTotal = calculateTotal(group.items);
            const subInvoiceNumber = `${mainInvoiceNumber}-${index + 1}`;
            const subInvoiceText = generateInvoiceText(
                group.items,
                subInvoiceNumber,
                groupTotal,
                group.categoryName
            );
            invoices.push({
                text: subInvoiceText,
                type: 'category',
                categoryName: group.categoryName,
                invoiceNumber: subInvoiceNumber,
                items: group.items,
                total: groupTotal
            });
        });
    } else {
        // فاتورة واحدة فقط
        const totalAmount = calculateTotal(cart);
        const invoiceText = generateInvoiceText(cart, mainInvoiceNumber, totalAmount, null);
        invoices.push({
            text: invoiceText,
            type: 'single',
            invoiceNumber: mainInvoiceNumber,
            items: cart,
            total: totalAmount,
            categoryName: null
        });
    }
    
    // اختيار طريقة الطباعة حسب نظام التشغيل
    if (os === 'Android') {
        printOnAndroid(invoices);
    } else {
        // Windows, Mac, Linux, أو أي نظام آخر
        printOnWindows(invoices);
    }
}

// Admin Panel Functions
function openAdminModal() {
    // تحقق من المصادقة - هل كلمة المرور موجودة في sessionStorage
    if (!getAdminKey()) {
        const attempt = prompt('أدخل كلمة المرور للوصول إلى لوحة التحكم:');
        if (attempt === null) return; // user cancelled
        if (!attempt) {
            showToast('يرجى إدخال كلمة المرور', 'error');
            return;
        }
        // نحفظ كلمة المرور مؤقتاً ونختبرها
        setAdminKey(attempt);
        
        // تحقق من صحة كلمة المرور بمحاولة كتابة في Firebase
        if (_firebaseReady) {
            get(settingsRef).then((snapshot) => {
                const currentSettings = snapshot.val() || {};
                const testData = { ...currentSettings, admin_key: attempt };
                set(settingsRef, testData)
                    .then(() => {
                        // كلمة المرور صحيحة
                        adminAuthenticated = true;
                        showToast('تم تسجيل الدخول بنجاح ✓', 'success');
                        showAdminPanelUI();
                    })
                    .catch(() => {
                        setAdminKey(null);
                        adminAuthenticated = false;
                        showToast('كلمة المرور خاطئة', 'error');
                    });
            }).catch(() => {
                setAdminKey(null);
                showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
            });
        } else {
            setAdminKey(null);
            showToast('Firebase غير متصل', 'error');
        }
        return;
    }

    showAdminPanelUI();
}

function showAdminPanelUI() {

    renderAdminPanel();

    // تحميل حالة إعداد تقسيم الفاتورة
    // Load split invoice setting state
    const splitCheckbox = document.getElementById('splitInvoiceCheckbox');
    if (splitCheckbox) {
        splitCheckbox.checked = splitInvoice === true;
        // إضافة معالج التغيير (in-memory)
        splitCheckbox.onchange = function() {
            splitInvoice = this.checked;
            saveSettings();
            const status = this.checked ? 'مفعّل' : 'معطّل';
            showToast(`تقسيم الفاتورة: ${status}`, 'success');
        };
    }
    
    // تحميل حالة إعداد طريقة الطباعة
    // Load print method setting state
    const savedPrintMethod = getPrintMethod();
    const printMethodImage = document.getElementById('printMethodImage');
    const printMethodText = document.getElementById('printMethodText');

    if (printMethodImage && printMethodText) {
        // تعيين التحديد من المتغير في الذاكرة
        if (savedPrintMethod === 'image') {
            printMethodImage.checked = true;
        } else {
            printMethodText.checked = true;
        }

        // معالج التغيير (in-memory)
        printMethodImage.onchange = function() {
            if (this.checked) {
                printMethod = 'image';
                saveSettings();
                showToast('تم اختيار: طباعة بالصورة ✓', 'success');
            }
        };

        printMethodText.onchange = function() {
            if (this.checked) {
                printMethod = 'text';
                saveSettings();
                showToast('تم اختيار: طباعة نصية ⚠️', 'success');
            }
        };
    }
    
    // تحميل قائمة الخطوط
    const fontSelector = document.getElementById('fontSelector');
    if (fontSelector) {
        fontSelector.innerHTML = '';
        availableFonts.forEach(font => {
            const option = document.createElement('option');
            option.value = font.id;
            option.textContent = font.name;
            option.style.fontFamily = font.family;
            if (font.id === appFont) option.selected = true;
            fontSelector.appendChild(option);
        });
        
        fontSelector.onchange = function() {
            const selectedId = this.value;
            applyFont(selectedId);
            saveSettings();
            const font = availableFonts.find(f => f.id === selectedId);
            showToast(`تم تغيير الخط إلى: ${font ? font.name : selectedId} ✓`, 'success');
        };
    }
    
    document.getElementById('adminModal').classList.add('active');
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.remove('active');
}

// Change admin password from admin settings
function changeAdminPassword(e) {
    if (e && e.preventDefault) e.preventDefault();
    const newEl = document.getElementById('newAdminPassword');
    const confEl = document.getElementById('confirmAdminPassword');
    if (!newEl || !confEl) return;
    const newPass = newEl.value.trim();
    const conf = confEl.value.trim();
    if (!newPass) {
        showToast('يرجى إدخال كلمة المرور الجديدة', 'error');
        return;
    }
    if (newPass !== conf) {
        showToast('كلمة المرور وتأكيدها غير متطابقين', 'error');
        return;
    }
    
    if (!_firebaseReady || !getAdminKey()) {
        showToast('يجب تسجيل الدخول أولاً', 'error');
        return;
    }
    
    // نستخدم كلمة المرور الحالية (getAdminKey()) كمفتاح، ونحفظ الجديدة
    const currentKey = getAdminKey();
    const settingsToSave = {
        splitInvoice,
        printMethod,
        invoiceCounter,
        admin_password: newPass,
        admin_key: currentKey,
        viewMode,
        appFont
    };
    
    set(settingsRef, settingsToSave)
        .then(() => {
            setAdminKey(newPass); // المفتاح الجديد للكتابة المستقبلية
            newEl.value = '';
            confEl.value = '';
            showToast('تم تغيير كلمة مرور لوحة التحكم بنجاح ✓', 'success');
        })
        .catch((error) => {
            console.error('خطأ في حفظ كلمة المرور:', error);
            showToast('فشل حفظ كلمة المرور - تحقق من الصلاحيات', 'error');
        });
}

function openAdminForm(mode, id = null) {
    adminFormMode = mode;
    editingCategoryId = null;

    const modal = document.getElementById('adminFormModal');
    const title = document.getElementById('adminFormTitle');
    const nameInput = document.getElementById('adminItemName');
    const imageInput = document.getElementById('adminItemImage');
    const priceGroup = document.getElementById('adminProductPriceGroup');
    const priceInput = document.getElementById('adminProductPrice');
    const categoryGroup = document.getElementById('adminProductCategoryGroup');
    const categorySelect = document.getElementById('adminProductCategory');

    nameInput.value = '';
    imageInput.value = '';
    priceInput.value = '';
    categorySelect.innerHTML = '';

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });

    nameInput.oninput = function() {
        if (!imageInput.dataset.manual) {
            const suggested = this.value.trim();
            imageInput.value = suggested ? `${suggested}.jpg` : '';
        }
    };

    imageInput.oninput = function() {
        imageInput.dataset.manual = imageInput.value.trim() ? '1' : '';
    };

    if (mode === 'category-add') {
        title.textContent = 'إضافة قسم جديد';
        categoryGroup.style.display = 'none';
        priceGroup.style.display = 'none';
    }

    if (mode === 'category-edit') {
        const category = categories.find(c => c.id === id);
        if (!category) return;
        editingCategoryId = id;
        title.textContent = 'تعديل القسم';
        nameInput.value = category.name;
        imageInput.value = category.image || '';
        imageInput.dataset.manual = imageInput.value.trim() ? '1' : '';
        categoryGroup.style.display = 'none';
        priceGroup.style.display = 'none';
    }

    if (mode === 'product-add') {
        title.textContent = 'إضافة منتج جديد';
        categoryGroup.style.display = '';
        priceGroup.style.display = '';
        priceInput.required = true;
    }

    modal.classList.add('active');
}

function resetInvoiceCounter() {
    // Reset invoice counter and save to Firebase
    invoiceCounter = 0;
    saveSettings();
    showToast('تمت إعادة تعيين عداد الفواتير. الفاتورة التالية ستكون رقم 1', 'success');
}

function closeAdminForm() {
    const modal = document.getElementById('adminFormModal');
    modal.classList.remove('active');
    document.getElementById('adminForm').reset();
    adminFormMode = null;
    editingCategoryId = null;
}

function saveAdminForm(e) {
    e.preventDefault();

    const nameInput = document.getElementById('adminItemName');
    const imageInput = document.getElementById('adminItemImage');
    const priceInput = document.getElementById('adminProductPrice');
    const categorySelect = document.getElementById('adminProductCategory');

    const name = nameInput.value.trim();
    const imageValue = imageInput.value.trim() || (name ? `${name}.jpg` : '');

    if (!name) return;

    if (adminFormMode === 'category-add') {
        const newCategory = {
            id: Math.max(...categories.map(c => c.id), 0) + 1,
            name: name,
            image: imageValue ? (imageValue.startsWith('images/') ? imageValue : 'images/' + imageValue) : 'images/default.jpg'
        };
        categories.push(newCategory);
        saveData();
        renderCategories();
        renderAdminPanel();
        closeAdminForm();
        return;
    }

    if (adminFormMode === 'category-edit' && editingCategoryId) {
        const category = categories.find(c => c.id === editingCategoryId);
        if (!category) return;
        const oldName = category.name;
        // Update name
        category.name = name;
        if (imageValue) {
            category.image = imageValue.startsWith('images/') ? imageValue : 'images/' + imageValue;
        } else if (category.image) {
            // If the existing image filename contains the old name, update it to the new name
            try {
                const parts = category.image.split('/');
                const filename = parts.pop();
                const idx = filename.lastIndexOf('.');
                const base = idx !== -1 ? filename.substring(0, idx) : filename;
                const ext = idx !== -1 ? filename.substring(idx) : '';
                if (base === oldName) {
                    const newFilename = name + ext;
                    parts.push(newFilename);
                    category.image = parts.join('/');
                }
            } catch (e) {
                // ignore errors and keep existing image
            }
        }
        saveData();
        renderCategories();
        renderAdminPanel();
        closeAdminForm();
        return;
    }

    if (adminFormMode === 'product-add') {
        const categoryId = parseInt(categorySelect.value);
        const basePrice = parseFloat(priceInput.value);
        if (!categoryId || isNaN(basePrice)) return;
        // By default use single size 'عادي'. Use clipboard sizes ONLY if admin explicitly pasted them.
        let sizesForNew = [{ name: 'عادي', price: basePrice }];
        if (adminSizesClipboardUsed) {
            try {
                const clipboard = sizesClipboard;
                if (clipboard && Array.isArray(clipboard) && clipboard.length > 0) {
                    sizesForNew = clipboard.map(s => ({ name: s.name || 'عادي', price: (typeof s.price === 'number' ? s.price : basePrice) }));
                }
            } catch (e) {
                console.error('خطأ عند قراءة الحافظة:', e);
            }
        }

        const newProduct = {
            id: Math.max(...products.map(p => p.id), 0) + 1,
            name: name,
            categoryId: categoryId,
            image: imageValue ? (imageValue.startsWith('images/') ? imageValue : 'images/' + imageValue) : 'images/default.jpg',
            basePrice: basePrice,
            sizes: sizesForNew
        };
        products.push(newProduct);
        saveData();
        renderProducts();
        renderAdminPanel();
        closeAdminForm();
        // reset flag after use so future adds won't auto-apply clipboard
        adminSizesClipboardUsed = false;
    }
}

// Copy current editing product sizes to localStorage clipboard
function copySizes() {
    if (!editingProductId) {
        console.warn('لا يوجد منتج مفتوح للنسخ');
        return;
    }
    const product = products.find(p => p.id === editingProductId);
    if (!product || !product.sizes) {
        console.warn('لا توجد أحجام للنسخ');
        return;
    }
    try {
        sizesClipboard = JSON.parse(JSON.stringify(product.sizes));
        console.log('تم نسخ الأحجام إلى الحافظة (في الذاكرة)');
    } catch (e) {
        console.error(e);
        console.error('تعذر نسخ الأحجام');
    }
}

// Paste clipboard sizes into current edit product and re-render
function pasteSizesIntoEdit() {
    if (!editingProductId) {
        console.warn('لا يوجد منتج مفتوح للصق');
        return;
    }
    try {
        const clipboard = sizesClipboard;
        if (!clipboard || !Array.isArray(clipboard) || clipboard.length === 0) {
            console.warn('لا توجد أحجام في الحافظة');
            return;
        }
        const product = products.find(p => p.id === editingProductId);
        product.sizes = clipboard.map(s => ({ name: s.name || 'عادي', price: (typeof s.price === 'number' ? s.price : 0) }));
        renderSizesForEdit(product);
        console.log('تم لصق الأحجام');
    } catch (e) {
        console.error(e);
        console.error('تعذر لصق الأحجام');
    }
}

// Paste sizes into admin add form preview area (doesn't save until form submit)
function pasteSizesIntoAdminForm() {
    try {
        const clipboard = sizesClipboard;
        const preview = document.getElementById('adminSizesPreview');
        if (!clipboard || !Array.isArray(clipboard) || clipboard.length === 0) {
            if (preview) preview.textContent = 'لا توجد أحجام في الحافظة';
            console.warn('لا توجد أحجام في الحافظة');
            return;
        }
        if (preview) {
            preview.innerHTML = clipboard.map(s => `${s.name || 'عادي'}: ${formatPrice(typeof s.price === 'number' ? s.price : 0)}`).join(' · ');
        }
        // mark that admin explicitly pasted sizes (so saveAdminForm will use them)
        adminSizesClipboardUsed = true;
        console.log('تم لصق المعاينة في النموذج (من الذاكرة)');
    } catch (e) {
        console.error(e);
        console.error('تعذر لصق الأحجام في النموذج');
    }
}

// نسخ أسعار نوع معين
function copyTypeSpecificSizes(type, sizes) {
    if (!sizes || !Array.isArray(sizes) || sizes.length === 0) {
        showToast('لا توجد أسعار للنسخ', 'error');
        return;
    }
    try {
        typeSpecificSizesClipboard = {
            type: type,
            sizes: JSON.parse(JSON.stringify(sizes)) // deep copy
        };
        showToast(`تم نسخ أسعار: ${type}`, 'success');
        console.log('تم نسخ الأسعار الخاصة:', typeSpecificSizesClipboard);
    } catch (e) {
        console.error('خطأ في نسخ الأسعار:', e);
        showToast('فشل نسخ الأسعار', 'error');
    }
}

// لصق أسعار في نوع معين
function pasteTypeSpecificSizes(product, targetType) {
    if (!typeSpecificSizesClipboard || !typeSpecificSizesClipboard.sizes) {
        showToast('لا توجد أسعار في الحافظة', 'error');
        return;
    }
    try {
        if (!product.typeSpecificSizes) {
            product.typeSpecificSizes = {};
        }
        product.typeSpecificSizes[targetType] = JSON.parse(JSON.stringify(typeSpecificSizesClipboard.sizes));
        renderTypeSpecificPricing(product);
        showToast(`تم لصق الأسعار في: ${targetType}`, 'success');
        console.log('تم لصق الأسعار في:', targetType);
    } catch (e) {
        console.error('خطأ في لصق الأسعار:', e);
        showToast('فشل لصق الأسعار', 'error');
    }
}

// Helpers to generate new IDs
function getNewProductId() {
    return (products && products.length ? Math.max(...products.map(p => p.id)) : 0) + 1;
}

function getNewCategoryId() {
    return (categories && categories.length ? Math.max(...categories.map(c => c.id)) : 0) + 1;
}

// Copy selected category and its products to localStorage (and navigator clipboard if available)
function copyCategory() {
    try {
        const sel = document.getElementById('categorySelect');
        if (!sel) return showToast('لم يتم تحديد قسم للنسخ', 'error');
        const categoryId = parseInt(sel.value);
        const category = categories.find(c => c.id === categoryId);
        if (!category) return showToast('القسم غير موجود', 'error');
        const catProducts = products.filter(p => p.categoryId === categoryId);
        const payload = { category: category, products: catProducts };
        const payloadStr = JSON.stringify(payload);
        try {
            categoryClipboard = payloadStr;
        } catch (e) { console.warn('clipboard storage unavailable', e); }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(payloadStr).then(() => {
                showToast('تم نسخ بيانات القسم إلى الحافظة', 'success');
            }).catch(() => {
                showToast('تم حفظ بيانات القسم محلياً', 'success');
            });
        } else {
            showToast('تم حفظ بيانات القسم محلياً', 'success');
        }
    } catch (e) {
        console.error('خطأ في نسخ القسم:', e);
        showToast('فشل نسخ القسم', 'error');
    }
}

// Paste category data: adds products to the selected category or creates a new category if none selected
async function pasteCategory() {
    try {
        let dataText = null;
        if (navigator.clipboard && navigator.clipboard.readText) {
            try { dataText = await navigator.clipboard.readText(); } catch (e) { dataText = null; }
        }
        let payload = null;
        if (dataText) {
            try { payload = JSON.parse(dataText); } catch (e) { payload = null; }
        }
        if (!payload) {
            const stored = categoryClipboard;
            if (stored) payload = JSON.parse(stored);
        }
        if (!payload) return showToast('لا توجد بيانات قسم في الحافظة', 'error');

        const srcProducts = Array.isArray(payload.products) ? payload.products : [];
        const srcCategory = payload.category || {};

        const sel = document.getElementById('categorySelect');
        let targetCategoryId = sel ? parseInt(sel.value) : null;
        // If selected category doesn't exist, create a new one
        if (!targetCategoryId || !categories.some(c => c.id === targetCategoryId)) {
            targetCategoryId = getNewCategoryId();
            const newCat = {
                id: targetCategoryId,
                name: srcCategory.name ? srcCategory.name + ' - نسخة' : 'قسم منسوخ',
                image: srcCategory.image || 'images/default.jpg'
            };
            categories.push(newCat);
        }

        // Append copied products into target category (generate new product ids)
        srcProducts.forEach(src => {
            const newId = getNewProductId();
            const copy = JSON.parse(JSON.stringify(src));
            copy.id = newId;
            copy.categoryId = targetCategoryId;
            products.push(copy);
        });

        saveData();
        renderCategories();
        renderProducts();
        renderAdminPanel();
        showToast('تم لصق بيانات القسم بنجاح', 'success');
    } catch (e) {
        console.error('خطأ في لصق القسم:', e);
        showToast('فشل لصق بيانات القسم', 'error');
    }
}

// Copy specific category by id
function copyCategoryById(categoryId) {
    try {
        const category = categories.find(c => c.id === categoryId);
        if (!category) return showToast('القسم غير موجود', 'error');
        const catProducts = products.filter(p => p.categoryId === categoryId);
        const payload = { category: category, products: catProducts };
        const payloadStr = JSON.stringify(payload);
        try { categoryClipboard = payloadStr; } catch (e) { console.warn('clipboard storage unavailable', e); }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(payloadStr).then(() => {
                showToast('تم نسخ بيانات القسم إلى الحافظة', 'success');
            }).catch(() => {
                showToast('تم حفظ بيانات القسم محلياً', 'success');
            });
        } else {
            showToast('تم حفظ بيانات القسم محلياً', 'success');
        }
    } catch (e) {
        console.error('خطأ في نسخ القسم:', e);
        showToast('فشل نسخ القسم', 'error');
    }
}

// Paste clipboard into a specific existing category (creates products under that category)
async function pasteCategoryInto(targetCategoryId) {
    try {
        if (!categories.some(c => c.id === targetCategoryId)) return showToast('القسم الهدف غير موجود', 'error');
        let dataText = null;
        if (navigator.clipboard && navigator.clipboard.readText) {
            try { dataText = await navigator.clipboard.readText(); } catch (e) { dataText = null; }
        }
        let payload = null;
        if (dataText) {
            try { payload = JSON.parse(dataText); } catch (e) { payload = null; }
        }
        if (!payload) {
            const stored = categoryClipboard;
            if (stored) payload = JSON.parse(stored);
        }
        if (!payload) return showToast('لا توجد بيانات قسم في الحافظة', 'error');

        const srcProducts = Array.isArray(payload.products) ? payload.products : [];
        // Append copied products into target category
        srcProducts.forEach(src => {
            const newId = getNewProductId();
            const copy = JSON.parse(JSON.stringify(src));
            copy.id = newId;
            copy.categoryId = targetCategoryId;
            products.push(copy);
        });

        saveData();
        renderCategories();
        renderProducts();
        renderAdminPanel();
        showToast('تم لصق بيانات القسم في الهدف بنجاح', 'success');
    } catch (e) {
        console.error('خطأ في لصق القسم:', e);
        showToast('فشل لصق بيانات القسم', 'error');
    }
}

function renderAdminPanel() {
    const categorySelect = document.getElementById('categorySelect');
    if (!categorySelect) return;
    
    const previouslySelected = categorySelect.value ? parseInt(categorySelect.value) : null;
    categorySelect.innerHTML = '';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });

    if (categories.length > 0) {
        const stillExists = categories.some(c => c.id === previouslySelected);
        categorySelect.value = stillExists ? previouslySelected : categories[0].id;
    }
    
    // Render categories in admin
    const adminCategoriesList = document.getElementById('adminCategoriesList');
    if (adminCategoriesList) {
        adminCategoriesList.innerHTML = '';
        categories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category-item';
            // حالة القسم
            const availabilityStatus = category.disabled ? '⏸️ <span style="color:#dc3545;font-weight:bold;">متوقف</span>' : '✅ <span style="color:#28a745;font-weight:bold;">متاح</span>';
            categoryDiv.innerHTML = `
                <div class="item-info">
                    <div class="item-name">${category.name}</div>
                    <div class="item-image">${category.image}</div>
                    <div class="item-status">الحالة: ${availabilityStatus}</div>
                </div>
                <div class="item-actions">
                    <button class="edit-btn" onclick="editCategory(${category.id})">تعديل</button>
                    <button class="${category.disabled ? 'success-btn' : 'warning-btn'}" onclick="toggleCategoryAvailability(${category.id})">${category.disabled ? '▶️ تفعيل' : '⏸️ إيقاف مؤقت'}</button>
                    <button class="copy-btn" onclick="copyCategoryById(${category.id})">نسخ</button>
                    <button class="paste-btn" onclick="pasteCategoryInto(${category.id})">لصق هنا</button>
                    <button class="delete-btn" onclick="deleteCategory(${category.id})">حذف</button>
                </div>
            `;
            adminCategoriesList.appendChild(categoryDiv);
        });
    }
    
    // Render products in admin
    const categoryId = parseInt(categorySelect.value);
    const adminProductsList = document.getElementById('adminProductsList');
    if (adminProductsList) {
        const filteredProducts = products.filter(p => p.categoryId === categoryId);
        adminProductsList.innerHTML = '';
        if (filteredProducts.length === 0) {
            adminProductsList.innerHTML = `<p style="text-align:center;color:#999;padding:15px;">لا توجد منتجات في هذا القسم</p>`;
            return;
        }
        filteredProducts.forEach(product => {
            const productDiv = document.createElement('div');
            productDiv.className = 'product-item';
            const sizeCount = product.sizes ? product.sizes.length : 0;
            
            let sizesHTML = '';
            if (product.sizes && product.sizes.length > 0) {
                sizesHTML = '<div class="sizes-list">';
                product.sizes.forEach((size, idx) => {
                    sizesHTML += `
                        <div class="size-row">
                            <span>${size.name} - ${formatPrice(size.price)}</span>
                            <div class="size-actions">
                                <button class="edit-btn" style="padding: 4px 8px; font-size: 12px;" onclick="editSize(${product.id}, ${idx})">تعديل</button>
                                <button class="delete-btn" style="padding: 4px 8px; font-size: 12px;" onclick="deleteSize(${product.id}, ${idx})">حذف</button>
                            </div>
                        </div>
                    `;
                });
                sizesHTML += '</div>';
            }
            
            const currentCategory = categories.find(c => c.id === product.categoryId);
            const categoryName = currentCategory ? currentCategory.name : 'غير محدد';
            
            const badgeLabels = { 'new': '🟢 جديد', 'best': '🔴 الأكثر مبيعاً', 'offer': '🟡 عرض خاص' };
            const badgeText = product.badge && badgeLabels[product.badge] ? ` | الشارة: ${badgeLabels[product.badge]}` : '';
            
            const availabilityStatus = product.disabled ? '⏸️ <span style="color:#dc3545;font-weight:bold;">متوقف</span>' : '✅ <span style="color:#28a745;font-weight:bold;">متاح</span>';
            
            productDiv.innerHTML = `
                <div class="item-info">
                    <div class="item-name">${product.name}</div>
                    <div class="item-image">القسم: ${categoryName} | السعر: ${formatPrice(product.basePrice)} | المقاسات: ${formatNumber(sizeCount)}${badgeText} | الحالة: ${availabilityStatus}</div>
                    ${sizesHTML}
                </div>
                <div class="item-actions">
                    <button class="edit-btn" onclick="editProduct(${product.id})">تعديل</button>
                    <button class="add-btn" onclick="addSizeToProduct(${product.id})">+ إضافة حجم</button>
                    <button class="${product.disabled ? 'success-btn' : 'warning-btn'}" onclick="toggleProductAvailability(${product.id})">${product.disabled ? '▶️ تفعيل' : '⏸️ إيقاف مؤقت'}</button>
                    <button class="delete-btn" onclick="deleteProduct(${product.id})">حذف</button>
                </div>
            `;
            adminProductsList.appendChild(productDiv);
        });
    }
}

function addCategory() {
    openAdminForm('category-add');
}

function addProduct() {
    openAdminForm('product-add');
}

function editCategory(categoryId) {
    openAdminForm('category-edit', categoryId);
}

function deleteCategory(categoryId) {
    if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
    
    categories = categories.filter(c => c.id !== categoryId);
    products = products.filter(p => p.categoryId !== categoryId);
    saveData();
    renderCategories();
    renderProducts();
    renderAdminPanel();
    showToast('تم الحذف بنجاح', 'success');
}

function editProduct(productId) {
    openEditProductModal(productId);
}

function openEditProductModal(productId) {
    const product = products.find(p => p.id === productId);
    console.log('openEditProductModal called for id', productId, 'found:', !!product);
    if (!product) return;

    editingProductId = productId;
    _suppressFirebaseSync = true; // منع Firebase من إعادة كتابة البيانات أثناء التعديل

    // ملء بيانات النموذج
    const nameInput = document.getElementById('productName');
    if (nameInput) nameInput.value = product.name;

    // ملء الشارة
    const badgeSelect = document.getElementById('productBadge');
    if (badgeSelect) badgeSelect.value = product.badge || '';

    // ملء قائمة الأقسام
    const categorySelect = document.getElementById('productCategory');
    if (categorySelect) {
        categorySelect.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            if (cat.id === product.categoryId) {
                option.selected = true;
            }
            categorySelect.appendChild(option);
        });
    } else {
        console.warn('productCategory select not found in DOM');
    }

    // عرض الأحجام والأسعار
    renderSizesForEdit(product);
    
    // عرض الأنواع
    renderTypesForEdit(product);
    
    // عرض سطور الأنواع الإضافية (المجموعات)
    renderTypeGroupsForEdit(product);
    
    // إعداد التسعير الخاص بالأنواع
    setupTypeSpecificPricing(product);

    // أغلق لوحة الإدارة إذا كانت مفتوحة ثم افتح نموذج التعديل
    if (typeof closeAdminModal === 'function') closeAdminModal();
    const modal = document.getElementById('editProductModal');
    if (modal) modal.classList.add('active');
}

function renderSizesForEdit(product) {
    const sizesList = document.getElementById('editSizesList');
    if (!sizesList) {
        console.warn('editSizesList container not found in DOM');
        return;
    }
    sizesList.innerHTML = '';
    sizesList.style.display = '';
    
    if (!product.sizes || product.sizes.length === 0) {
        product.sizes = [{ name: 'افتراضي', price: product.basePrice }];
    }
    console.log('renderSizesForEdit for product', product.id, 'sizes:', product.sizes);
    // عرض رسالة توضيحية داخل النموذج
    const infoLine = document.createElement('div');
    infoLine.style.fontSize = '13px';
    infoLine.style.color = '#7a5a40';
    infoLine.style.marginBottom = '8px';
    infoLine.textContent = `عدد الأحجام: ${product.sizes.length}`;
    sizesList.appendChild(infoLine);
    
    product.sizes.forEach((size, index) => {
        const sizeRow = document.createElement('div');
        sizeRow.className = 'size-row';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-size-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            product.sizes.splice(index, 1);
            renderSizesForEdit(product);
        };
        
        const sizeNameInput = document.createElement('input');
        sizeNameInput.type = 'text';
        sizeNameInput.placeholder = 'المقاس';
        sizeNameInput.value = size.name;
        sizeNameInput.oninput = (e) => {
            product.sizes[index].name = e.target.value;
        };
        
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.step = '0.01';
        priceInput.placeholder = 'السعر';
        priceInput.value = size.price;
        priceInput.oninput = (e) => {
            product.sizes[index].price = parseFloat(e.target.value) || 0;
        };
        
        sizeRow.appendChild(deleteBtn);
        sizeRow.appendChild(sizeNameInput);
        sizeRow.appendChild(priceInput);
        sizesList.appendChild(sizeRow);
    });

    // إذا لم تكن هناك أحجام بعد العرض، أظهر رسالة واضحة
    if (product.sizes.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.textContent = 'لا توجد أحجام. اضغط "أضف حجم أخر" لإضافة حجم جديد.';
        emptyMsg.style.color = '#b35050';
        emptyMsg.style.marginTop = '8px';
        sizesList.appendChild(emptyMsg);
    }
}

function addNewSize() {
    if (!editingProductId) {
        console.log('لا يوجد منتج يتم تحريره');
        return;
    }
    
    const product = products.find(p => p.id === editingProductId);
    if (!product) {
        console.log('لم يتم العثور على المنتج');
        return;
    }
    
    if (!product.sizes) {
        product.sizes = [];
    }
    
    product.sizes.push({ name: '', price: 0 });
    renderSizesForEdit(product);
}

function renderTypesForEdit(product) {
    const typesList = document.getElementById('editTypesList');
    if (!typesList) {
        console.warn('editTypesList container not found in DOM');
        return;
    }
    typesList.innerHTML = '';
    
    if (!product.types) {
        product.types = [];
    }
    
    if (!product.typeSpecificPricingEnabled) {
        product.typeSpecificPricingEnabled = {};
    }
    
    product.types.forEach((type, index) => {
        const typeRow = document.createElement('div');
        typeRow.className = 'type-row';
        typeRow.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 12px;';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-size-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const oldType = product.types[index];
            product.types.splice(index, 1);
            
            // حذف الأسعار الخاصة بهذا النوع
            if (product.typeSpecificSizes && oldType) {
                delete product.typeSpecificSizes[oldType];
            }
            if (product.typeSpecificPricingEnabled && oldType) {
                delete product.typeSpecificPricingEnabled[oldType];
            }
            
            saveData();
            renderTypesForEdit(product);
            renderTypeSpecificPricing(product);
        };
        
        const typeInput = document.createElement('input');
        typeInput.type = 'text';
        typeInput.placeholder = 'النوع (مثال: حراق، عادي)';
        typeInput.value = type;
        typeInput.style.flex = '1';
        
        let lastValue = type;
        typeInput.oninput = (e) => {
            const newValue = e.target.value;
            product.types[index] = newValue;
            
            // تحديث مفتاح الأسعار الخاصة
            if (product.typeSpecificSizes && lastValue && lastValue !== newValue) {
                if (product.typeSpecificSizes[lastValue]) {
                    product.typeSpecificSizes[newValue] = product.typeSpecificSizes[lastValue];
                    delete product.typeSpecificSizes[lastValue];
                }
            }
            // تحديث مفتاح التفعيل
            if (product.typeSpecificPricingEnabled && lastValue && lastValue !== newValue) {
                if (product.typeSpecificPricingEnabled[lastValue] !== undefined) {
                    product.typeSpecificPricingEnabled[newValue] = product.typeSpecificPricingEnabled[lastValue];
                    delete product.typeSpecificPricingEnabled[lastValue];
                }
            }
            lastValue = newValue; // تحديث القيمة الأخيرة
        };
        
        typeInput.onblur = () => {
            saveData();
            renderTypeSpecificPricing(product);
        };
        
        // زر التفعيل/التعطيل لهذا النوع
        const toggleContainer = document.createElement('label');
        toggleContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; background: #fff3cd; padding: 8px 12px; border-radius: 6px; cursor: pointer; white-space: nowrap; border: 2px solid #ffc107;';
        
        const toggleCheckbox = document.createElement('input');
        toggleCheckbox.type = 'checkbox';
        toggleCheckbox.checked = product.typeSpecificPricingEnabled[type] || false;
        toggleCheckbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
        toggleCheckbox.onchange = () => {
            product.typeSpecificPricingEnabled[type] = toggleCheckbox.checked;
            
            // تهيئة الأسعار الخاصة إذا لم تكن موجودة
            if (toggleCheckbox.checked) {
                if (!product.typeSpecificSizes) {
                    product.typeSpecificSizes = {};
                }
                if (!product.typeSpecificSizes[type]) {
                    product.typeSpecificSizes[type] = [{ name: 'عادي', price: 0 }];
                }
            }
            
            // حفظ البيانات مباشرة
            saveData();
            
            renderTypeSpecificPricing(product);
        };
        
        const toggleLabel = document.createElement('span');
        toggleLabel.textContent = '💰 أسعار خاصة';
        toggleLabel.style.cssText = 'font-size: 12px; font-weight: 600;';
        
        toggleContainer.appendChild(toggleCheckbox);
        toggleContainer.appendChild(toggleLabel);
        
        // زر إيقاف/تفعيل النوع
        if (!product.disabledTypes) {
            product.disabledTypes = [];
        }
        
        const availabilityBtn = document.createElement('button');
        availabilityBtn.type = 'button';
        const isDisabled = product.disabledTypes.includes(type);
        availabilityBtn.className = isDisabled ? 'success-btn' : 'warning-btn';
        availabilityBtn.textContent = isDisabled ? '▶️ تفعيل' : '⏸️ إيقاف';
        availabilityBtn.style.cssText = 'padding: 6px 10px; font-size: 11px; border-radius: 6px; cursor: pointer; border: none; color: white; font-weight: bold; white-space: nowrap;';
        availabilityBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!product.disabledTypes) {
                product.disabledTypes = [];
            }
            
            const idx = product.disabledTypes.indexOf(type);
            if (idx > -1) {
                // تفعيل النوع
                product.disabledTypes.splice(idx, 1);
                availabilityBtn.className = 'warning-btn';
                availabilityBtn.textContent = '⏸️ إيقاف';
                showToast('تم تفعيل النوع', 'success');
            } else {
                // إيقاف النوع
                product.disabledTypes.push(type);
                availabilityBtn.className = 'success-btn';
                availabilityBtn.textContent = '▶️ تفعيل';
                showToast('تم إيقاف النوع مؤقتاً', 'success');
            }
            
            saveData();
            renderProducts();
        };
        
        typeRow.appendChild(deleteBtn);
        typeRow.appendChild(typeInput);
        typeRow.appendChild(toggleContainer);
        typeRow.appendChild(availabilityBtn);
        typesList.appendChild(typeRow);
    });
    
    if (product.types.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.textContent = 'لا توجد أنواع. اضغط "أضف نوع أخر" لإضافة نوع جديد.';
        emptyMsg.style.color = '#888';
        emptyMsg.style.marginTop = '8px';
        emptyMsg.style.fontSize = '13px';
        typesList.appendChild(emptyMsg);
    }
}

function addNewType() {
    if (!editingProductId) {
        console.log('لا يوجد منتج يتم تحريره');
        return;
    }
    
    const product = products.find(p => p.id === editingProductId);
    if (!product) {
        console.log('لم يتم العثور على المنتج');
        return;
    }
    
    if (!product.types) {
        product.types = [];
    }
    
    product.types.push('');
    // لا نحفظ هنا - ننتظر حتى يكتب المستخدم الاسم أو يضغط حفظ
    renderTypesForEdit(product);
    renderTypeSpecificPricing(product);
}

// ==================== إدارة سطور الأنواع الإضافية (مجموعات) ====================

function addNewTypeGroup() {
    if (!editingProductId) return;
    
    const product = products.find(p => p.id === editingProductId);
    if (!product) return;
    
    if (!product.typeGroups) {
        product.typeGroups = [];
    }
    
    product.typeGroups.push({ label: 'سطر ' + (product.typeGroups.length + 1), types: [''] });
    renderTypeGroupsForEdit(product);
}

function renderTypeGroupsForEdit(product) {
    const container = document.getElementById('editTypeGroupsList');
    if (!container) return;
    container.innerHTML = '';
    
    if (!product.typeGroups || product.typeGroups.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.textContent = 'لا توجد سطور إضافية. اضغط "+ أضف سطر أنواع جديد" لإضافة سطر.';
        emptyMsg.style.cssText = 'color: #888; margin-top: 8px; font-size: 13px;';
        container.appendChild(emptyMsg);
        return;
    }
    
    product.typeGroups.forEach((group, groupIndex) => {
        const groupCard = document.createElement('div');
        groupCard.style.cssText = 'background: #f0f7ff; border: 2px solid #3498db; border-radius: 10px; padding: 15px; margin-bottom: 15px;';
        
        // Header row: group label + delete button
        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 10px;';
        
        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.placeholder = 'اسم السطر (مثل: إضافات)';
        labelInput.value = group.label || '';
        labelInput.style.cssText = 'flex: 1; padding: 8px; border: 1px solid #3498db; border-radius: 6px; font-size: 14px; font-weight: 600;';
        labelInput.oninput = (e) => {
            product.typeGroups[groupIndex].label = e.target.value;
        };
        labelInput.onblur = () => {
            saveData();
        };
        
        const deleteGroupBtn = document.createElement('button');
        deleteGroupBtn.type = 'button';
        deleteGroupBtn.textContent = '🗑️ حذف السطر';
        deleteGroupBtn.style.cssText = 'padding: 8px 12px; font-size: 12px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;';
        deleteGroupBtn.onclick = () => {
            product.typeGroups.splice(groupIndex, 1);
            saveData();
            renderTypeGroupsForEdit(product);
        };
        
        headerRow.appendChild(labelInput);
        headerRow.appendChild(deleteGroupBtn);
        groupCard.appendChild(headerRow);
        
        // Type options within this group
        const typesContainer = document.createElement('div');
        
        if (!group.types) group.types = [];
        
        group.types.forEach((type, typeIndex) => {
            const typeRow = document.createElement('div');
            typeRow.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 8px;';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'delete-size-btn';
            deleteBtn.textContent = '✕';
            deleteBtn.onclick = () => {
                group.types.splice(typeIndex, 1);
                saveData();
                renderTypeGroupsForEdit(product);
            };
            
            const typeInput = document.createElement('input');
            typeInput.type = 'text';
            typeInput.placeholder = 'النوع (مثال: بدون رز)';
            typeInput.value = type;
            typeInput.style.cssText = 'flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px;';
            typeInput.oninput = (e) => {
                product.typeGroups[groupIndex].types[typeIndex] = e.target.value;
            };
            typeInput.onblur = () => {
                saveData();
            };
            
            // زر إيقاف/تفعيل النوع
            if (!group.disabledTypes) group.disabledTypes = [];
            
            const availBtn = document.createElement('button');
            availBtn.type = 'button';
            const isDisabled = group.disabledTypes.includes(type);
            availBtn.className = isDisabled ? 'success-btn' : 'warning-btn';
            availBtn.textContent = isDisabled ? '▶️ تفعيل' : '⏸️ إيقاف';
            availBtn.style.cssText = 'padding: 6px 10px; font-size: 11px; border-radius: 6px; cursor: pointer; border: none; color: white; font-weight: bold; white-space: nowrap;';
            availBtn.onclick = () => {
                if (!group.disabledTypes) group.disabledTypes = [];
                const idx = group.disabledTypes.indexOf(type);
                if (idx > -1) {
                    group.disabledTypes.splice(idx, 1);
                    showToast('تم تفعيل النوع', 'success');
                } else {
                    group.disabledTypes.push(type);
                    showToast('تم إيقاف النوع مؤقتاً', 'success');
                }
                saveData();
                renderTypeGroupsForEdit(product);
            };
            
            typeRow.appendChild(deleteBtn);
            typeRow.appendChild(typeInput);
            typeRow.appendChild(availBtn);
            typesContainer.appendChild(typeRow);
        });
        
        groupCard.appendChild(typesContainer);
        
        // "Add type" button for this group
        const addTypeBtn = document.createElement('button');
        addTypeBtn.type = 'button';
        addTypeBtn.className = 'add-more-btn';
        addTypeBtn.textContent = '+ أضف نوع';
        addTypeBtn.style.cssText = 'margin-top: 5px; font-size: 12px; padding: 6px 14px;';
        addTypeBtn.onclick = () => {
            group.types.push('');
            renderTypeGroupsForEdit(product);
        };
        groupCard.appendChild(addTypeBtn);
        
        container.appendChild(groupCard);
    });
}

// ==================== نهاية إدارة سطور الأنواع الإضافية ====================

function setupTypeSpecificPricing(product) {
    // إظهار قسم إدارة الأسعار دائماً
    const section = document.getElementById('typeSpecificPricingSection');
    if (section) {
        section.style.display = 'block';
    }
    
    // عرض الأسعار الخاصة
    renderTypeSpecificPricing(product);
}

function renderTypeSpecificPricing(product) {
    const container = document.getElementById('typeSpecificPricingContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!product.types || product.types.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">أضف أنواعاً أولاً لإدارة أسعارها</p>';
        return;
    }
    
    if (!product.typeSpecificSizes) {
        product.typeSpecificSizes = {};
    }
    
    if (!product.typeSpecificPricingEnabled) {
        product.typeSpecificPricingEnabled = {};
    }
    
    // عرض فقط الأنواع التي تم تفعيل الأسعار الخاصة لها
    const typesWithPricing = product.types.filter(type => 
        type && product.typeSpecificPricingEnabled[type]
    );
    
    if (typesWithPricing.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px; font-size: 13px;">💡 فعّل "أسعار خاصة" لأي نوع لإدارة أسعاره هنا</p>';
        return;
    }
    
    typesWithPricing.forEach(type => {
        if (!product.typeSpecificSizes[type]) {
            product.typeSpecificSizes[type] = [{ name: 'عادي', price: 0 }];
        }
        
        const card = document.createElement('div');
        card.className = 'type-pricing-card';
        
        // Header with title and copy/paste buttons
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--primary-orange);';
        
        const title = document.createElement('h4');
        title.textContent = `📋 أسعار: ${type}`;
        title.style.margin = '0';
        title.style.color = 'var(--primary-orange)';
        title.style.fontSize = '16px';
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = 'display: flex; gap: 6px;';
        
        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = '📋 نسخ';
        copyBtn.style.cssText = 'padding: 6px 12px; font-size: 12px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;';
        copyBtn.onclick = () => {
            copyTypeSpecificSizes(type, product.typeSpecificSizes[type]);
        };
        
        // Paste button
        const pasteBtn = document.createElement('button');
        pasteBtn.type = 'button';
        pasteBtn.className = 'paste-btn';
        pasteBtn.textContent = '📥 لصق';
        pasteBtn.style.cssText = 'padding: 6px 12px; font-size: 12px; background: #2ecc71; color: white; border: none; border-radius: 5px; cursor: pointer;';
        pasteBtn.onclick = () => {
            pasteTypeSpecificSizes(product, type);
        };
        
        buttonsContainer.appendChild(copyBtn);
        buttonsContainer.appendChild(pasteBtn);
        
        header.appendChild(title);
        header.appendChild(buttonsContainer);
        card.appendChild(header);
        
        const sizesContainer = document.createElement('div');
        sizesContainer.className = 'type-pricing-sizes';
        
        product.typeSpecificSizes[type].forEach((size, sizeIndex) => {
            const sizeRow = document.createElement('div');
            sizeRow.className = 'type-pricing-size-row';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'delete-size-btn';
            deleteBtn.textContent = '✕';
            deleteBtn.onclick = () => {
                product.typeSpecificSizes[type].splice(sizeIndex, 1);
                saveData();
                renderTypeSpecificPricing(product);
            };
            
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = 'المقاس';
            nameInput.value = size.name;
            nameInput.oninput = (e) => {
                product.typeSpecificSizes[type][sizeIndex].name = e.target.value;
            };
            nameInput.onblur = () => {
                saveData();
            };
            
            const priceInput = document.createElement('input');
            priceInput.type = 'number';
            priceInput.step = '0.01';
            priceInput.placeholder = 'السعر';
            priceInput.value = size.price;
            priceInput.oninput = (e) => {
                product.typeSpecificSizes[type][sizeIndex].price = parseFloat(e.target.value) || 0;
            };
            priceInput.onblur = () => {
                saveData();
            };
            
            sizeRow.appendChild(deleteBtn);
            sizeRow.appendChild(nameInput);
            sizeRow.appendChild(priceInput);
            sizesContainer.appendChild(sizeRow);
        });
        
        card.appendChild(sizesContainer);
        
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'type-pricing-add-btn';
        addBtn.textContent = '+ إضافة مقاس';
        addBtn.onclick = () => {
            product.typeSpecificSizes[type].push({ name: '', price: 0 });
            saveData();
            renderTypeSpecificPricing(product);
        };
        card.appendChild(addBtn);
        
        container.appendChild(card);
    });
}

function closeEditProductModal() {
    const modal = document.getElementById('editProductModal');
    modal.classList.remove('active');
    document.getElementById('editProductForm').reset();
    editingProductId = null;
    _suppressFirebaseSync = false; // إعادة تفعيل المزامنة
    // إعادة تحميل البيانات من Firebase
    resyncFromFirebase();
}

function saveEditedProduct(e) {
    e.preventDefault();
    
    if (!editingProductId) {
        showToast('خطأ: لم يتم تحديد المنتج', 'error');
        return;
    }
    
    const product = products.find(p => p.id === editingProductId);
    if (!product) return;
    
    const newName = document.getElementById('productName').value.trim();
    const newCategoryId = parseInt(document.getElementById('productCategory').value);
    
    // التحقق من البيانات
    if (!newName) {
        showToast('يجب إدخال اسم المنتج', 'error');
        return;
    }
    
    if (!categories.find(c => c.id === newCategoryId)) {
        showToast('يجب اختيار قسم صحيح', 'error');
        return;
    }
    
    if (!product.sizes || product.sizes.length === 0) {
        showToast('يجب إضافة حجم واحد على الأقل', 'error');
        return;
    }
    
    // تحديث بيانات المنتج
    const oldProductName = product.name;
    product.name = newName;
    product.categoryId = newCategoryId;
    product.basePrice = product.sizes[0].price;
    
    // تحديث الشارة
    const badgeSelect = document.getElementById('productBadge');
    if (badgeSelect) {
        product.badge = badgeSelect.value || '';
    }

    // If product has an image whose filename equals the old product name, update it to the new name
    if (product.image) {
        try {
            const parts = product.image.split('/');
            const filename = parts.pop();
            const idx = filename.lastIndexOf('.');
            const base = idx !== -1 ? filename.substring(0, idx) : filename;
            const ext = idx !== -1 ? filename.substring(idx) : '';
            if (base === oldProductName) {
                const newFilename = newName + ext;
                parts.push(newFilename);
                product.image = parts.join('/');
            }
        } catch (e) {
            // ignore and keep existing image
        }
    }
    
    _suppressFirebaseSync = false; // إعادة تفعيل المزامنة قبل الحفظ
    saveData();
    renderProducts();
    renderAdminPanel();
    closeEditProductModal();
}

function toggleProductAvailability(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    product.disabled = !product.disabled;
    saveData();
    renderProducts();
    renderAdminPanel();
    
    const statusMsg = product.disabled ? 'تم إيقاف الصنف مؤقتاً' : 'تم تفعيل الصنف';
    showToast(statusMsg, 'success');
}

function deleteProduct(productId) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    
    products = products.filter(p => p.id !== productId);
    saveData();
    renderProducts();
    renderAdminPanel();
    showToast('تم الحذف بنجاح', 'success');
}

function addSizeToProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const sizeName = prompt('أدخل اسم المقاس:');
    if (!sizeName) return;
    
    const price = parseFloat(prompt('أدخل السعر:'));
    if (isNaN(price)) return;
    
    if (!product.sizes) {
        product.sizes = [];
    }
    
    product.sizes.push({ name: sizeName, price: price });
    saveData();
    renderProducts();
    renderAdminPanel();
    showToast('تم إضافة المقاس بنجاح', 'success');
}

function editSize(productId, sizeIndex) {
    const product = products.find(p => p.id === productId);
    if (!product || !product.sizes || !product.sizes[sizeIndex]) return;
    
    const currentSize = product.sizes[sizeIndex];
    const newName = prompt('أدخل اسم المقاس الجديد:', currentSize.name);
    if (!newName) return;
    
    const newPrice = parseFloat(prompt('أدخل السعر الجديد:', currentSize.price));
    if (isNaN(newPrice)) return;
    
    product.sizes[sizeIndex] = { name: newName, price: newPrice };
    saveData();
    renderProducts();
    renderAdminPanel();
    showToast('تم تعديل المقاس بنجاح', 'success');
}

function deleteSize(productId, sizeIndex) {
    if (!confirm('هل أنت متأكد من حذف هذا المقاس؟')) return;
    
    const product = products.find(p => p.id === productId);
    if (!product || !product.sizes) return;
    
    product.sizes.splice(sizeIndex, 1);
    saveData();
    renderProducts();
    renderAdminPanel();
    showToast('تم حذف المقاس بنجاح', 'success');
}
// Update UI System Messages when language changes
function updateUIMessages(lang) {
    if (!window.getSystemMessage) return;
    
    // Update cart label
    const cartLabel = document.getElementById('cartLabel');
    if (cartLabel) {
        cartLabel.textContent = window.getSystemMessage('cartLabel', lang);
    }
    
    // Update cart title and subtitle if modal is open
    const cartTitle = document.getElementById('cartTitle');
    if (cartTitle) {
        cartTitle.textContent = window.getSystemMessage('cartTitle', lang);
    }
    
    const cartSubtitle = document.querySelector('.cart-subtitle');
    if (cartSubtitle) {
        cartSubtitle.textContent = window.getSystemMessage('cartSubtitle', lang);
    }
    
    // Update total label
    const totalLabel = document.getElementById('totalLabel');
    if (totalLabel) {
        totalLabel.textContent = window.getSystemMessage('totalLabel', lang) + ':';
    }
    
    // Update pay button
    const payBtn = document.getElementById('payBtn');
    if (payBtn) {
        payBtn.textContent = window.getSystemMessage('payBtn', lang);
    }
    
    // Update admin title
    const adminTitle = document.getElementById('adminTitle');
    if (adminTitle) {
        adminTitle.textContent = window.getSystemMessage('adminTitle', lang);
    }
    
    // Update categories manage title
    const categoriesManageTitle = document.getElementById('categoriesManageTitle');
    if (categoriesManageTitle) {
        categoriesManageTitle.textContent = window.getSystemMessage('categoriesManageTitle', lang);
    }
    
    // Update products manage title
    const productsManageTitle = document.getElementById('productsManageTitle');
    if (productsManageTitle) {
        productsManageTitle.textContent = window.getSystemMessage('productsManageTitle', lang);
    }
}

// Monitor language changes and update UI
const originalUpdateSystemMessages = window.updateSystemMessages;
window.updateSystemMessages = function(lang) {
    if (originalUpdateSystemMessages) {
        originalUpdateSystemMessages(lang);
    }
    updateUIMessages(lang);
};

// === Toast Notifications ===
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// === Grid/List View Toggle ===
function setupViewToggle() {
    const btn = document.getElementById('viewToggleBtn');
    if (!btn) return;
    
    // Restore in-memory preference
    const container = document.getElementById('productsContainer');
    if (viewMode === 'list') {
        container.classList.add('list-view');
        btn.textContent = '▦';
        btn.title = 'عرض شبكي';
    } else if (viewMode === 'small') {
        container.classList.add('small-cards-view');
        btn.textContent = '⧉';
        btn.title = 'عرض بطاقات صغيرة';
    }

    btn.addEventListener('click', function() {
        const container = document.getElementById('productsContainer');
        // Cycle modes: grid -> list -> small -> grid
        if (container.classList.contains('list-view')) {
            container.classList.remove('list-view');
            container.classList.add('small-cards-view');
            btn.textContent = '⧉';
            btn.title = 'عرض بطاقات صغيرة';
            viewMode = 'small';
            saveSettings(true);
        } else if (container.classList.contains('small-cards-view')) {
            container.classList.remove('small-cards-view');
            btn.textContent = '☰';
            btn.title = 'عرض قائمة';
            viewMode = 'grid';
            saveSettings(true);
        } else {
            container.classList.add('list-view');
            btn.textContent = '▦';
            btn.title = 'عرض شبكي';
            viewMode = 'list';
            saveSettings(true);
        }
        if (typeof renderProducts === 'function') renderProducts();
    });
}

// === Scroll to Top ===
function setupScrollToTop() {
    const btn = document.getElementById('scrollTopBtn');
    if (!btn) return;
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 400) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    });
    
    btn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Expose commonly used functions to global scope for inline handlers
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
    window.addCategory = addCategory;
    window.addProduct = addProduct;
    window.openAdminForm = openAdminForm;
    window.openEditProductModal = openEditProductModal;
    window.renderProducts = renderProducts;
    window.renderCategories = renderCategories;
    window.saveData = saveData;
    window.saveSettings = saveSettings;
    window.loadData = loadData;
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
    window.increaseCartItem = increaseCartItem;
    window.decreaseCartItem = decreaseCartItem;
    window.removeFromCart = removeFromCart;
    window.openCartModal = openCartModal;
    window.closeCartModal = closeCartModal;
    window.openProductModal = openProductModal;
    window.closeProductModal = closeProductModal;
}