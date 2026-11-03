import { fileURLToPath } from "node:url";
import Icons from "unplugin-icons/vite";

export function iconsPlugin() {
  return Icons({
    compiler: "jsx",
    jsx: "react",
    autoInstall: false,
    collectionsNodeResolvePath: fileURLToPath(new URL("../../", import.meta.url)),
  });
}
