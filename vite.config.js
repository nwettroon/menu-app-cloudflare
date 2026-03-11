import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [],
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
