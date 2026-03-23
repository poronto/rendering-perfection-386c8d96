import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// WordPress-specific build config used by GitHub Actions
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "wordpress-assets",
    rollupOptions: {
      output: {
        entryFileNames: "Assets/index.js",
        assetFileNames: "Assets/[name][extname]",
      },
    },
  },
});
