// TEMPORARY (Explorer session test harness) — same-origin proxy to the backend on :8000. Safe to delete.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("http://127.0.0.1:5175") },
  server: { host: "127.0.0.1", port: 5175, strictPort: true, proxy: { "/api": "http://127.0.0.1:8000" } },
});
