// Google Translate Controller
// This file manages the integration with Google Translate and custom UI

let currentGoogleLanguage = 'ar';

// System Messages Dictionary - Static messages that need manual translation
const systemMessages = {
    ar: {
        cartLabel: "ادفع",
        cartTitle: "السلة",
        cartSubtitle: "توجه الى الكاشير للدفع",
        totalLabel: "الإجمالي:",
        payBtn: "دفع",
        addToCart: "إضافة للسلة",
        sizes: "المقاسات:",
        noCategories: "لا توجد أقسام",
        noProductsInCategory: "لا توجد منتجات في هذا القسم",
        adminTitle: "لوحة التحكم",
        categoriesManageTitle: "إدارة الأقسام",
        addCategory: "+ إضافة قسم",
        productsManageTitle: "إدارة المنتجات",
        addProduct: "+ إضافة منتج",
        edit: "تعديل",
        delete: "حذف",
        addSize: "+ إضافة حجم",
        sizeNamePlaceholder: "اسم المقاس",
        sizePricePlaceholder: "السعر",
        exportBtn: "تنزيل البيانات"
    },
    en: {
        cartLabel: "Pay",
        cartTitle: "Cart",
        cartSubtitle: "Go to cashier to pay",
        totalLabel: "Total:",
        payBtn: "Pay",
        addToCart: "Add to Cart",
        sizes: "Sizes:",
        noCategories: "No categories",
        noProductsInCategory: "No products in this category",
        adminTitle: "Admin Panel",
        categoriesManageTitle: "Manage Categories",
        addCategory: "+ Add Category",
        productsManageTitle: "Manage Products",
        addProduct: "+ Add Product",
        edit: "Edit",
        delete: "Delete",
        addSize: "+ Add Size",
        sizeNamePlaceholder: "Size Name",
        sizePricePlaceholder: "Price",
        exportBtn: "Download Data"
    },
    ur: {
        cartLabel: "ادائیگی",
        cartTitle: "ڈبہ",
        cartSubtitle: "ادائیگی کے لیے کیشیر کے پاس جائیں",
        totalLabel: "کل:",
        payBtn: "ادائیگی کریں",
        addToCart: "ڈبے میں شامل کریں",
        sizes: "سائز:",
        noCategories: "کوئی کیٹیگری نہیں",
        noProductsInCategory: "اس کیٹیگری میں کوئی مصنوع نہیں",
        adminTitle: "ایڈمن پینل",
        categoriesManageTitle: "کیٹیگریز کو منظم کریں",
        addCategory: "+ کیٹیگری شامل کریں",
        productsManageTitle: "مصنوعات کو منظم کریں",
        addProduct: "+ مصنوع شامل کریں",
        edit: "ترمیم",
        delete: "حذف",
        addSize: "+ سائز شامل کریں",
        sizeNamePlaceholder: "سائز کا نام",
        sizePricePlaceholder: "قیمت",
        exportBtn: "ڈیٹا ڈاؤن لوڈ کریں"
    },
    ru: {
        cartLabel: "Оплата",
        cartTitle: "Корзина",
        cartSubtitle: "Перейти к кассиру для оплаты",
        totalLabel: "Итого:",
        payBtn: "Оплатить",
        addToCart: "Добавить в корзину",
        sizes: "Размеры:",
        noCategories: "Нет категорий",
        noProductsInCategory: "Нет продуктов в этой категории",
        adminTitle: "Панель администратора",
        categoriesManageTitle: "Управление категориями",
        addCategory: "+ Добавить категорию",
        productsManageTitle: "Управление продуктами",
        addProduct: "+ Добавить продукт",
        edit: "Редактировать",
        delete: "Удалить",
        addSize: "+ Добавить размер",
        sizeNamePlaceholder: "Название размера",
        sizePricePlaceholder: "Цена",
        exportBtn: "Загрузить данные"
    },
    fr: {
        cartLabel: "Payer",
        cartTitle: "Panier",
        cartSubtitle: "Allez à la caisse pour payer",
        totalLabel: "Total:",
        payBtn: "Payer",
        addToCart: "Ajouter au panier",
        sizes: "Tailles:",
        noCategories: "Pas de catégories",
        noProductsInCategory: "Aucun produit dans cette catégorie",
        adminTitle: "Panneau d'administration",
        categoriesManageTitle: "Gérer les catégories",
        addCategory: "+ Ajouter une catégorie",
        productsManageTitle: "Gérer les produits",
        addProduct: "+ Ajouter un produit",
        edit: "Modifier",
        delete: "Supprimer",
        addSize: "+ Ajouter une taille",
        sizeNamePlaceholder: "Nom de la taille",
        sizePricePlaceholder: "Prix",
        exportBtn: "Télécharger les données"
    },
    tr: {
        cartLabel: "Öde",
        cartTitle: "Sepet",
        cartSubtitle: "Ödeme için kasa görevlisine gidin",
        totalLabel: "Toplam:",
        payBtn: "Öde",
        addToCart: "Sepete Ekle",
        sizes: "Boyutlar:",
        noCategories: "Kategori yok",
        noProductsInCategory: "Bu kategoride ürün yok",
        adminTitle: "Yönetim Paneli",
        categoriesManageTitle: "Kategorileri Yönet",
        addCategory: "+ Kategori Ekle",
        productsManageTitle: "Ürünleri Yönet",
        addProduct: "+ Ürün Ekle",
        edit: "Düzenle",
        delete: "Sil",
        addSize: "+ Boyut Ekle",
        sizeNamePlaceholder: "Boyut Adı",
        sizePricePlaceholder: "Fiyat",
        exportBtn: "Verileri İndir"
    },
    // Add more languages as needed
    ja: {
        cartLabel: "支払う",
        cartTitle: "カート",
        cartSubtitle: "レジ係のところに行って支払う",
        totalLabel: "合計:",
        payBtn: "支払う",
        addToCart: "カートに追加",
        sizes: "サイズ:",
        noCategories: "カテゴリなし",
        noProductsInCategory: "このカテゴリに製品はありません",
        adminTitle: "管理パネル",
        categoriesManageTitle: "カテゴリを管理",
        addCategory: "+ カテゴリを追加",
        productsManageTitle: "製品を管理",
        addProduct: "+ 製品を追加",
        edit: "編集",
        delete: "削除",
        addSize: "+ サイズを追加",
        sizeNamePlaceholder: "サイズ名",
        sizePricePlaceholder: "価格",
        exportBtn: "データをダウンロード"
    },
    uz: {
        cartLabel: "To'lash",
        cartTitle: "Savat",
        cartSubtitle: "To'lash uchun kassiriga o'ting",
        totalLabel: "Jami:",
        payBtn: "To'lash",
        addToCart: "Savatga qo'shish",
        sizes: "O'lchamlar:",
        noCategories: "Kategoriyalar yo'q",
        noProductsInCategory: "Bu kategoriyada mahsulotlar yo'q",
        adminTitle: "Boshqaruv paneli",
        categoriesManageTitle: "Kategoriyalarni boshqarish",
        addCategory: "+ Kategoriya qo'shish",
        productsManageTitle: "Mahsulotlarni boshqarish",
        addProduct: "+ Mahsulot qo'shish",
        edit: "Tahrirlash",
        delete: "O'chirish",
        addSize: "+ O'lcham qo'shish",
        sizeNamePlaceholder: "O'lcham nomi",
        sizePricePlaceholder: "Narx",
        exportBtn: "Ma'lumotlarni yuklab olish"
    },
    id: {
        cartLabel: "Bayar",
        cartTitle: "Keranjang",
        cartSubtitle: "Pergi ke kasir untuk membayar",
        totalLabel: "Total:",
        payBtn: "Bayar",
        addToCart: "Tambah ke Keranjang",
        sizes: "Ukuran:",
        noCategories: "Tidak ada kategori",
        noProductsInCategory: "Tidak ada produk dalam kategori ini",
        adminTitle: "Panel Admin",
        categoriesManageTitle: "Kelola Kategori",
        addCategory: "+ Tambah Kategori",
        productsManageTitle: "Kelola Produk",
        addProduct: "+ Tambah Produk",
        edit: "Edit",
        delete: "Hapus",
        addSize: "+ Tambah Ukuran",
        sizeNamePlaceholder: "Nama Ukuran",
        sizePricePlaceholder: "Harga",
        exportBtn: "Unduh Data"
    },
    fil: {
        cartLabel: "Magbayad",
        cartTitle: "Karrito",
        cartSubtitle: "Pumunta sa kahera upang magbayad",
        totalLabel: "Kabuuan:",
        payBtn: "Magbayad",
        addToCart: "Idagdag sa Karrito",
        sizes: "Mga Laki:",
        noCategories: "Walang kategorya",
        noProductsInCategory: "Walang produkto sa kategoryang ito",
        adminTitle: "Admin Panel",
        categoriesManageTitle: "Pamahalaan ang Mga Kategorya",
        addCategory: "+ Magdagdag ng Kategorya",
        productsManageTitle: "Pamahalaan ang Mga Produkto",
        addProduct: "+ Magdagdag ng Produkto",
        edit: "I-edit",
        delete: "Tanggalin",
        addSize: "+ Magdagdag ng Laki",
        sizeNamePlaceholder: "Pangalan ng Laki",
        sizePricePlaceholder: "Presyo",
        exportBtn: "I-download ang Data"
    },
    ha: {
        cartLabel: "Biya",
        cartTitle: "Kwandu",
        cartSubtitle: "Je zuwa ma'ajiyar biya",
        totalLabel: "Jami:",
        payBtn: "Biya",
        addToCart: "Ƙara wa Kwandu",
        sizes: "Girman:",
        noCategories: "Babu nau'uka",
        noProductsInCategory: "Babu abubuwa a wannan nau'in",
        adminTitle: "Admin Panel",
        categoriesManageTitle: "Sarrafa Nau'uka",
        addCategory: "+ Ƙara Nau'i",
        productsManageTitle: "Sarrafa Abubuwa",
        addProduct: "+ Ƙara Abu",
        edit: "Gyara",
        delete: "Guba",
        addSize: "+ Ƙara Girman",
        sizeNamePlaceholder: "Sunan Girman",
        sizePricePlaceholder: "Farashin",
        exportBtn: "Saci Bayani"
    },
    "zh-SG": {
        cartLabel: "支付",
        cartTitle: "购物车",
        cartSubtitle: "前往收银台付款",
        totalLabel: "总计:",
        payBtn: "支付",
        addToCart: "加入购物车",
        sizes: "尺寸:",
        noCategories: "无分类",
        noProductsInCategory: "此分类中无产品",
        adminTitle: "管理面板",
        categoriesManageTitle: "管理分类",
        addCategory: "+ 添加分类",
        productsManageTitle: "管理产品",
        addProduct: "+ 添加产品",
        edit: "编辑",
        delete: "删除",
        addSize: "+ 添加尺寸",
        sizeNamePlaceholder: "尺寸名称",
        sizePricePlaceholder: "价格",
        exportBtn: "下载数据"
    },
    ms: {
        cartLabel: "Bayar",
        cartTitle: "Troli",
        cartSubtitle: "Pergi ke mesin tunai untuk membayar",
        totalLabel: "Jumlah:",
        payBtn: "Bayar",
        addToCart: "Tambah ke Troli",
        sizes: "Saiz:",
        noCategories: "Tiada kategori",
        noProductsInCategory: "Tiada produk dalam kategori ini",
        adminTitle: "Panel Admin",
        categoriesManageTitle: "Urus Kategori",
        addCategory: "+ Tambah Kategori",
        productsManageTitle: "Urus Produk",
        addProduct: "+ Tambah Produk",
        edit: "Edit",
        delete: "Padam",
        addSize: "+ Tambah Saiz",
        sizeNamePlaceholder: "Nama Saiz",
        sizePricePlaceholder: "Harga",
        exportBtn: "Muat Turun Data"
    },
    mn: {
        cartLabel: "Төлөх",
        cartTitle: "Сагс",
        cartSubtitle: "Төлөхийн тулд кассчиныг нүүр цахилгаана",
        totalLabel: "Нийт:",
        payBtn: "Төлөх",
        addToCart: "Сагсанд нэмэх",
        sizes: "Хэмжээ:",
        noCategories: "Ангилал байхгүй",
        noProductsInCategory: "Энэ ангилалд бүтээгдэхүүн байхгүй",
        adminTitle: "Админ самбар",
        categoriesManageTitle: "Ангиллыг удирдах",
        addCategory: "+ Ангилал нэмэх",
        productsManageTitle: "Бүтээгдэхүүнийг удирдах",
        addProduct: "+ Бүтээгдэхүүн нэмэх",
        edit: "Засах",
        delete: "Устгах",
        addSize: "+ Хэмжээ нэмэх",
        sizeNamePlaceholder: "Хэмжээний нэр",
        sizePricePlaceholder: "Үнэ",
        exportBtn: "Өгөгдөл татаж авах"
    }
};

