import { CLIENT } from './core.js';
import { database, ref, onChildAdded, onChildChanged, set, refreshAllData } from './firebase.js';
import { printOnlineOrder } from './printing.js';

const urlParams = new URLSearchParams(window.location.search);
const branchId = urlParams.get('branch') || 'main';

// Basic UI setup
const branchDisplay = document.getElementById('branchNameDisplay');
if (branchDisplay) branchDisplay.textContent = branchId === 'main' ? 'الرئيسي' : branchId;

const ordersGrid = document.getElementById('ordersGrid');
const emptyState = document.getElementById('emptyState');
const statusBadge = document.getElementById('connectionStatus');
const chimeSound = document.getElementById('chimeSound');
const testSoundBtn = document.getElementById('testSoundBtn');

let isConnected = false;
let displayedOrders = new Set(); // to avoid duplicates

const autoPrintToggle = document.getElementById('autoPrintToggle');
if (autoPrintToggle) {
    autoPrintToggle.checked = localStorage.getItem('autoPrint') !== 'false';
    autoPrintToggle.addEventListener('change', (e) => {
        localStorage.setItem('autoPrint', e.target.checked);
        showToast(e.target.checked ? 'تم تفعيل الطباعة التلقائية (ستطبع بمجرد وصول الطلب)' : 'تم إيقاف الطباعة التلقائية', 'success');
    });
}

// Ensure audio context user interaction
testSoundBtn.addEventListener('click', () => {
    playSound();
    showToast('تم اختبار الصوت', 'success');
});

function playSound() {
    try {
        // Most browsers block uninitiated audio. We need user to click on the page at least once
        chimeSound.currentTime = 0;
        const playPromise = chimeSound.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn('Audio blocked by browser, please click anywhere on the page.', error);
                showToast('الصوت معطل من المتصفح، يرجى النقر على الشاشة', 'error');
            });
        }
    } catch (e) { console.error('Sound error:', e); }
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// ==== Realtime Listener ====
function initializeReceiver() {
    statusBadge.textContent = 'متصل كـ الكاشير 🟢';
    statusBadge.classList.add('connected');

    // Using simple firebase functions since they are imported from firebase.js
    const ordersRef = ref(database, `online_orders/${CLIENT.id}/${branchId}`);

    // Listen for new orders
    onChildAdded(ordersRef, (snapshot) => {
        const orderId = snapshot.key;
        const orderData = snapshot.val();

        if (orderData && orderData.status !== 'delivered' && !displayedOrders.has(orderId)) {
            const isBrandNew = (orderData.status === 'new');
            handleNewOrder(orderId, orderData, isBrandNew);
        }
    });

    // Listen for changes (e.g., if marked delivered from another device)
    onChildChanged(ordersRef, (snapshot) => {
        const orderId = snapshot.key;
        const orderData = snapshot.val();
        if (orderData && orderData.status === 'delivered') {
            const card = document.getElementById(`order-${orderId}`);
            if (card) {
                card.style.opacity = '0.7';
                card.style.borderColor = '#27ae60';
                card.style.backgroundColor = '#f4fbf7';
                const footer = card.querySelector('.order-footer');
                if (footer) {
                    const printBtn = footer.querySelector('.print-btn');
                    if (printBtn) {
                        printBtn.textContent = '✅ مسلمة للمندوب';
                        printBtn.disabled = true;
                        printBtn.style.background = '#95a5a6';
                        printBtn.style.cursor = 'not-allowed';
                    }
                }
            }
        }
    });

    // Option to let them know it's working
    console.log('[RECEIVER] Listening strictly to branch:', branchId);
}

