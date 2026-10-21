import tailwindcss from "@tailwindcss/vite";
import type { StorybookConfig } from "storybook-solidjs-vite";
import { iconsPlugin } from "../src/icons/vite.ts";

const config: StorybookConfig = {
  framework: "storybook-solidjs-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-vitest"],
  viteFinal: async (viteConfig) => {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss(), iconsPlugin()];
    return viteConfig;
  },
};

export default config;
