import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_BUILD': JSON.stringify(process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) || 'local-preview')
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8788"
    }
  }
});
