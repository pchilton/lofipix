# Icons (Iconify)

Icons come from [Iconify](https://iconify.design) icon sets. Nothing is fetched
from the Iconify API at runtime: web icons are compiled into React components at
build time, and the mobile app bundles the icon data it uses.

## Collections

Configured in `packages/ui` for both builds:

| Prefix | Package | Notes |
| --- | --- | --- |
| `lucide` | `@iconify-json/lucide` | General UI icons (camera, check, chevron, x, …) |
| `mdi` | `@iconify-json/mdi` | Material Design Icons, including automotive icons (`car-wrench`, `car-door`) |

## Web (`www/`) — unplugin-icons

- `packages/ui/src/icons/vite.ts`: `iconsPlugin()` uses `unplugin-icons` with
  `compiler: "jsx"`, `jsx: "react"`, `autoInstall: false`, and
  `collectionsNodeResolvePath` pointing at `packages/ui`, so icon sets resolve
  from the shared package whichever app builds.
- `packages/ui/src/icons/types.d.ts`: ambient types for `~icons/*` React
  imports.
- ShadCN source uses `~icons/lucide/<name>`, not `lucide-react`, so there is one
  web icon pipeline.

For a new React app:

1. Add `"@lofipix/ui": "workspace:*"` to its dependencies.
2. Register the plugin before the React plugin in `vite.config.ts`:

   ```ts
   import react from "@vitejs/plugin-react";
   import { iconsPlugin } from "@lofipix/ui/icons/vite";

   export default defineConfig({ plugins: [iconsPlugin(), react()] });
   ```

3. Add the types to `src/vite-env.d.ts`:

   ```ts
   /// <reference types="@lofipix/ui/icons/types" />
   ```

4. Import and render:

   ```tsx
   import IconCamera from "~icons/lucide/camera";

   <IconCamera className="size-6" aria-hidden="true" />
   ```

Naming: Iconify `prefix:name` maps to `~icons/prefix/name` (`mdi:car-wrench`
becomes `~icons/mdi/car-wrench`).

## Mobile (`mobile/`) — react-native-svg

React Native cannot render DOM `<svg>` elements, so the native app does not use
`unplugin-icons`.

- Icons come from the same `@iconify-json/*` packages.
- `mobile/scripts/generate-icons.ts` extracts only the icons named in its list
  into `mobile/src/icons/registry.ts`; run `npm run icons:generate` from `mobile/`
  after changing the list. The generated registry is committed.
- `mobile/src/icons/Icon.tsx` renders the registry through `react-native-svg`.
- Only statically referenced icons are included; no dynamic lookups.
- No runtime Iconify API calls: the app must work offline.

## Adding a collection

```bash
cd packages/ui
bun add @iconify-json/<prefix>
```

Then use `~icons/<prefix>/<name>` on web. For mobile, add the collection under
`mobile/` (`npm install --save-dev @iconify-json/<prefix>`), add the icon names to
`mobile/scripts/generate-icons.ts`, and run `npm run icons:generate` from
`mobile/`. The plugin resolves web collections from `packages/ui`, so the web
plugin configuration does not change.

## Rules

- Icon names must be static string literals. `~icons/${name}` does not work on
  web, because unplugin-icons resolves icons at build time.
- Do not fetch icons from the Iconify API at runtime.
- Install only the collections you use. Unused icons are not bundled, but
  collections add install size.
- Keep the ShadCN icon imports as `~icons/lucide/*`. Re-apply that patch if a
  component is re-copied from the registry.

## Verification

- `bun run typecheck` in `packages/ui`; `npm run typecheck` from `mobile/`.
- `bun run test` in `packages/ui` runs the `Icons/Collections` story, which
  renders `lucide/camera` and `mdi/car-wrench` and asserts the SVG classes.
- `bun run build` in `www`; the built JS contains the icon path data and no
  Iconify API URL.
