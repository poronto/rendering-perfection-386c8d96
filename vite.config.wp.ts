import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// WordPress-specific build config — uses scoped entry point
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
      input: path.resolve(__dirname, "src/wp-main.tsx"),
      output: {
        entryFileNames: "Assets/index.js",
        assetFileNames: "Assets/index[extname]",
      },
    },
  },
});
