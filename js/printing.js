/**
 * js/printing.js - نظام الطباعة
 * #4: إصلاح double resolve في htmlToImage
 */
import { state, formatNumber, showToast, CLIENT } from './core.js';
import { saveSettings } from './firebase.js';
import { updateCartCount, closeCartModal } from './cart.js';

// import دائري - نشيل shiftsState بشكل lazy
function getActiveShift() {
    try { return window._shiftsState ? window._shiftsState.currentShift : null; } catch (e) { return null; }
}

// ====== كشف نظام التشغيل ======
export function detectOS() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(ua)) return 'Android';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'iOS';
    if (/Win/i.test(ua)) return 'Windows';
    if (/Mac/i.test(ua)) return 'Mac';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
}

export function isSplitInvoiceEnabled() { return state.splitInvoice === true; }
export function getPrintMethod() { return state.printMethod || 'image'; }

export function getNextInvoiceNumber() {
    state.invoiceCounter = (typeof state.invoiceCounter === 'number' ? state.invoiceCounter + 1 : 1);
    saveSettings(true);
    return String(state.invoiceCounter);
}

// ====== تنسيق النصوص ======
function centerText(text, width = 32) {
    const padding = Math.floor((width - text.length) / 2);
    return ' '.repeat(Math.max(0, padding)) + text;
}

function formatItemLine(left, right) {
    const totalWidth = 32;
    const spaces = totalWidth - left.length - right.length;
    return left + ' '.repeat(Math.max(1, spaces)) + right;
}

function encodeToBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

// ====== إنشاء نص الفاتورة ======
export function generateInvoiceText(items, invoiceNumber, total, categoryName = null) {
    const date = new Date();
    const dateStr = date.toLocaleDateString('ar-SA');
    const timeStr = date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const restaurantName = CLIENT.name;
    const doubleLine = '================================';
    const singleLine = '--------------------------------';
    const thinLine = '- - - - - - - - - - - - - - - -';
    const isCategoryInvoice = categoryName !== null;
    let text = '\n';

    if (!isCategoryInvoice) {
        text += doubleLine + '\n';
        text += centerText('■ ' + restaurantName + ' ■', 32) + '\n';
        text += doubleLine + '\n\n';
    }

    text += singleLine + '\n';
    text += formatItemLine('رقم الفاتورة:', `[ ${invoiceNumber} ]`) + '\n';

    // بيانات الوردية (إذا كانت مفتوحة)
    const activeShift = getActiveShift();
    if (activeShift && !isCategoryInvoice) {
        text += formatItemLine('الموظف:', activeShift.userName || '') + '\n';
        text += formatItemLine('رقم الوردية:', `#${activeShift.shiftNumber || ''}`) + '\n';
    }

    if (categoryName) {
        text += doubleLine + '\n';
        text += centerText(`■■■ ${categoryName} ■■■`, 32) + '\n';
        text += doubleLine + '\n';
    }
    text += singleLine + '\n';
    text += formatItemLine('التاريخ:', dateStr) + '\n';
    text += formatItemLine('الوقت:', timeStr) + '\n';
    text += singleLine + '\n\n';
    text += centerText('*** الأصناف المطلوبة ***', 32) + '\n';
    text += doubleLine + '\n';

    items.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        const size = item.size ? ` (${item.size})` : '';
        const type = item.type ? ` - ${item.type}` : '';
        text += `${index + 1}. ${item.productName}${type}${size}\n`;
        text += formatItemLine(`   الكمية: ${item.quantity} ×`, `${itemTotal} ريال`) + '\n';
        text += thinLine + '\n';
    });

    text += '\n';
    if (!isCategoryInvoice) {
        text += doubleLine + '\n';
        text += formatItemLine('المجموع الكلي:', `${total} ريال`) + '\n';
        text += doubleLine + '\n\n';
        text += centerText('═══════════════════════════════', 32) + '\n';
        const paymentText = isSplitInvoiceEnabled() ? 'تم الدفع' : 'توجه للكاشير للدفع';
        text += centerText(paymentText, 32) + '\n';
        text += centerText('نسعد بخدمتكم دائماً', 32) + '\n';
        text += centerText('═══════════════════════════════', 32) + '\n';
    }
    text += '\n\n\n';
    return text;
}

