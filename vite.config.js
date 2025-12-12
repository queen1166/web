import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 只要以 /api 开头的请求，都转发到 FastAPI
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});