function handleNewOrder(orderId, orderData, isBrandNew) {
    displayedOrders.add(orderId);

    // 1. Play sound and auto-print only if it's new
    if (isBrandNew) {
        playSound();

        let doAutoPrint = true;
        if (autoPrintToggle) {
            doAutoPrint = autoPrintToggle.checked;
        }

        if (doAutoPrint) {
            printOnlineOrder(orderData);
        }

        // 2. Update status in firebase to "received" to prevent looping
        const statusRef = ref(database, `online_orders/${CLIENT.id}/${branchId}/${orderId}/status`);
        set(statusRef, 'received').catch(e => console.error("Could not update state:", e));
    }

    // 3. Add to UI
    renderOrderCard(orderId, orderData);
}

function renderOrderCard(orderId, orderData) {
    if (emptyState) emptyState.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'order-card';
    card.id = `order-${orderId}`;

    let itemsHtml = orderData.items.map(i => `
        <li>
            <span>${i.quantity}x ${i.productName}</span>
            <span style="color:#7f8c8d">${i.price * i.quantity} ريال</span>
        </li>
    `).join('');

    card.innerHTML = `
        <div class="order-header">
            <span class="order-number">طلب #ONL-${orderData.orderNumber}</span>
            <span class="order-time">${new Date(orderData.timestamp).toLocaleTimeString('ar-SA')}</span>
        </div>
        <div class="customer-info">
            عميل: <span>${orderData.customerName || 'بدون اسم'}</span><br>
            جوال: <span dir="ltr">${orderData.customerPhone || 'بدون رقم'}</span>
        </div>
        <ul class="items-list">
            ${itemsHtml}
        </ul>
        <div class="order-footer">
            <button class="reprint-btn" onclick="window.reprintOrder('${orderId}')">طباعة مجدداً 🖨️</button>
            <button class="print-btn" onclick="window.markDelivered('${orderId}')">✅ تم التسليم</button>
        </div>
        <div style="font-size: 15px; font-weight: bold; color: #2ecc71; text-align: left; margin-top: 5px;">${orderData.totalAmount} ريال</div>
    `;

    // Keep data in DOM for re-printing
    card.dataset.orderInfo = JSON.stringify(orderData);

    // Prevent oldest from disappearing randomly unless we refresh, but keep recent on top
    ordersGrid.insertBefore(card, ordersGrid.firstChild);
}

// Attach reprint function globally
window.reprintOrder = function (orderId) {
    const card = document.getElementById(`order-${orderId}`);
    if (card && card.dataset.orderInfo) {
        const orderData = JSON.parse(card.dataset.orderInfo);
        printOnlineOrder(orderData);
        showToast('جاري إعادة الطباعة...', 'success');
    }
}

// Attach Mark as Delivered globally
window.markDelivered = function (orderId) {
    const card = document.getElementById(`order-${orderId}`);
    if (card && card.dataset.orderInfo) {
        const orderData = JSON.parse(card.dataset.orderInfo);
        const orderRef = ref(database, `online_orders/${CLIENT.id}/${branchId}/${orderId}/status`);

        // Mark in branch queue
        set(orderRef, 'delivered').then(() => {
            showToast('تم تسليم الطلب للعميل بنجاح', 'success');
            // Do NOT remove card - explicitly requested by user
            card.style.opacity = '0.7';
            card.style.borderColor = '#27ae60';
            card.style.backgroundColor = '#f4fbf7';

            const printBtn = card.querySelector('.print-btn');
            if (printBtn) {
                printBtn.textContent = '✅ مسلمة للمندوب';
                printBtn.disabled = true;
                printBtn.style.background = '#95a5a6';
                printBtn.style.cursor = 'not-allowed';
            }

            // Now mark in user history if keys are present
            if (orderData.customerPhone && orderData.userRefKey) {
                const userRef = ref(database, `customers/${orderData.customerPhone}/orders/${orderData.userRefKey}/status`);
                set(userRef, 'delivered');
            }
        }).catch(err => {
            showToast('حدث خطأ أثناء حفظ الحالة', 'error');
            console.error(err);
        });
    }
}

// Start sequence
refreshAllData().then(() => {
    initializeReceiver();
}).catch(err => {
    console.error('Failed to load data:', err);
    showToast('خطأ في تحميل قاعدة البيانات', 'error');
});