// Map internal language codes to Google Translate language codes
const languageCodeMap = {
    'ar': 'ar',
    'en': 'en',
    'ur': 'ur',
    'ru': 'ru',
    'uz': 'uz',
    'ja': 'ja',
    'id': 'id',
    'fil': 'fil',
    'ha': 'ha',
    'zh-SG': 'zh-CN',
    'ms': 'ms',
    'zh': 'zh-CN',
    'mn': 'mn',
    'fr': 'fr',
    'tr': 'tr',
    'fa': 'fa'
};

// Initialize Google Translate Controller
function initGoogleTranslateController() {
    // Wait for Google Translate to be ready
    const checkInterval = setInterval(() => {
        if (document.querySelector('.goog-te-combo')) {
            clearInterval(checkInterval);
            setupLanguageButtons();
            hideGoogleTranslateBar();
            loadSavedLanguage();
        }
    }, 100);

    // #22: MutationObserver بدل setInterval لإخفاء شريط Google Translate
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                const bar = document.querySelector('.skiptranslate');
                if (bar && bar.style.display !== 'none') {
                    hideGoogleTranslateBar();
                }
                // إصلاح top الذي يضيفه Google Translate على body
                if (document.body.style.top && document.body.style.top !== '0px') {
                    hideGoogleTranslateBar();
                }
            }
        }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'], childList: true, subtree: false });
    // مراقبة إضافة عناصر جديدة في head أيضاً
    observer.observe(document.head, { childList: true });

    // Setup the language dropdown toggle immediately so button works
    setupLanguageToggle();
}