// ====== تحويل HTML إلى صورة (محسّن للجوال) ======
export async function htmlToImage(invoiceHTML, width = 560) {
    return new Promise((resolve, reject) => {
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = `position:fixed;left:-9999px;top:0;width:${width}px;max-width:${width}px;background:white;padding:0;margin:0;overflow:hidden;direction:ltr;`;
        tempDiv.innerHTML = invoiceHTML;
        document.body.appendChild(tempDiv);

        html2canvas(tempDiv, {
            scale: 1,          // كانت 2 وتسبب بطء شديد على الجوال
            backgroundColor: '#ffffff',
            logging: false,
            width: width,
            windowWidth: width,
            useCORS: true,
            imageTimeout: 0,   // لا ننتظر تحميل صور خارجية
            removeContainer: true
        }).then(canvas => {
            if (document.body.contains(tempDiv)) document.body.removeChild(tempDiv);
            resolve(canvas);   // نستخدم الكانفاس مباشرة بدون إعادة رسم
        }).catch(error => {
            if (document.body.contains(tempDiv)) document.body.removeChild(tempDiv);
            reject(error);
        });
    });
}

// ====== تحويل Canvas إلى ESC/POS Bitmap (محسّن بـ Uint32Array) ======
export function canvasToESCPOSBitmap(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    let height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    // Uint32Array أسرع 4x من الوصول لكل بايت على حدة
    const pixels32 = new Uint32Array(imageData.data.buffer);
    const pixels = imageData.data;

    // قص المساحة البيضاء من الأسفل
    let lastNonWhiteRow = 0;
    for (let y = height - 1; y >= 0; y--) {
        const rowStart = y * width;
        for (let x = 0; x < width; x++) {
            // 0xFFFFFFFF = أبيض (ABGR in little-endian)
            if ((pixels32[rowStart + x] & 0x00FFFFFF) !== 0x00FFFFFF) {
                lastNonWhiteRow = y;
                y = -1; // كسر الحلقة الخارجية
                break;
            }
        }
    }
    height = Math.min(lastNonWhiteRow + 1, canvas.height);

    const threshold = 150;
    const bitmapWidth = Math.ceil(width / 8) * 8;
    const bytesPerLine = bitmapWidth / 8;
    const totalBytes = bytesPerLine * height;
    const bitmapData = new Uint8Array(totalBytes);

    for (let y = 0; y < height; y++) {
        const rowOffset = y * bytesPerLine;
        const pixelRow = y * width;
        for (let x = 0; x < width; x++) {
            const idx = (pixelRow + x) * 4;
            // حساب السطوع بسرعة باستخدام bit shift بدل القسمة
            const gray = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]);
            if (gray < threshold * 3) { // المقارنة بـ 450 بدل القسمة على 3
                bitmapData[rowOffset + (x >> 3)] |= (128 >> (x & 7));
            }
        }
    }

    // بناء أوامر ESC/POS مباشرة في مصفوفة واحدة
    const headerLen = 13;
    const footerLen = 5;
    const result = new Uint8Array(headerLen + totalBytes + footerLen);
    // Header: ESC @ ESC a 1 GS v 0 0 ...
    result.set([0x1B, 0x40, 0x1B, 0x61, 0x01, 0x1D, 0x76, 0x30, 0x00,
        bytesPerLine & 0xFF, (bytesPerLine >> 8) & 0xFF,
        height & 0xFF, (height >> 8) & 0xFF]);
    result.set(bitmapData, headerLen);
    // Footer: LF GS V A 0
    result.set([0x0A, 0x1D, 0x56, 0x41, 0x00], headerLen + totalBytes);
    return result;
}

function createESCPOSData(text) {
    const ESC = '\x1B', GS = '\x1D';
    let d = ESC + '@' + ESC + 't\x16' + ESC + 'a\x01' + text + '\n\n\n' + GS + 'V\x41\x03';
    return d;
}

