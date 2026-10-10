import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['overreadily-rhematic-danuta.ngrok-free.dev'],
    host: 'localhost',
    port: 5173
  }
})