// Setup language dropdown toggle (language button) and outside click handler
function setupLanguageToggle() {
    const languageBtn = document.getElementById('languageBtn');
    const languageDropdown = document.getElementById('languageDropdown');

    if (!languageBtn || !languageDropdown) return;

    languageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        languageDropdown.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        languageDropdown.classList.remove('active');
    });
}

// Setup custom language button click handlers
function setupLanguageButtons() {
    const langOptions = document.querySelectorAll('.lang-option');
    
    langOptions.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const lang = this.getAttribute('data-lang');
            const googleLang = languageCodeMap[lang] || lang;
            
            // Select language in Google Translate
            selectGoogleLanguage(googleLang);
            
            // Update current language
            currentGoogleLanguage = lang;
            
            // Save language preference
            localStorage.setItem('selectedLanguage', lang);
            
            // Update system messages
            updateSystemMessages(lang);
            
            // Update active button styling
            updateActiveLanguageButton(lang);
            
            // Close dropdown
            document.getElementById('languageDropdown').classList.remove('active');
            
            // Delay to ensure translation completes
            setTimeout(() => {
                hideGoogleTranslateBar();
            }, 500);
        });
    });
}

// Programmatically select language in hidden Google Translate dropdown
function selectGoogleLanguage(lang) {
    // If selecting the original site language (Arabic), clear Google Translate state
    if (lang === 'ar') {
        resetGoogleTranslation();
        return;
    }

    const googleCombo = document.querySelector('.goog-te-combo');
    if (googleCombo) {
        googleCombo.value = lang;

        // Trigger change event to force translation
        const event = new Event('change', { bubbles: true });
        googleCombo.dispatchEvent(event);
    }
}

