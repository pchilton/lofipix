import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    solid(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "lofipix",
        short_name: "lofipix",
        description: "lofipix progressive web app",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        navigateFallback: "index.html",
      },
      devOptions: {
        enabled: true // Ensures service workers test cleanly inside the Docker container
      }
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5174,
    watch: {
      usePolling: true,
    },
    hmr: {
      clientPort: 5174, // Ensures your browser hits the local container web port safely
    },
  },
});
