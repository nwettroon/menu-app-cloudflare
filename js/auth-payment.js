import { state, showToast, CLIENT } from './core.js';
import { database, get, ref, push, set, onValue, currentBranchId } from './firebase.js';

// Customer state
export let customerState = {
    isLoggedIn: false,
    phone: '',
    name: '',
    uid: '' // Simplified: using phone as UID for now
};
// Check local storage for existing session
export function initAuth() {
    try {
        const saved = localStorage.getItem('customerAuth_' + CLIENT.id);
        if (saved) {
            customerState = JSON.parse(saved);
        }
    } catch (e) { }

    renderMyOrdersButton();
    checkMoyasarReturnUrl();
}

// Check for redirect from Moyasar (3D Secure or STC Pay)
async function checkMoyasarReturnUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const id = urlParams.get('id');
    const message = urlParams.get('message');

    if (id && status) {
        if (status === 'paid' || status === 'authorized') {
            try {
                const pendingDataStr = localStorage.getItem('pending_payment_cart_' + CLIENT.id);
                if (pendingDataStr) {
                    const pendingData = JSON.parse(pendingDataStr);
                    // Only save if it's not already saved to prevent duplicates on refresh
                    if (!localStorage.getItem('processed_payment_' + id)) {
                        await saveOnlineOrder(pendingData.total, pendingData.cart);
                        localStorage.setItem('processed_payment_' + id, 'true');
                        localStorage.removeItem('pending_payment_cart_' + CLIENT.id);

                        // Clear actual cart
                        state.cart = [];
                        showToast('تم الدفع وتأكيد الطلب بنجاح! 🎉', 'success');

                        // Clean URL silently
                        window.history.replaceState({}, document.title, window.location.pathname + "?branch=" + (urlParams.get('branch') || 'main'));
                    }
                }
            } catch (err) {
                console.error("Error recovering order", err);
            }
        } else if (status === 'failed') {
            showToast('عذراً، فشلت عملية الدفع (' + (message || 'مرفوضة') + ')', 'error');
            window.history.replaceState({}, document.title, window.location.pathname + "?branch=" + (urlParams.get('branch') || 'main'));
        }
    }
}

function saveCustomerState() {
    localStorage.setItem('customerAuth_' + CLIENT.id, JSON.stringify(customerState));
}

export function handleOnlineCheckout(total, items, proceedToPayment) {
    if (!customerState.isLoggedIn) {
        showAuthModal(() => {
            proceedToPayment();
        });
    } else {
        proceedToPayment();
    }
}

