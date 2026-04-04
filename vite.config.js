import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 4312,
    proxy: {
      '/api': {
        target: 'http://localhost:4311',
        changeOrigin: true
      }
    }
  }
})
