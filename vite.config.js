import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'https://localhost:3000',
        ws: true,
        secure: false
      },
      '/api': {
        target: 'https://localhost:3000',
        secure: false
      }
    }
  }
})
