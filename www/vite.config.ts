import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { iconsPlugin } from "@lofipix/ui/icons/vite";

export default defineConfig({
  plugins: [tailwindcss(), iconsPlugin(), react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../packages/ui/src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: {
      usePolling: true,
    },
    hmr: {
      clientPort: 5173,
    },
  },
});