// Reset Google Translate to original page language (no translation)
function resetGoogleTranslation() {
    // Try to reset the .goog-te-combo to default (first option)
    const googleCombo = document.querySelector('.goog-te-combo');
    if (googleCombo) {
        try {
            googleCombo.selectedIndex = 0;
            googleCombo.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
            // ignore
        }
    }

    // Clear Google Translate cookie(s) used by the widget and set to neutral
    try {
        // Host-only cookie (best effort)
        document.cookie = 'googtrans=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
        // Also try to set a neutral mapping
        document.cookie = 'googtrans=/ar/ar;path=/';
    } catch (e) {
        // ignore
    }

    // Ensure UI messages switch back to Arabic immediately
    currentGoogleLanguage = 'ar';
    localStorage.setItem('selectedLanguage', 'ar');
    updateSystemMessages('ar');
    updateActiveLanguageButton('ar');

    // Reload page to ensure Google Translate UI/state is fully reset
    setTimeout(() => {
        location.reload();
    }, 200);
}

// Update system messages based on selected language
function updateSystemMessages(lang) {
    const messages = systemMessages[lang] || systemMessages['en'];
    
    // Update cart label
    const cartLabel = document.getElementById('cartLabel');
    if (cartLabel) {
        cartLabel.textContent = messages.cartLabel;
    }
    
    // Update other system messages as needed
    // This will be called for any UI element that uses system messages
}

