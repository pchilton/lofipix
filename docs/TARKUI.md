# TarkUI — shared UI components (`packages/ui`)

TarkUI is the design system for `www/` and `pwa/`: [Ark UI](https://ark-ui.com)
(`@ark-ui/solid`) headless components styled with Tailwind CSS v4. TarkUI publishes
a shadcn-format registry at `tarkui.com`. Components are **copied into the repo as
source**, so `packages/ui` owns them and they can be edited.

## Layout

```
packages/ui/                      @lofipix/ui (Bun workspace member)
├── .storybook/
│   ├── main.ts                   framework, stories glob, addons, Tailwind Vite plugin
│   └── preview.ts                imports src/styles.css, layout padding
├── src/
│   ├── components/tabs/
│   │   ├── icon-above.tsx        TarkUI "Icon Above" (registry item 33/8)
│   │   └── icon-above.stories.tsx
│   ├── index.ts                  barrel: export { TabsIconAbove }
│   └── styles.css                Tailwind v4 entry: @import "tailwindcss"; @source "./";
├── package.json
├── tsconfig.json
└── vitest.config.ts              Vitest browser project that runs the Storybook stories
```

`package.json`:

- `exports`: `"."` → `src/index.ts`, `"./styles"` → `src/styles.css`
- `dependencies`: `@ark-ui/solid`, `lucide-solid`
- `peerDependencies`: `solid-js` (`^1.9.15`), `tailwindcss` (`^4.3.3`); consumers provide them
- Scripts: `storybook`, `build-storybook`, `test`, `typecheck`

## Integrated components

| Registry item | Source | Export | Notes |
| --- | --- | --- | --- |
| Icon Above — `https://tarkui.com/r/s/33/8.json` (`tabs`) | `src/components/tabs/icon-above.tsx` | `TabsIconAbove` | Three tabs (Learning / Community / Progress), icon above label |

**Local patch to Icon Above.** The registry source contains `<Icon() size={20} />`,
which is invalid JSX (TS1003/TS1382). The installed file replaces
`createMemo(() => tab.icon)` with `tab.icon` and renders `<Icon size={20} />`, and
drops the `createMemo` import. Re-apply this patch if the item is re-copied from
the registry.

## Adding a component

Run solidcn **outside the Bun workspace**. It picks its package manager from
lockfiles in the directory it runs in. `packages/ui` has none, so solidcn would
run `npm` there, which writes `package-lock.json` at the repo root. Never run
`solidcn add` or `solidcn update` inside `packages/ui` or any other workspace package.

```bash
# 1. Preview the registry item (read-only, installs nothing)
bunx --bun solidcn@latest view https://tarkui.com/r/s/33/8.json

# 2. Generate the source in a scratch directory outside the repo
mkdir -p /tmp/tarkui && cd /tmp/tarkui
bunx --bun solidcn@latest add https://tarkui.com/r/s/33/8.json --yes --skip-preflight
#    writes src/components/registry/solid/tabs/icon-above.tsx
#    (solidcn ignores the item's "target" field)

# 3. Move the files to the registry target path and install the item's dependencies with bun
mkdir -p <repo>/packages/ui/src/components/tabs
cp /tmp/tarkui/src/components/registry/solid/tabs/* <repo>/packages/ui/src/components/tabs/
cd <repo>/packages/ui && bun add @ark-ui/solid lucide-solid

# 4. Export it from src/index.ts, add a colocated *.stories.tsx, then verify
bun run typecheck && bun run test
```

Do not re-copy an item that has local patches. Re-apply the patch instead.

## Storybook

```bash
cd packages/ui
bun run storybook          # dev server, http://localhost:6006
bun run build-storybook    # static build into storybook-static/ (gitignored)
```

- Framework: `storybook-solidjs-vite` on the Vite builder.
- Stories: `src/**/*.stories.{ts,tsx}`, colocated with the component.
- Each component's CSF3 `meta` sets `tags: ["autodocs"]`. Story titles follow
  `TarkUI/<Category>/<Name>`.
- Tailwind is added in `.storybook/main.ts` through `viteFinal`. `preview.ts`
  imports `src/styles.css`.
- Docgen (Controls and Docs props) is on by default. It accounts for most of the
  static build time (~86 s of ~95 s for one component). To skip it, set
  `framework: { name: "storybook-solidjs-vite", options: { docgen: false } }` in
  `.storybook/main.ts`. Controls and Docs props are lost.

## Testing

```bash
cd packages/ui
bunx playwright install chromium   # first run only
bun run test                       # vitest run
```

- `@storybook/addon-vitest` turns each story into a Vitest test. `play()`
  functions run as interactions in Chromium through `@vitest/browser-playwright`.
  Storybook 10.3+ applies preview annotations on its own, so no Vitest setup file
  is needed.
- Assertions come from `storybook/test` (`expect`, `userEvent`, `within`).
- Vitest prints `Failed to resolve dependency: react-dom/client …` warnings.
  The addon-docs preset adds React packages to Vite's `optimizeDeps.include`
  (`optimizeViteDeps`), and this Solid-only package has no React. The warnings
  are harmless; the tests still pass.

## Consuming from www / pwa

Not wired yet. `www/` and `pwa/` do not import `packages/ui`. When they do:

1. Add `"@lofipix/ui": "workspace:*"` to the app's dependencies, the same way
   `@lofipix/db` is consumed.
2. Add `@tailwindcss/vite` to the app's Vite config.
3. Import the stylesheet once in the app entry, then import components from the barrel:

   ```ts
   import "@lofipix/ui/styles";
   import { TabsIconAbove } from "@lofipix/ui";
   ```

Verified with a standalone Solid + Vite app that imports the stylesheet and the
barrel: the TarkUI utilities (including `data-selected:` and `dark:` variants) are
generated. Importing `@import "tailwindcss"` in the app's own CSS alongside the
package stylesheet does not duplicate Tailwind's preflight.