function showAuthModal(onSuccess) {
    let modal = document.getElementById('authModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'authModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content form-modal">
                <button class="close-modal" id="closeAuthModal">&times;</button>
                <h2 id="authTitle">تسجيل الدخول / الدفع</h2>
                <div class="form-section">
                    <input type="tel" id="authPhone" placeholder="رقم الجوال (مثال: 05...)" required>
                </div>
                <div class="form-section">
                    <input type="password" id="authPassword" placeholder="كلمة المرور" required>
                </div>
                <!-- For registration -->
                <div id="registerFields" style="display: none;">
                    <div class="form-section">
                        <input type="text" id="authName" placeholder="الاسم الكامل">
                    </div>
                </div>
                <div style="font-size: 13px; color: #888; margin-bottom: 15px; text-align: center;">
                    <a href="#" id="toggleAuthMode" style="color: #f26d21;">مستخدم جديد؟ إنشاء حساب</a>
                </div>
                <div class="form-footer">
                    <button type="button" class="save-btn" id="submitAuthBtn" style="width: 100%;">دخول للمتابعة</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        let isLogin = true;
        const toggleBtn = modal.querySelector('#toggleAuthMode');
        const regFields = modal.querySelector('#registerFields');
        const nameInput = modal.querySelector('#authName');
        const submitBtn = modal.querySelector('#submitAuthBtn');
        const title = modal.querySelector('#authTitle');

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isLogin = !isLogin;
            if (isLogin) {
                regFields.style.display = 'none';
                toggleBtn.textContent = 'مستخدم جديد؟ إنشاء حساب';
                submitBtn.textContent = 'دخول للمتابعة';
                title.textContent = 'تسجيل الدخول / الدفع';
            } else {
                regFields.style.display = 'block';
                toggleBtn.textContent = 'لديك حساب؟ تسجيل الدخول';
                submitBtn.textContent = 'إنشاء حساب ومتابعة';
                title.textContent = 'إنشاء حساب جديد';
            }
        });

        modal.querySelector('#closeAuthModal').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        submitBtn.addEventListener('click', async () => {
            const phone = modal.querySelector('#authPhone').value.trim();
            const pass = modal.querySelector('#authPassword').value.trim();
            const name = nameInput.value.trim();

            if (!phone || !pass) {
                showToast('يرجى تعبئة الجوال وكلمة المرور', 'error');
                return;
            }

            // Simple validation simulation
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري التحقق...';

            // Simulate Firebase call to clients base node
            const userRef = ref(database, `customers/${phone}`);

            try {
                const snapshot = await get(userRef);
                const userData = snapshot.val();

                if (isLogin) {
                    if (!userData) {
                        showToast('رقم الجوال غير مسجل لدينا، يرجى إنشاء حساب جديد', 'error');
                    } else if (userData.password === pass) {
                        customerState = { isLoggedIn: true, phone, name: userData.name, uid: phone };
                        saveCustomerState();
                        showToast('تم تسجيل الدخول بنجاح', 'success');
                        modal.classList.remove('active');
                        if (onSuccess) onSuccess();
                    } else {
                        showToast('كلمة المرور خاطئة، حاول مجدداً', 'error');
                    }
                } else {
                    if (!name) {
                        showToast('يرجى إدخال الاسم', 'error');
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'إنشاء حساب ومتابعة';
                        return;
                    }
                    if (userData) {
                        showToast('رقم الجوال مسجل مسبقاً، يرجى تسجيل الدخول', 'error');
                    } else {
                        await set(userRef, { name, password: pass, createdAt: Date.now() });
                        customerState = { isLoggedIn: true, phone, name, uid: phone };
                        saveCustomerState();
                        showToast('تم إنشاء الحساب بنجاح', 'success');
                        modal.classList.remove('active');
                        if (onSuccess) onSuccess();
                    }
                }
            } catch (err) {
                console.error(err);
                showToast('حدث خطأ في الاتصال', 'error');
            }

            submitBtn.disabled = false;
            submitBtn.textContent = isLogin ? 'دخول للمتابعة' : 'إنشاء حساب ومتابعة';
        });
    }

    // Reset inputs
    modal.querySelector('#authPhone').value = customerState.phone || '';
    modal.querySelector('#authPassword').value = '';

    modal.classList.add('active');
}

