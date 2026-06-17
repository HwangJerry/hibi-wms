import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const DEFAULT_API_PORT = "3000";
const DEFAULT_WEB_PORT = 5173;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: DEFAULT_WEB_PORT,
    proxy: {
      "/trpc": `http://localhost:${process.env.PORT ?? DEFAULT_API_PORT}`,
    },
  },
});
