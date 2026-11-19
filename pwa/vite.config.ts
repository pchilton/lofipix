import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { iconsPlugin } from "@lofipix/ui/icons/vite";

const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [
    tailwindcss(),
    iconsPlugin(),
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["apple-touch-icon-180x180.png"],
      manifest: {
        name: "LoFi Pix",
        short_name: "lofipix",
        description: "Offline-first damage photo capture for panel-beaters.",
        theme_color: "#171717",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,ico,woff2,wasm}"],
        globIgnores: ["**/@powersync/**"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/powersync\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../packages/ui/src", import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ["@powersync/web"],
  },
  worker: {
    format: "es",
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    headers: isolationHeaders,
    watch: {
      usePolling: true,
    },
    hmr: {
      clientPort: 5174,
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4174,
    headers: isolationHeaders,
  },
});