// ====== إنشاء HTML الفاتورة ======
export function generateInvoiceHTML(items, invoiceNumber, total, categoryName = null, width = 560, largeFonts = false) {
    const date = new Date();
    const dateStr = date.toLocaleDateString('ar-SA');
    const timeStr = date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const restaurantName = CLIENT.name;

    let itemsHTML = '';
    items.forEach((item) => {
        const itemTotal = item.price * item.quantity;
        const size = item.size ? ` (${item.size})` : '';
        const type = item.type ? ` - ${item.type}` : '';
        itemsHTML += `<div class="item"><div class="item-left"><div class="item-name">${item.productName}${type}${size}</div><div class="item-qty">× ${item.quantity}</div></div><div class="item-price">${itemTotal} ريال</div></div>`;
    });

    const isCategoryInvoice = categoryName !== null;
    const categoryLabel = categoryName ? `<div class="category-label">القسم: ${categoryName}</div>` : '';

    // بيانات الوردية
    const activeShift = getActiveShift();
    const shiftHTML = (!isCategoryInvoice && activeShift)
        ? `<div class="shift-line">الموظف: <strong>${activeShift.userName}</strong> &nbsp;|وردية: <strong>#${activeShift.shiftNumber}</strong></div>`
        : '';

    const paymentText = isSplitInvoiceEnabled() ? 'تم الدفع' : 'وجه الى الكاشير للدفع';
    const headerHTML = !isCategoryInvoice ? `<div class="header"><h1>${restaurantName}</h1><div class="sub-header">${paymentText}</div></div>` : '';
    const totalHTML = !isCategoryInvoice ? `<div class="total"><span>الإجمالي:</span><span>${total} ريال</span></div>` : '';

    const fs = largeFonts ? { h1: 34, subHeader: 20, meta: 20, label: 20, value: 20, datetime: 18, catLabel: 18, item: 18, itemName: 20, qty: 18, price: 20, total: 26, padding: '22px 16px 0 16px', headerPb: 14, headerMb: 16, metaMargin: 14, invMb: 10, valuePad: '5px 14px', dtMt: 10, catMargin: 10, catPad: 8, itemsMt: 14, itemsPad: 12, itemPad: 10, gap: 8, qtyMin: 42, priceW: 100, totalMt: 14, totalPad: '12px 0 18px 0' } : { h1: 30, subHeader: 18, meta: 18, label: 18, value: 18, datetime: 16, catLabel: 16, item: 16, itemName: 18, qty: 16, price: 18, total: 22, padding: '20px 16px 0 16px', headerPb: 12, headerMb: 16, metaMargin: 12, invMb: 10, valuePad: '5px 12px', dtMt: 10, catMargin: 10, catPad: 6, itemsMt: 14, itemsPad: 10, itemPad: 8, gap: 8, qtyMin: 40, priceW: 95, totalMt: 12, totalPad: '12px 0 20px 0' };

    return `<style>.invoice{font-family:Arial,sans-serif;width:${width}px;max-width:${width}px;border:2px solid #000;padding:${fs.padding};background:white;direction:rtl;text-align:right;box-sizing:border-box;margin:0;overflow:hidden}.header{border-bottom:2px solid #000;padding-bottom:${fs.headerPb}px;margin-bottom:${fs.headerMb}px;text-align:center}.header h1{margin:0 0 8px 0;padding:0;font-size:${fs.h1}px;font-weight:bold}.sub-header{font-size:${fs.subHeader}px;color:#444;font-weight:500}.invoice-meta{font-size:${fs.meta}px;margin:${fs.metaMargin}px 0}.invoice-number-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:${fs.invMb}px}.inv-label{font-size:${fs.label}px;font-weight:bold}.inv-value{font-size:${fs.value}px;font-weight:700;border:1.5px solid #999;padding:${fs.valuePad};border-radius:5px;background:#f5f5f5}.shift-line{font-size:${fs.datetime}px;font-weight:600;color:#333;margin-top:6px;padding:5px 8px;background:#f0f7ff;border-radius:5px;border:1px solid #c5d8f0;text-align:right;direction:rtl}.invoice-datetime{margin-top:${fs.dtMt}px;font-size:${fs.datetime}px;font-weight:bold;color:#000}.category-label{font-size:${fs.catLabel}px;margin:${fs.catMargin}px 0;color:#000;font-weight:bold;text-align:center;background:#f9f9f9;padding:${fs.catPad}px;border:2px solid #000;border-radius:5px}.items{margin:${fs.itemsMt}px 0 0 0;border-top:1.5px solid #ddd;border-bottom:1.5px solid #ddd;padding:${fs.itemsPad}px 0}.item{display:flex;justify-content:space-between;align-items:center;padding:${fs.itemPad}px 0;font-size:${fs.item}px;border-bottom:1px solid #eee}.item:last-child{border-bottom:none}.item-left{display:flex;flex:1;gap:${fs.gap}px;align-items:center;justify-content:flex-end;min-width:0;flex-wrap:wrap}.item-name{font-size:${fs.itemName}px;font-weight:600;word-wrap:break-word;white-space:normal}.item-qty{min-width:${fs.qtyMin}px;text-align:center;font-weight:700;font-size:${fs.qty}px;flex-shrink:0}.item-price{width:${fs.priceW}px;text-align:left;font-size:${fs.price}px;font-weight:700;flex-shrink:0}.total{display:flex;justify-content:space-between;font-weight:bold;margin-top:${fs.totalMt}px;margin-bottom:0;padding:${fs.totalPad};border-top:2.5px solid #000;border-bottom:2.5px solid #000;font-size:${fs.total}px}</style><div class="invoice">${headerHTML}<div class="invoice-meta"><div class="invoice-number-row"><span class="inv-label">رقم الفاتورة:</span><span class="inv-value">${invoiceNumber}</span></div>${shiftHTML}${categoryLabel}<div class="invoice-datetime"><div>التاريخ: ${dateStr}</div><div>الوقت: ${timeStr}</div></div></div><div class="items">${itemsHTML}</div>${totalHTML}</div>`;
}

