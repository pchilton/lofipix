# Icons (Iconify via unplugin-icons)

Icons come from [Iconify](https://iconify.design) icon sets. unplugin-icons compiles
each icon you import into a SolidJS component at build time. Only imported icons
end up in the bundle, and nothing is fetched at runtime, so icons work offline in the PWA.

## Where it is configured (`packages/ui`)

- `src/icons/vite.ts`: `iconsPlugin()`. Uses `unplugin-icons` with `compiler: "solid"`,
  `autoInstall: false`, and `collectionsNodeResolvePath` pointing at `packages/ui`,
  so icon sets resolve from the shared package whichever app builds.
- `src/icons/types.d.ts`: ambient types for `~icons/*` imports.
- `package.json`: `unplugin-icons` and the icon sets as dependencies.

Configured collections:

| Prefix | Package | Notes |
| --- | --- | --- |
| `lucide` | `@iconify-json/lucide` | Same family as `lucide-solid`, used by TarkUI |
| `mdi` | `@iconify-json/mdi` | Material Design Icons, includes automotive icons (`car-wrench`, `car-door`) |

## Using icons in `www/` or `pwa/`

Both apps already have the wiring. For a new app:

1. Add `"@lofipix/ui": "workspace:*"` to its dependencies.
2. Register the plugin before `solid()` in `vite.config.ts`:

   ```ts
   import { iconsPlugin } from "@lofipix/ui/icons/vite";

   export default defineConfig({ plugins: [iconsPlugin(), solid()] });
   ```

3. Add the types to `src/vite-env.d.ts`:

   ```ts
   /// <reference types="@lofipix/ui/icons/types" />
   ```

4. Import and render:

   ```tsx
   import IconCamera from "~icons/lucide/camera";

   <IconCamera class="size-6" aria-hidden="true" />
   ```

Naming: Iconify `prefix:name` maps to `~icons/prefix/name` (`mdi:car-wrench` becomes
`~icons/mdi/car-wrench`). Browse sets at https://icon-sets.iconify.design.
Props such as `class`, `width`, `height`, `fill` and `aria-*` are spread onto the `<svg>`.

## Adding a collection

```bash
cd packages/ui
bun add @iconify-json/<prefix>
```

Then import `~icons/<prefix>/<name>` in an app. The plugin resolves collections from
`packages/ui`, so the plugin configuration does not change.

## Rules

- Icon names must be static string literals. `~icons/${name}` does not work, because
  unplugin-icons resolves icons at build time.
- Do not fetch icons from the Iconify API at runtime. The PWA is offline-first, so
  bundled icons are the only supported source.
- Install only the collections you use. Unused icons are not bundled, but collections
  add install size.

## Verification

- `bun run typecheck` in `packages/ui`, `pwa` and `www`.
- `bun run test` in `packages/ui` runs the `Icons/Collections` story, which renders
  `lucide/camera` and `mdi/car-wrench`.
- `bun run build` in `pwa` and `www`. The built JS in `dist/assets/` contains the icon
  path data and no Iconify API URL.
