import { fileURLToPath } from "node:url";
import Icons from "unplugin-icons/vite";

/**
 * Temporary compatibility export for the SolidJS apps until prompts 0025 and
 * 0026 replace them. New apps must use `iconsPlugin()` (React).
 */
export function iconsPluginSolid() {
  return Icons({
    compiler: "solid",
    autoInstall: false,
    collectionsNodeResolvePath: fileURLToPath(new URL("../../", import.meta.url)),
  });
}
