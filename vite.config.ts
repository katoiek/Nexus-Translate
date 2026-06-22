import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'

const tauriPlatform = process.env.TAURI_ENV_PLATFORM || process.platform

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Tauri expects a fixed port, fail if that port is not available
  // 他プロジェクト(既定の1420)との衝突を避けるため専用ポートを使用
  // / Use a dedicated port to avoid clashing with other projects on the default 1420
  server: {
    port: 1430,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    hmr: {
      protocol: 'ws',
      host: process.env.TAURI_DEV_HOST || 'localhost',
      port: 1431,
    },
    // src-tauri のビルド成果物を監視するとEBUSYで落ちるため除外
    // / Don't watch src-tauri build artifacts (causes EBUSY file-lock errors)
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  // to access the Tauri environment variables set by the CLI with information about the current target
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Windows では WebView2、それ以外ではモダンな WebKit/Chromium を対象にする
    target: tauriPlatform == 'windows' || tauriPlatform == 'win32' ? 'chrome105' : 'es2022',
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