// ====== الطباعة على أندرويد ======
async function printOnAndroidAsImage(invoices) {
    try {
        if (typeof html2canvas === 'undefined') {
            showToast('جاري تحميل مكتبة الطباعة...', 'info', 2000);
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (typeof html2canvas === 'undefined') throw new Error('html2canvas not loaded');
        }
        showToast('جاري تحضير الفواتير للطباعة...', 'info', 2000);

        // تحضير جميع الصور بالتوازي لتسريع العملية
        const canvasPromises = invoices
            .filter(inv => inv && inv.items && inv.items.length)
            .map(invoice => {
                const invoiceHTML = generateInvoiceHTML(invoice.items, invoice.invoiceNumber || 'N/A', invoice.total || 0, invoice.categoryName || null, 576, true);
                return htmlToImage(invoiceHTML, 576).then(canvas => ({ canvas, invoice })).catch(err => ({ error: err, invoice }));
            });

        const results = await Promise.all(canvasPromises);

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.error) {
                console.error(`خطأ في الفاتورة ${i + 1}:`, result.error);
                showToast(`خطأ في الفاتورة ${i + 1}`, 'error', 2000);
                continue;
            }
            try {
                const bitmapCommands = canvasToESCPOSBitmap(result.canvas);
                const base64Data = arrayBufferToBase64(bitmapCommands.buffer);
                if (i > 0) await new Promise(resolve => setTimeout(resolve, 800));
                window.location.href = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
                showToast(`تم إرسال فاتورة ${i + 1} من ${results.length}`, 'success', 1200);
            } catch (error) {
                console.error(`خطأ في الفاتورة ${i + 1}:`, error);
                showToast(`خطأ في الفاتورة ${i + 1}: ${error.message}`, 'error', 2000);
            }
        }
        showToast('تم إرسال جميع الفواتير للطباعة! ✓', 'success', 2000);
        setTimeout(() => { state.cart = []; updateCartCount(); closeCartModal(); }, 1000);
    } catch (error) {
        console.error('خطأ في الطباعة:', error);
        showToast('خطأ في الطباعة. تأكد من تثبيت RawBT', 'error', 5000);
    }
}

async function printOnAndroidAsText(invoices) {
    try {
        if (!invoices || !invoices.length) { showToast('لا توجد فواتير', 'error', 2000); return; }
        let combinedText = '';
        invoices.forEach((invoice, index) => {
            if (!invoice || !invoice.text) return;
            combinedText += invoice.text;
            if (index < invoices.length - 1) {
                combinedText += '\n\n' + '■'.repeat(32) + '\n' + centerText('▼ الفاتورة التالية ▼', 32) + '\n' + '■'.repeat(32) + '\n\n';
            }
        });
        if (!combinedText) { showToast('فشل إنشاء نص الفواتير', 'error', 2000); return; }
        const escposData = createESCPOSData(combinedText);
        const base64Text = encodeToBase64(escposData);
        window.location.href = `intent:base64,${base64Text}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        showToast('تم إرسال الفواتير إلى RawBT', 'success');
        setTimeout(() => { state.cart = []; updateCartCount(); closeCartModal(); }, 1000);
    } catch (error) {
        console.error('خطأ في الطباعة:', error);
        showToast('خطأ في الطباعة. تأكد من تثبيت RawBT', 'error', 5000);
    }
}

async function printOnAndroid(invoices) {
    if (getPrintMethod() === 'image') await printOnAndroidAsImage(invoices);
    else await printOnAndroidAsText(invoices);
}

// ====== الطباعة على ويندوز ======
function printOnWindows(invoices) {
    try {
        let htmlContent = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طباعة</title><style>@media print{body{margin:0;padding:0}.invoice-wrapper{page-break-after:always;page-break-inside:avoid}.invoice-wrapper:last-child{page-break-after:auto}}body{font-family:Arial,sans-serif;margin:0;padding:0;background:white}.invoice-wrapper{display:flex;justify-content:center;padding:5px;background:white}@media screen{body{background:#f0f0f0}.invoice-wrapper{margin-bottom:20px}.invoice{box-shadow:0 0 10px rgba(0,0,0,0.1)}}</style></head><body>`;

        invoices.forEach((invoice) => {
            const items = invoice.items || state.cart;
            const total = invoice.total || calculateTotal(items);
            const html = generateInvoiceHTML(items, invoice.invoiceNumber, total, invoice.categoryName || null, 560);
            htmlContent += `<div class="invoice-wrapper">${html}</div>`;
        });

        htmlContent += `<script>window.onload=function(){setTimeout(function(){window.print()},500)};window.onafterprint=function(){setTimeout(function(){window.close()},500)};</script></body></html>`;

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) { showToast('تم حظر النافذة المنبثقة', 'error', 5000); return; }
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        showToast('جاري تحضير الفواتير للطباعة...', 'info');
        setTimeout(() => { state.cart = []; updateCartCount(); closeCartModal(); }, 1500);
    } catch (error) {
        console.error('خطأ في الطباعة:', error);
        showToast('خطأ في الطباعة', 'error');
    }
}