// ==== Moyasar Payment Integration ====
export function processMoyasarPayment(totalAmount, cartItems, onSuccess) {
    if (!CLIENT.moyasarPublishableKey) {
        showToast('طريقة الدفع غير متوفرة حالياً', 'error');
        return;
    }

    let modal = document.getElementById('paymentModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'paymentModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    // إفراغ وإعادة بناء المحتوى لإجبار ميسر على العمل مجدداً عند كل دفع
    if (state.simulatePayment) {
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; padding: 20px;">
                <button class="close-modal" id="closePaymentModal">&times;</button>
                <h2 style="text-align: center; margin-bottom: 20px; color: #444;">الدفع الإلكتروني (محاكاة)</h2>
                
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-size: 18px; font-weight: bold; color: #2ecc71;">
                    المبلغ المطلوب: ${totalAmount} ريال
                </div>

                <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
                    <p style="font-size: 14px; color: #555; margin-bottom: 10px; text-align: center;">وضع الصيانة والمحاكاة الفعال</p>
                    <button id="simPayBtn" style="background: #000; color: #fff; width: 100%; padding: 15px; border-radius: 8px; border: none; font-size: 16px; font-weight: bold; cursor: pointer; margin-bottom: 10px;">💳 تأكيد الدفع الوهمي</button>
                    <p style="font-size: 11px; color: #999; text-align: center;">لن يتم خصم أي مبالغ. هذا الخيار مخصص لاختبار نظام الطلبات فقط.</p>
                </div>
            </div>
        `;
    } else {
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; padding: 20px;">
                <button class="close-modal" id="closePaymentModal">&times;</button>
                <h2 style="text-align: center; margin-bottom: 20px; color: #444;">الدفع الإلكتروني (ميسر)</h2>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-size: 18px; font-weight: bold; color: #2ecc71;">
                    المبلغ المطلوب: ${totalAmount} ريال
                </div>
                <div class="mysr-form" style="min-height: 250px;"></div>
            </div>
        `;
    }

    modal.querySelector('#closePaymentModal').addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modal.classList.add('active');

    if (state.simulatePayment) {
        const simBtn = modal.querySelector('#simPayBtn');
        if (simBtn) {
            simBtn.addEventListener('click', async () => {
                simBtn.textContent = 'جاري الدفع...';
                simBtn.disabled = true;

                // محاكاة الاتصال ببوابة الدفع
                setTimeout(async () => {
                    try {
                        // Send order to online queue
                        await saveOnlineOrder(totalAmount, cartItems);
                        modal.classList.remove('active');
                        if (onSuccess) onSuccess();
                        showToast('تم الدفع الوهمي وإرسال طلبك للمطعم بنجاح! 🎉', 'success');
                    } catch (e) {
                        showToast('فشل إرسال الطلب', 'error');
                    }
                    simBtn.textContent = '💳 تأكيد الدفع الوهمي';
                    simBtn.disabled = false;
                }, 1500);
            });
        }
    } else {
        try {
            // تهيئة نموذج الدفع الحقيقي من ميسر
            Moyasar.init({
                element: '.mysr-form',
                amount: totalAmount * 100, // ميسر يقرأ بالهللة
                currency: 'SAR',
                description: `طلب لـ ${customerState.name}`,
                publishable_api_key: CLIENT.moyasarPublishableKey,
                callback_url: window.location.href.split('?')[0], // العودة لنفس الرابط
                methods: ['creditcard', 'stcpay'],
                on_completed: function (payment) {
                    return new Promise(async (resolve, reject) => {
                        if (payment.status === 'paid') {
                            try {
                                await saveOnlineOrder(totalAmount, cartItems);
                                showToast('تم الدفع وإرسال طلبك للمطعم بنجاح! 🎉', 'success');
                                modal.classList.remove('active');
                                if (onSuccess) onSuccess();
                                resolve();
                            } catch (e) {
                                showToast('لم نتمكن من إرسال الطلب، تواصل مع الدعم', 'error');
                                reject('error_saving');
                            }
                        } else if (payment.status === 'initiated' || payment.status === 'authorized') {
                            // Payment needs redirection (e.g., 3D Secure or STC Pay OTP)
                            // Save cart temporarily so we don't lose it if the page reloads fully
                            localStorage.setItem('pending_payment_cart_' + CLIENT.id, JSON.stringify({
                                cart: cartItems,
                                total: totalAmount
                            }));
                            resolve(); // let Moyasar continue redirection
                        } else {
                            showToast('فشلت عملية الدفع، راجع بيانات البطاقة', 'error');
                            reject('payment_failed');
                        }
                    });
                }
            });
        } catch (e) {
            console.error('Moyasar Init Error', e);
            showToast('برجاء تحديث الصفحة، مشكلة في تحميل بوابة الدفع', 'error');
        }
    }
}

async function saveOnlineOrder(totalAmount, cartItems) {
    // Save to branch queue
    const branchId = currentBranchId || 'main';
    const orderRef = ref(database, `online_orders/${CLIENT.id}/${branchId}`);

    // Create random order number
    const orderNumber = Math.floor(1000 + Math.random() * 9000);

    const newOrder = {
        orderNumber,
        customerName: customerState.name,
        customerPhone: customerState.phone,
        items: cartItems,
        totalAmount,
        timestamp: Date.now(),
        status: 'new' // new, preparing, ready
    };

    // Push references
    const orderRefNode = push(orderRef);
    const userHistoryRef = push(ref(database, `customers/${customerState.phone}/orders`));

    // Link references together
    newOrder.orderRefKey = orderRefNode.key;
    newOrder.userRefKey = userHistoryRef.key;
    newOrder.branchId = branchId; // Explicitly attach for local tracking

    // Save to branch queue
    await set(orderRefNode, newOrder);

    // Save to user's history
    await set(userHistoryRef, { ...newOrder, branchId, restaurantId: CLIENT.id });

    // Save locally for quick access
    let localOrders = JSON.parse(localStorage.getItem('myOnlineOrders_' + CLIENT.id) || '[]');
    // Clean old ones (24h = 86400000ms)
    localOrders = localOrders.filter(o => (Date.now() - o.timestamp) < 86400000);

    localOrders.push(newOrder);
    localStorage.setItem('myOnlineOrders_' + CLIENT.id, JSON.stringify(localOrders));

    renderMyOrdersButton();
}


// ==== UI For Customer Orders ====
export function renderMyOrdersButton() {
    let localOrders = JSON.parse(localStorage.getItem('myOnlineOrders_' + CLIENT.id) || '[]');
    localOrders = localOrders.filter(o => (Date.now() - o.timestamp) < 86400000); // Only last 24h
    localStorage.setItem('myOnlineOrders_' + CLIENT.id, JSON.stringify(localOrders));

    let btn = document.getElementById('myOrdersFloatingBtn');
    if (localOrders.length === 0) {
        if (btn) btn.style.display = 'none';
        return;
    }

    if (!btn) {
        btn = document.createElement('div');
        btn.id = 'myOrdersFloatingBtn';
        btn.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 20px;
            right: 20px;
            background: #2ecc71;
            color: #fff;
            padding: 12px 20px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(46, 204, 113, 0.4);
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 999;
            cursor: pointer;
            font-weight: bold;
        `;
        btn.innerHTML = `
            <span>🛍️ طلباتي النشطة (${localOrders.length})</span>
            <span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 6px; font-size: 13px;">استعراض الفاتورة</span>
        `;
        document.body.appendChild(btn);

        btn.addEventListener('click', showMyOrdersModal);
    } else {
        btn.style.display = 'flex';
        btn.querySelector('span').innerHTML = `🛍️ طلباتي النشطة (${localOrders.length})`;
    }
}

function showMyOrdersModal() {
    let modal = document.getElementById('myOrdersModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'myOrdersModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    let localOrders = JSON.parse(localStorage.getItem('myOnlineOrders_' + CLIENT.id) || '[]');
    localOrders = localOrders.filter(o => (Date.now() - o.timestamp) < 86400000);

    let ordersHtml = localOrders.map(o => `
        <div id="customer-order-${o.orderRefKey}" style="border: 1px solid #eee; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #fff; transition: opacity 0.3s ease;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <strong>طلب #${o.orderNumber}</strong>
                <span id="order-badge-${o.orderRefKey}" style="color: #f39c12; font-weight: bold; background: #fff3cd; padding: 2px 8px; border-radius: 4px;">جاري المراجعة</span>
            </div>
            <div style="font-size: 13px; color: #666; margin-bottom: 10px;">
                ${new Date(o.timestamp).toLocaleString('ar-SA')}
            </div>
            <div style="background: #fdfdfd; padding: 10px; border-radius: 6px;">
                ${o.items.map(i => `
                    <div style="display:flex; justify-content:space-between; font-size: 13px; margin-bottom: 5px; border-bottom: 1px dashed #eee; padding-bottom: 5px;">
                        <span>${i.quantity}x ${i.productName}</span>
                        <span>${i.price * i.quantity} ريال</span>
                    </div>
                `).join('')}
                <div style="display:flex; justify-content:space-between; font-weight: bold; margin-top: 10px;">
                    <span>الإجمالي:</span>
                    <span>${o.totalAmount} ريال</span>
                </div>
            </div>
            <div style="text-align: center; margin-top: 15px; font-size: 12px; color: #888; background: #f0f7ff; padding: 8px; border-radius: 6px;">
                👨‍🍳 أظهر هذا الإيصال للكاشير عند الاستلام
            </div>
        </div>
    `).reverse().join('');

    modal.innerHTML = `
        <div class="modal-content">
            <button class="close-modal" id="closeMyOrdersModal">&times;</button>
            <h2 style="margin-bottom: 20px; color: #333;">🧾 إيصالات الطلبات</h2>
            <div style="max-height: 70vh; overflow-y: auto; padding-right: 5px;">
                ${ordersHtml || '<p style="text-align:center; color:#999;">لا توجد طلبات</p>'}
            </div>
        </div>
    `;

    modal.querySelector('#closeMyOrdersModal').addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modal.classList.add('active');

    // Attach real-time status listeners
    localOrders.forEach(o => {
        if (!o.orderRefKey) return;
        const statusRef = ref(database, `online_orders/${CLIENT.id}/${o.branchId || 'main'}/${o.orderRefKey}/status`);
        onValue(statusRef, (snap) => {
            const status = snap.val();
            const badge = document.getElementById(`order-badge-${o.orderRefKey}`);
            const card = document.getElementById(`customer-order-${o.orderRefKey}`);

            if (!badge || !card) return;

            if (status === 'delivered') {
                badge.style.color = '#27ae60';
                badge.style.background = '#e9f7ef';
                badge.textContent = '✅ تم الاستلام';
                card.style.opacity = '0.6';
            } else if (status === 'received') {
                badge.style.color = '#3498db';
                badge.style.background = '#eaf2f8';
                badge.textContent = '👨‍🍳 جاري التجهيز';
            } else {
                badge.style.color = '#f39c12';
                badge.style.background = '#fff3cd';
                badge.textContent = '🕒 طلب جديد';
            }
        });
    });
}
