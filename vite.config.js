import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  server: {
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'cert.pem')),
    },
    host: true,
    proxy: {
      '/socket.io': {
        target: 'https://localhost:8080',
        ws: true,
        secure: false
      },
      '/api': {
        target: 'https://localhost:8080',
        secure: false
      }
    }
  }
})
