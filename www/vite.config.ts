import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { iconsPlugin } from "@lofipix/ui/icons/vite";

export default defineConfig({
  plugins: [iconsPlugin(), solid()],
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
