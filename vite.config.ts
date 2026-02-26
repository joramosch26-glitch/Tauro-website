import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { inspectAttr } from "kimi-plugin-inspect-react";

// https://vite.dev/config/
export default defineConfig({
  // ✅ Importante: obliga URLs absolutas en el HTML generado (dist/index.html)
  base: "/",

  plugins: [inspectAttr(), react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // ✅ Extra seguro: mantiene assets en /assets (default, pero lo dejamos explícito)
  build: {
    assetsDir: "assets",
  },
});