// ====== تجميع حسب الأقسام ======
function groupItemsByCategory(itemsToGroup = state.cart) {
    const grouped = {};
    itemsToGroup.forEach(item => {
        const product = state.products.find(p => p.id === item.productId);
        if (!product) return;
        const categoryId = product.categoryId;
        if (!grouped[categoryId]) {
            const category = state.categories.find(c => c.id === categoryId);
            grouped[categoryId] = { categoryId, categoryName: category ? category.name : 'غير محدد', items: [] };
        }
        grouped[categoryId].items.push(item);
    });
    return Object.values(grouped);
}

export function calculateTotal(items) {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// ====== الطباعة الرئيسية ======
export function printInvoice() {
    if (state.cart.length === 0) { showToast('السلة فارغة', 'error'); return; }

    const os = detectOS();
    const splitEnabled = isSplitInvoiceEnabled();
    const invoices = [];
    const mainInvoiceNumber = getNextInvoiceNumber();

    if (splitEnabled) {
        const totalAmount = calculateTotal(state.cart);
        invoices.push({ text: generateInvoiceText(state.cart, mainInvoiceNumber, totalAmount, null), type: 'main', invoiceNumber: mainInvoiceNumber, items: [...state.cart], total: totalAmount, categoryName: null });
        groupItemsByCategory().forEach((group, index) => {
            const groupTotal = calculateTotal(group.items);
            const subNum = `${mainInvoiceNumber}-${index + 1}`;
            invoices.push({ text: generateInvoiceText(group.items, subNum, groupTotal, group.categoryName), type: 'category', categoryName: group.categoryName, invoiceNumber: subNum, items: group.items, total: groupTotal });
        });
    } else {
        const totalAmount = calculateTotal(state.cart);
        invoices.push({ text: generateInvoiceText(state.cart, mainInvoiceNumber, totalAmount, null), type: 'single', invoiceNumber: mainInvoiceNumber, items: [...state.cart], total: totalAmount, categoryName: null });
    }

    if (os === 'Android') printOnAndroid(invoices);
    else printOnWindows(invoices);
}

// ====== طباعة الطلبات الأونلاين (يستخدمها receiver.html) ======
export function printOnlineOrder(order) {
    if (!order || !order.items || order.items.length === 0) return;

    const os = detectOS();
    const splitEnabled = isSplitInvoiceEnabled();
    const invoices = [];

    // We prefix online orders with 'ONL-' to distinguish them
    const mainInvoiceNumber = `ONL-${order.orderNumber}`;

    if (splitEnabled) {
        const totalAmount = order.totalAmount;
        invoices.push({ text: generateInvoiceText(order.items, mainInvoiceNumber, totalAmount, null), type: 'main', invoiceNumber: mainInvoiceNumber, items: [...order.items], total: totalAmount, categoryName: null });
        groupItemsByCategory(order.items).forEach((group, index) => {
            const groupTotal = calculateTotal(group.items);
            const subNum = `${mainInvoiceNumber}-${index + 1}`;
            invoices.push({ text: generateInvoiceText(group.items, subNum, groupTotal, group.categoryName), type: 'category', categoryName: group.categoryName, invoiceNumber: subNum, items: group.items, total: groupTotal });
        });
    } else {
        const totalAmount = order.totalAmount;
        invoices.push({ text: generateInvoiceText(order.items, mainInvoiceNumber, totalAmount, null), type: 'single', invoiceNumber: mainInvoiceNumber, items: [...order.items], total: totalAmount, categoryName: null });
    }

    if (os === 'Android') printOnAndroid(invoices);
    else printOnWindows(invoices);
}