// Get system message for key and language
function getSystemMessage(key, lang = currentGoogleLanguage) {
    const messages = systemMessages[lang] || systemMessages['en'];
    return messages[key] || key;
}

// Hide Google Translate bar
function hideGoogleTranslateBar() {
    // Hide Google Translate iframe/bar
    const googleBar = document.querySelector('.skiptranslate');
    if (googleBar) {
        googleBar.style.display = 'none';
    }
    
    // Hide the google translate element container
    const googleElement = document.getElementById('google_translate_element');
    if (googleElement) {
        googleElement.style.display = 'none';
    }
    
    // Fix body margin/padding that Google Translate might add
    document.body.style.top = '0 !important';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
}

// Update active language button styling
function updateActiveLanguageButton(lang) {
    const langOptions = document.querySelectorAll('.lang-option');
    langOptions.forEach(button => {
        button.classList.remove('active');
        if (button.getAttribute('data-lang') === lang) {
            button.classList.add('active');
        }
    });
}

// Load saved language preference
function loadSavedLanguage() {
    const savedLang = localStorage.getItem('selectedLanguage') || 'ar';
    currentGoogleLanguage = savedLang;
    
    // Set the active button
    updateActiveLanguageButton(savedLang);
    
    // If not Arabic (default), select the language in Google Translate
    if (savedLang !== 'ar') {
        const googleLang = languageCodeMap[savedLang] || savedLang;
        selectGoogleLanguage(googleLang);
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', function() {
    initGoogleTranslateController();
});

// Export functions for use in other scripts
window.getSystemMessage = getSystemMessage;
window.updateSystemMessages = updateSystemMessages;
