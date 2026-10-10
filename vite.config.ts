import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { validateBrowserBuild } from "./src/paint-guide/lib/environment";
import { inspectAttr } from "kimi-plugin-inspect-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  validateBrowserBuild({ ...loadEnv(mode, process.cwd(), ""), ...process.env });
  return {
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
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
          "paint-guide": path.resolve(__dirname, "paint-guide.html"),
        },
      },
    },
  };
});
