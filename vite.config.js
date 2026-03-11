import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// بلوقن (إضافة) خاص للتعامل مع حفظ الملفات من واجهة الإدارة لجهازك محلياً
function localSavePlugin() {
    return {
        name: 'local-save-plugin',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url === '/api/save-file' && req.method === 'POST') {
                    let body = '';
                    req.on('data', chunk => { body += chunk.toString(); });
                    req.on('end', () => {
                        try {
                            const data = JSON.parse(body);
                            if (data.clientsJson) {
                                fs.writeFileSync(path.resolve('clients.json'), data.clientsJson);
                            }
                            if (data.configJs) {
                                fs.writeFileSync(path.resolve('config.js'), data.configJs);
                            }
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true }));
                        } catch (err) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: err.message }));
                        }
                    });
                } else {
                    next();
                }
            });
        }
    };
}

export default defineConfig({
    plugins: [localSavePlugin()],
    root: '.',
    build: {
        outDir: 'dist',
        rollupOptions: {
            // Firebase CDN imports - keep as external
            external: [
                /^https:\/\/www\.gstatic\.com\/firebasejs\/.*/
            ]
        }
    },
    server: {
        port: 3000,
        open: true
    }
});
