import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      "/api": {
        target: "http://192.168.137.216:3000",
        changeOrigin: true
      },
      "/health": {
        target: "http://192.168.137.216:3000",
        changeOrigin: true
      }
    }
  }
});
