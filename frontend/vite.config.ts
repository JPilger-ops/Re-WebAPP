import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Option A: base "/" und Build nach backend/public/
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    outDir: path.resolve(__dirname, "../backend/public"),
    emptyOutDir: false, // nicht alles löschen, um bestehende Assets zu schonen
    assetsDir: "assets"
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_PROXY || "http://localhost:3031",
        changeOrigin: true,
      },
    },
  },
});
