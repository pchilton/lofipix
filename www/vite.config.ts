import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { iconsPluginSolid } from "@lofipix/ui/icons/vite-solid";

export default defineConfig({
  plugins: [iconsPluginSolid(), solid()],
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
