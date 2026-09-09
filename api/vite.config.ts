import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";

export default defineConfig({
  plugins: [
    devServer({
      entry: "src/index.ts",
    }),
  ],
  build: {
    target: "node22",
    outDir: "dist",
    ssr: "src/index.ts",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        format: "esm",
        entryFileNames: "index.js",
      },
    },
  },
  ssr: {
    external: true,
  },
});
