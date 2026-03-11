const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = 3000;

// === إصدار الملفات (Cache Busting) ===
// غيّر هذا الرقم كل مرة تحدّث فيها ملفات الموقع
const APP_VERSION = Date.now();

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    const defaultData = {
        categories: [
            { id: 1, name: 'بيتزا', image: 'images/بيبروني.jpg' },
            { id: 2, name: 'الشورما', image: 'images/شورما.jpg' },
            { id: 3, name: 'عصائر', image: 'images/عصائر.jpg' }
        ],
        products: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
}

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // API Routes
    if (pathname === '/api/data' && req.method === 'GET') {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end(data);
    } 
    else if (pathname === '/api/data' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    }
    // === API: حفظ ملف (يُستخدم من admin.html) ===
    else if (pathname === '/api/save-file' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { filename, content } = JSON.parse(body);
                // أمان: نمنع الكتابة خارج مجلد المشروع
                const safeName = path.basename(filename);
                const allowed = ['clients.json', 'config.js', '.firebaserc'];
                if (!allowed.includes(safeName)) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'File not allowed' }));
                    return;
                }
                fs.writeFileSync(path.join(__dirname, safeName), content, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, file: safeName }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    }
    // Serve static files
    else {
        let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
        
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>');
                return;
            }

            let contentType = 'text/html';
            if (filePath.endsWith('.js')) contentType = 'application/javascript';
            else if (filePath.endsWith('.css')) contentType = 'text/css';
            else if (filePath.endsWith('.json')) contentType = 'application/json';
            else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
            else if (filePath.endsWith('.png')) contentType = 'image/png';
            else if (filePath.endsWith('.gif')) contentType = 'image/gif';

            // === حل مشكلة الكاش: منع المتصفح من تخزين الملفات القابلة للتحديث ===
            const headers = { 'Content-Type': contentType };
            
            // الصور يمكن تخزينها لأنها نادراً ما تتغير (كاش لمدة ساعة)
            if (contentType.startsWith('image/')) {
                headers['Cache-Control'] = 'public, max-age=3600';
            } else {
                // ملفات HTML, CSS, JS, JSON: لا تخزين مؤقت أبداً
                headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0';
                headers['Pragma'] = 'no-cache';
                headers['Expires'] = '0';
                headers['Surrogate-Control'] = 'no-store';
                // ETag فريد لكل طلب لمنع الكاش
                headers['ETag'] = `"${Date.now()}-${Math.random()}"`;
            }

            // === إضافة version تلقائي لملفات CSS و JS داخل HTML ===
            let output = content;
            if (contentType === 'text/html') {
                let htmlStr = content.toString('utf8');
                // إضافة ?v=VERSION لكل ملفات CSS و JS المحلية
                htmlStr = htmlStr.replace(/(href|src)="([^"]*\.(css|js))(?:\?[^"]*)?"/g, (match, attr, file, ext) => {
                    // تجاهل الروابط الخارجية (http/https)
                    if (file.startsWith('http://') || file.startsWith('https://')) return match;
                    return `${attr}="${file}?v=${APP_VERSION}"`;
                });
                output = Buffer.from(htmlStr, 'utf8');
            }

            res.writeHead(200, headers);
            res.end(output);
        });
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
