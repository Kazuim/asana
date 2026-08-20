import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages などサブディレクトリ配信にも対応できるよう base は相対パスにする
export default defineConfig({
    base: './',
    build: {
        target: 'es2020',
        outDir: 'dist',
        assetsInlineLimit: 8192,
    },
    server: {
        host: true,
    },
    plugins: [
        // オフラインでも遊べるよう Service Worker を生成する
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg', 'icon-180.png'],
            manifest: {
                name: 'スマホ麻雀 — 四人打ちリーチ麻雀',
                short_name: 'スマホ麻雀',
                description: 'スマートフォンのブラウザだけで遊べる日本式リーチ麻雀（四人打ち）',
                lang: 'ja',
                start_url: './',
                scope: './',
                display: 'fullscreen',
                orientation: 'portrait',
                background_color: '#071a10',
                theme_color: '#0f2419',
                icons: [
                    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
            },
        }),
    ],
});
