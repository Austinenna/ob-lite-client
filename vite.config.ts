import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config tuned for Tauri: fixed dev port, no clobbering of Tauri env vars.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // src-tauri is built by cargo; don't let vite watch it.
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "safari14",
    sourcemap: false,
  },
});
