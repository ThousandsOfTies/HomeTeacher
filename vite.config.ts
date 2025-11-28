import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 環境変数を読み込む
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const isDiscuss = mode === 'discuss'
  const basePath = isDiscuss ? '/HomeTeacher/discuss/' : '/HomeTeacher/'
  const appName = env.VITE_APP_NAME || 'TutoTuto'
  const themeColor = env.VITE_THEME_COLOR || '#3498db'

  console.log(`📦 Building ${appName} (mode: ${mode})`)

  return {
  base: basePath,
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
          dest: '',
          rename: 'pdf.worker.min.js'
        }
      ]
    }),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: appName,
        short_name: isDiscuss ? 'TutoTuto Discuss' : 'TutoTuto',
        description: env.VITE_APP_DESCRIPTION || 'AI-powered drill grading app with handwriting support',
        theme_color: themeColor,
        background_color: themeColor,
        display: 'standalone',
        start_url: basePath,
        scope: basePath,
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // 静的アセット（画像、アイコン）のみキャッシュ
        globPatterns: ['**/*.{ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: null,
        runtimeCaching: [
          {
            // warning.htmlは常にネットワークから取得（キャッシュしない）
            urlPattern: /\/warning\.html/,
            handler: 'NetworkOnly'
          },
          {
            // HTML/JS/CSSは常にネットワークから取得（キャッシュはフォールバックのみ）
            urlPattern: /\.(?:html|js|css)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-js-css-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1時間
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    fs: {
      // PDFsフォルダへのアクセスを許可
      allow: ['..']
    }
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  assetsInclude: ['**/*.pdf'],
  }
})
