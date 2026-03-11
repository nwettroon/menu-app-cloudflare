/**
 * js/cart.js - إدارة السلة
 */
import { state, formatNumber, formatPrice, showToast } from './core.js';

// ====== تحديث عداد السلة ======
export function updateCartCount() {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = formatNumber(count);
}

// ====== إضافة مباشرة للسلة ======
export function addToCartDirectly(product, size, quantityChange) {
    if (quantityChange === 0) return;

    let fullType = state.currentProductType || '';
    const groupSelections = Object.values(state.currentProductTypeGroups || {}).filter(v => v);
    if (groupSelections.length > 0) {
        fullType = fullType ? fullType + ' - ' + groupSelections.join(' - ') : groupSelections.join(' - ');
    }
    const typeForCart = fullType || null;

    const existingItemIndex = state.cart.findIndex(item =>
        item.productId === product.id &&
        item.size === size.name &&
        item.type === typeForCart
    );

    if (existingItemIndex !== -1) {
        state.cart[existingItemIndex].quantity += quantityChange;
        if (state.cart[existingItemIndex].quantity <= 0) {
            state.cart.splice(existingItemIndex, 1);
        }
    } else if (quantityChange > 0) {
        state.cart.push({
            productId: product.id,
            productName: product.name,
            categoryId: product.categoryId,
            size: size.name,
            type: typeForCart,
            price: size.price,
            quantity: quantityChange
        });
    }

    if (quantityChange > 0) flyToCartAnimation();
    updateCartCount();
}

// ====== أنيميشن الطيران للسلة (#8 - محسّن مع صوت واهتزاز) ======
export function flyToCartAnimation() {
    const cartBtn = document.getElementById('cartBtn');
    if (!cartBtn) return;

    // #8: صوت تأكيد إضافة للسلة
    playAddSound();

    const clickedBtn = document.querySelector('.qty-btn:focus, .qty-btn:active');
    let startX, startY;

    if (clickedBtn) {
        const btnRect = clickedBtn.getBoundingClientRect();
        startX = btnRect.left + btnRect.width / 2;
        startY = btnRect.top + btnRect.height / 2;
    } else {
        const modal = document.getElementById('productModal');
        const modalRect = modal.getBoundingClientRect();
        startX = modalRect.left + modalRect.width / 2;
        startY = modalRect.top + modalRect.height / 2;
    }

    const cartRect = cartBtn.getBoundingClientRect();
    const endX = cartRect.left + cartRect.width / 2;
    const endY = cartRect.top + cartRect.height / 2;

    const flyEl = document.createElement('div');
    flyEl.className = 'fly-to-cart';
    flyEl.textContent = '+1';
    flyEl.style.left = startX - 18 + 'px';
    flyEl.style.top = startY - 18 + 'px';
    document.body.appendChild(flyEl);

    requestAnimationFrame(() => {
        flyEl.style.left = endX - 18 + 'px';
        flyEl.style.top = endY - 18 + 'px';
        flyEl.classList.add('animate');
    });

    setTimeout(() => {
        const cartFixed = document.querySelector('.cart-fixed');
        if (cartFixed) {
            cartFixed.classList.remove('shake');
            void cartFixed.offsetWidth;
            cartFixed.classList.add('shake');
        }
        // #8: نبضة على زر السلة
        cartBtn.classList.add('cart-pulse');
        setTimeout(() => cartBtn.classList.remove('cart-pulse'), 400);
    }, 500);

    setTimeout(() => flyEl.remove(), 650);

    // #8: اهتزاز خفيف على الجوال
    if (navigator.vibrate) navigator.vibrate(50);
}

// #8: صوت إضافة للسلة باستخدام Web Audio API
let _audioCtx = null;
function playAddSound() {
    try {
        if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = _audioCtx.createOscillator();
        const gain = _audioCtx.createGain();
        osc.connect(gain);
        gain.connect(_audioCtx.destination);
        osc.frequency.setValueAtTime(800, _audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, _audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, _audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, _audioCtx.currentTime + 0.15);
        osc.start(_audioCtx.currentTime);
        osc.stop(_audioCtx.currentTime + 0.15);
    } catch (e) {}
}

// ====== فتح نافذة السلة ======
export function openCartModal() {
    const cartItemsList = document.getElementById('cartItemsList');
    cartItemsList.innerHTML = '';
    let total = 0;

    state.cart.forEach((item, index) => {
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
                <button class="qty-btn" data-cart-action="increase" data-cart-index="${index}">+</button>
                <span>${item.quantity}</span>
                <button class="qty-btn" data-cart-action="decrease" data-cart-index="${index}">−</button>
                <button class="cart-remove-btn" data-cart-action="remove" data-cart-index="${index}">✕</button>
            </div>
        `;
        cartItemsList.appendChild(cartItemDiv);
    });

    document.getElementById('totalPrice').textContent = formatNumber(total);
    document.getElementById('cartModal').classList.add('active');
}

// ====== إغلاق نافذة السلة ======
export function closeCartModal() {
    document.getElementById('cartModal').classList.remove('active');
}

// ====== التحكم بعناصر السلة ======
export function increaseCartItem(index) {
    if (state.cart[index]) {
        state.cart[index].quantity++;
        updateCartCount();
        openCartModal();
    }
}

export function decreaseCartItem(index) {
    if (state.cart[index] && state.cart[index].quantity > 1) {
        state.cart[index].quantity--;
        updateCartCount();
        openCartModal();
    }
}

export function removeFromCart(index) {
    state.cart.splice(index, 1);
    updateCartCount();
    openCartModal();
}

// ====== Event Delegation للسلة (#23) ======
export function setupCartDelegation() {
    const cartItemsList = document.getElementById('cartItemsList');
    if (!cartItemsList) return;

    cartItemsList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cart-action]');
        if (!btn) return;
        const action = btn.dataset.cartAction;
        const index = parseInt(btn.dataset.cartIndex);

        switch (action) {
            case 'increase': increaseCartItem(index); break;
            case 'decrease': decreaseCartItem(index); break;
            case 'remove': removeFromCart(index); break;
        }
    });
}
