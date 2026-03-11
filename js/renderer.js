/**
 * js/renderer.js - عرض الأقسام والمنتجات
 * #9: إضافة lazy loading للصور
 */
import { state, formatNumber, formatPrice } from './core.js';
import { addToCartDirectly } from './cart.js';

// ====== عرض الأقسام ======
export function renderCategories() {
    // شريط الأقسام الثابت
    const barContainer = document.getElementById('categoriesList');
    barContainer.innerHTML = '';

    state.categories.forEach(category => {
        if (category.disabled) return;
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.textContent = category.name;
        if (state.selectedCategory === category.id) btn.classList.add('active');
        btn.addEventListener('click', () => {
            state.selectedCategory = category.id;
            renderCategories();
            renderProducts();
            const section = document.getElementById(`category-section-${category.id}`);
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        barContainer.appendChild(btn);
    });

    // الأقسام في الهيدر
    const headerContainer = document.getElementById('categoriesSection');
    if (headerContainer) {
        headerContainer.innerHTML = '';
        state.categories.forEach(category => {
            if (category.disabled) return;
            const card = document.createElement('div');
            card.className = 'category-card';
            card.innerHTML = `
                <img src="${category.image}" alt="${category.name}" loading="lazy" onerror="window.handleImageFallback(this, 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23f0e6d8%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E')">
                <div class="category-card-name">${category.name}</div>
            `;
            card.addEventListener('click', () => {
                state.selectedCategory = category.id;
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

// ====== كاروسيل الأكثر مبيعاً ======
function renderBestSellersCarousel(container) {
    if (state.disableBestSellers) return; // تعطيل الشريط إذا كان الإعداد مفعلاً
    if (state.bestSellersEnabled === false) return;
    const bestProducts = state.products.filter(p => p.badge === 'best' && !p.disabled);
    if (bestProducts.length === 0) return;

    const section = document.createElement('section');
    section.className = 'best-sellers-section';

    // العنوان
    const header = document.createElement('div');
    header.className = 'best-sellers-header';
    header.innerHTML = `<span class="best-sellers-icon">🔥</span><h3>الأكثر مبيعاً</h3><span class="best-sellers-icon">🔥</span>`;

    // حاوية الكاروسيل
    const carouselWrapper = document.createElement('div');
    carouselWrapper.className = 'best-sellers-carousel-wrapper';

    const track = document.createElement('div');
    track.className = 'best-sellers-track';

    // نكرر المنتجات لتعبئة الشاشة وتحقيق التمرير اللانهائي (بدون فراغات)
    let repeatedProducts = [...bestProducts];
    while (repeatedProducts.length < 10) {
        repeatedProducts = repeatedProducts.concat(bestProducts);
    }
    const allItems = [...repeatedProducts, ...repeatedProducts];
    allItems.forEach(product => {
        const card = document.createElement('div');
        card.className = 'best-seller-card';

        const minPrice = product.sizes && product.sizes.length > 0
            ? Math.min(...product.sizes.map(s => s.price))
            : product.basePrice;

        card.innerHTML = `
            <div class="best-seller-img-wrap">
                <img src="${product.image}" alt="${product.name}" loading="lazy"
                     onerror="window.handleImageFallback(this, 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22150%22%3E%3Crect fill=%22%23f5f5f5%22 width=%22150%22 height=%22150%22/%3E%3C/svg%3E')">
                <span class="best-seller-fire">🔥</span>
            </div>
            <div class="best-seller-info">
                <div class="best-seller-name">${product.name}</div>
                <div class="best-seller-price">من ${formatNumber(minPrice)} ريال</div>
            </div>
        `;
        card.addEventListener('click', () => openProductModal(product));
        track.appendChild(card);
    });

    // ضبط مدة الأنيميشن بناءً على عدد العناصر (المكررة بالكامل)
    const itemCount = repeatedProducts.length;
    const duration = Math.max(itemCount * 3, 15);
    track.style.animationDuration = `${duration}s`;

    carouselWrapper.appendChild(track);

    // أزرار التمرير اليدوي
    const prevBtn = document.createElement('button');
    prevBtn.className = 'carousel-nav-btn carousel-prev';
    prevBtn.innerHTML = '‹';
    prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        track.style.animationPlayState = 'paused';
        carouselWrapper.scrollBy({ left: 200, behavior: 'smooth' });
        setTimeout(() => { track.style.animationPlayState = 'running'; }, 2000);
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'carousel-nav-btn carousel-next';
    nextBtn.innerHTML = '›';
    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        track.style.animationPlayState = 'paused';
        carouselWrapper.scrollBy({ left: -200, behavior: 'smooth' });
        setTimeout(() => { track.style.animationPlayState = 'running'; }, 2000);
    });

    // إيقاف مؤقت عند hover/touch
    carouselWrapper.addEventListener('mouseenter', () => { track.style.animationPlayState = 'paused'; });
    carouselWrapper.addEventListener('mouseleave', () => { track.style.animationPlayState = 'running'; });
    carouselWrapper.addEventListener('touchstart', () => { track.style.animationPlayState = 'paused'; }, { passive: true });
    carouselWrapper.addEventListener('touchend', () => {
        setTimeout(() => { track.style.animationPlayState = 'running'; }, 2000);
    });

    section.appendChild(header);
    section.appendChild(carouselWrapper);
    section.appendChild(prevBtn);
    section.appendChild(nextBtn);
    container.appendChild(section);
}

// ====== عرض المنتجات (#9 - lazy loading) ======
export function renderProducts() {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    if (!state.categories.length) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">لا توجد أقسام</p>`;
        return;
    }

    // ====== قسم الأكثر مبيعاً (كاروسيل متحرك) ======
    renderBestSellersCarousel(container);

    state.categories.forEach(category => {
        if (category.disabled) return;
        const section = document.createElement('section');
        section.className = 'category-section-block';
        section.id = `category-section-${category.id}`;

        const title = document.createElement('h3');
        title.className = 'category-section-title';
        title.textContent = category.name;

        const grid = document.createElement('div');
        grid.className = 'category-products-grid';

        const categoryProducts = state.products.filter(p => p.categoryId === category.id);
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

                // الشارات
                if (product.badge) {
                    if (product.badge === 'best') {
                        card.classList.add('card-on-fire');
                        const fireContainer = document.createElement('div');
                        fireContainer.className = 'fire-particles';
                        ['🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥'].forEach(emoji => {
                            const particle = document.createElement('span');
                            particle.className = 'fire-particle';
                            particle.textContent = emoji;
                            fireContainer.appendChild(particle);
                        });
                        card.appendChild(fireContainer);
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

                // صورة المنتج مع lazy loading (#9)
                const imgElement = document.createElement('img');
                imgElement.className = 'product-image';
                imgElement.src = product.image;
                imgElement.alt = product.name;
                imgElement.loading = 'lazy'; // #9 Lazy Loading
                imgElement.onerror = function () {
                    window.handleImageFallback(this, 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f5f5f5" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" font-size="14" fill="%23999" text-anchor="middle" dy=".3em" font-family="Arial"%3Eصورة غير متوفرة%3C/text%3E%3C/svg%3E');
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

                const visibility = (state.design && state.design.caloriesVisibility) ? state.design.caloriesVisibility : 'both';
                if (product.calories && (visibility === 'both' || visibility === 'card')) {
                    const caloriesElem = document.createElement('div');
                    caloriesElem.className = 'product-calories';
                    caloriesElem.innerHTML = `🔥 ca: ${product.calories}`;
                    card.appendChild(caloriesElem);
                }

                card.addEventListener('mouseenter', function () { this.classList.add('glowing'); });
                card.addEventListener('mouseleave', function () { this.classList.remove('glowing'); });
                card.addEventListener('click', () => openProductModal(product));

                grid.appendChild(card);
            });
        }

        section.appendChild(title);
        section.appendChild(grid);
        container.appendChild(section);
    });
}

// ====== نافذة المنتج ======
export function openProductModal(product) {
    state.currentProductQuantity = 1;
    state.currentProductSize = null;
    state.currentSizeQuantities = {};

    const imgElement = document.getElementById('modalProductImg');
    imgElement.removeAttribute('data-fallbacks');

    // منع إعادة التحميل إذا كانت نفس الصورة موجودة مسبقاً (لتوفير الباندويث)
    if (imgElement.getAttribute('src') !== product.image) {
        imgElement.src = product.image;
        imgElement.dataset.originalSrc = product.image;
    }

    imgElement.onerror = function () {
        window.handleImageFallback(this, 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300"%3E%3Crect fill="%23f5f5f5" width="300" height="300"/%3E%3Ctext x="50%25" y="50%25" font-size="16" fill="%23999" text-anchor="middle" dy=".3em" font-family="Arial"%3Eصورة غير متوفرة%3C/text%3E%3C/svg%3E');
    };

    document.getElementById('modalProductName').textContent = product.name;

    // إظهار السعرات في بطاقة التعديل
    const modalCalories = document.getElementById('modalProductCalories');
    const visibility = (state.design && state.design.caloriesVisibility) ? state.design.caloriesVisibility : 'both';

    if (modalCalories) {
        if (product.calories && (visibility === 'both' || visibility === 'modal')) {
            modalCalories.style.display = 'inline-flex';
            modalCalories.innerHTML = `🔥 ca: ${product.calories}`;
        } else {
            modalCalories.style.display = 'none';
        }
    }

    // عرض الأنواع
    const typesSection = document.getElementById('typesSection');
    const typesList = document.getElementById('productTypesList');
    if (product.types && product.types.length > 0) {
        typesSection.style.display = 'flex';
        typesList.innerHTML = '';
        const activeTypes = product.types.filter(type => {
            return !product.disabledTypes || !product.disabledTypes.includes(type);
        });
        if (activeTypes.length === 0) {
            typesSection.style.display = 'none';
            state.currentProductType = null;
        } else {
            state.currentProductType = activeTypes[0];
            activeTypes.forEach((type, index) => {
                const typeBtn = document.createElement('button');
                typeBtn.type = 'button';
                typeBtn.className = 'type-item' + (index === 0 ? ' selected' : '');
                typeBtn.textContent = type;
                typeBtn.addEventListener('click', function () {
                    typesList.querySelectorAll('.type-item').forEach(btn => btn.classList.remove('selected'));
                    this.classList.add('selected');
                    state.currentProductType = type;
                    renderProductSizes(product, type);
                });
                typesList.appendChild(typeBtn);
            });
        }
    } else {
        typesSection.style.display = 'none';
        state.currentProductType = null;
    }

    // سطور الأنواع الإضافية (المجموعات)
    state.currentProductTypeGroups = {};
    const typeGroupsSection = document.getElementById('typeGroupsSection');
    if (typeGroupsSection) {
        typeGroupsSection.innerHTML = '';
        if (product.typeGroups && product.typeGroups.length > 0) {
            product.typeGroups.forEach((group, groupIndex) => {
                if (!group.types || group.types.length === 0) return;
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
                state.currentProductTypeGroups[groupIndex] = activeGroupTypes[0];

                activeGroupTypes.forEach((type, typeIdx) => {
                    const typeBtn = document.createElement('button');
                    typeBtn.type = 'button';
                    typeBtn.className = 'type-item' + (typeIdx === 0 ? ' selected' : '');
                    typeBtn.textContent = type;
                    typeBtn.addEventListener('click', function () {
                        groupTypesList.querySelectorAll('.type-item').forEach(btn => btn.classList.remove('selected'));
                        this.classList.add('selected');
                        state.currentProductTypeGroups[groupIndex] = type;
                    });
                    groupTypesList.appendChild(typeBtn);
                });

                groupDiv.appendChild(groupTypesList);
                typeGroupsSection.appendChild(groupDiv);
            });
        }
    }

    renderProductSizes(product, state.currentProductType);
    document.getElementById('productModal').classList.add('active');
}

// ====== عرض الأسعار/الأحجام ======
export function renderProductSizes(product, selectedType) {
    const sizesList = document.getElementById('productSizesList');
    sizesList.innerHTML = '';
    state.currentSizeQuantities = {};

    let sizesToShow = [];
    if (selectedType &&
        product.typeSpecificPricingEnabled &&
        product.typeSpecificPricingEnabled[selectedType] &&
        product.typeSpecificSizes &&
        product.typeSpecificSizes[selectedType]) {
        sizesToShow = product.typeSpecificSizes[selectedType];
    } else if (product.sizes && product.sizes.length > 0) {
        sizesToShow = product.sizes;
    }

    const quantitySection = document.querySelector('.quantity-section');
    if (sizesToShow && sizesToShow.length > 0) {
        if (quantitySection) quantitySection.style.display = 'none';

        sizesToShow.forEach((size, index) => {
            state.currentSizeQuantities[index] = 0;
            const sizeRow = document.createElement('div');
            sizeRow.className = 'size-item size-item-row';

            // إخفاء أزرار الكمية إذا كانت السلة معطلة
            const qtyControlsHTML = state.disableCart ? '' : `
                <div class="size-qty-controls">
                    <button class="qty-btn" type="button" data-action="plus" data-index="${index}" data-product-id="${product.id}">+</button>
                    <span class="qty-display" data-index="${index}">0</span>
                    <button class="qty-btn" type="button" data-action="minus" data-index="${index}" data-product-id="${product.id}">−</button>
                </div>
            `;

            sizeRow.innerHTML = `
                <div class="size-info">
                    <span class="size-name">${size.name}</span>
                    <span class="size-price">${formatPrice(size.price)}</span>
                </div>
                ${qtyControlsHTML}
            `;
            sizesList.appendChild(sizeRow);
        });

        // لا تقم بإضافة المستمعين إذا كانت السلة معطلة
        if (!state.disableCart) {
            sizesList.querySelectorAll('.qty-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    const idx = parseInt(this.getAttribute('data-index'));
                    const action = this.getAttribute('data-action');
                    const productId = parseInt(this.getAttribute('data-product-id'));
                    const current = state.currentSizeQuantities[idx] || 0;
                    const next = action === 'plus' ? current + 1 : Math.max(0, current - 1);
                    state.currentSizeQuantities[idx] = next;
                    const display = sizesList.querySelector(`.qty-display[data-index="${idx}"]`);
                    if (display) display.textContent = next;

                    const prod = state.products.find(p => p.id === productId);
                    if (prod && sizesToShow[idx]) {
                        addToCartDirectly(prod, sizesToShow[idx], next - current);
                    }
                });
            });
        }

        // استعادة الكميات من السلة
        let fullType = state.currentProductType || '';
        const groupSelections = Object.values(state.currentProductTypeGroups || {}).filter(v => v);
        if (groupSelections.length > 0) {
            fullType = fullType ? fullType + ' - ' + groupSelections.join(' - ') : groupSelections.join(' - ');
        }
        const typeForRestore = fullType || null;

        sizesToShow.forEach((size, index) => {
            const cartItem = state.cart.find(item =>
                item.productId === product.id &&
                item.size === size.name &&
                item.type === typeForRestore
            );
            if (cartItem && cartItem.quantity > 0) {
                state.currentSizeQuantities[index] = cartItem.quantity;
                const display = sizesList.querySelector(`.qty-display[data-index="${index}"]`);
                if (display) display.textContent = cartItem.quantity;
            }
        });
    } else {
        if (quantitySection) quantitySection.style.display = state.disableCart ? 'none' : '';
        state.currentProductSize = { name: '', price: product.basePrice };

        let fullTypeNoSize = state.currentProductType || '';
        const groupSelectionsNoSize = Object.values(state.currentProductTypeGroups || {}).filter(v => v);
        if (groupSelectionsNoSize.length > 0) {
            fullTypeNoSize = fullTypeNoSize ? fullTypeNoSize + ' - ' + groupSelectionsNoSize.join(' - ') : groupSelectionsNoSize.join(' - ');
        }
        const typeForRestoreNoSize = fullTypeNoSize || null;
        const cartItemNoSize = state.cart.find(item =>
            item.productId === product.id &&
            item.size === '' &&
            item.type === typeForRestoreNoSize
        );
        if (cartItemNoSize && cartItemNoSize.quantity > 0) {
            state.currentProductQuantity = cartItemNoSize.quantity;
        }
        updateQuantityDisplay();
    }
}

export function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

export function updateQuantityDisplay() {
    document.getElementById('qtyDisplay').textContent = formatNumber(state.currentProductQuantity);
}

// ====== عرض شبكي/قائمة ======
export function setupViewToggle() {
    const btn = document.getElementById('viewToggleBtn');
    if (!btn) return;

    const container = document.getElementById('productsContainer');
    if (state.viewMode === 'list') {
        container.classList.add('list-view');
        btn.textContent = '▦';
        btn.title = 'عرض شبكي';
    } else if (state.viewMode === 'small') {
        container.classList.add('small-cards-view');
        btn.textContent = '⧉';
        btn.title = 'عرض بطاقات صغيرة';
    }

    btn.addEventListener('click', function () {
        const container = document.getElementById('productsContainer');
        if (container.classList.contains('list-view')) {
            container.classList.remove('list-view');
            container.classList.add('small-cards-view');
            btn.textContent = '⧉';
            btn.title = 'عرض بطاقات صغيرة';
            state.viewMode = 'small';
        } else if (container.classList.contains('small-cards-view')) {
            container.classList.remove('small-cards-view');
            btn.textContent = '☰';
            btn.title = 'عرض قائمة';
            state.viewMode = 'grid';
        } else {
            container.classList.add('list-view');
            btn.textContent = '▦';
            btn.title = 'عرض شبكي';
            state.viewMode = 'list';
        }
        // نحفظ الإعدادات (يتم استيراد saveSettings في app.js)
        if (window._saveSettings) window._saveSettings(true);
        renderProducts();
    });
}

// ====== زر العودة للأعلى ======
export function setupScrollToTop() {
    const btn = document.getElementById('scrollTopBtn');
    if (!btn) return;

    window.addEventListener('scroll', function () {
        if (window.scrollY > 400) btn.classList.add('visible');
        else btn.classList.remove('visible');
    });

    btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ====== تحديث رسائل الواجهة حسب اللغة ======
export function updateUIMessages(lang) {
    if (!window.getSystemMessage) return;
    const m = window.getSystemMessage;
    const ids = {
        'cartLabel': 'cartLabel',
        'cartTitle': 'cartTitle',
        'totalLabel': 'totalLabel',
        'payBtn': 'payBtn',
        'adminTitle': 'adminTitle',
        'categoriesManageTitle': 'categoriesManageTitle',
        'productsManageTitle': 'productsManageTitle'
    };
    for (const [elId, key] of Object.entries(ids)) {
        const el = document.getElementById(elId);
        if (el) el.textContent = m(key, lang) + (key === 'totalLabel' ? ':' : '');
    }
    const cartSubtitle = document.querySelector('.cart-subtitle');
    if (cartSubtitle) cartSubtitle.textContent = m('cartSubtitle', lang);
}
