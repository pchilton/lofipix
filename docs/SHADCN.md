# ShadCN — shared web components (`packages/ui`)

ShadCN is the design system for `www/`: React components copied into
`packages/ui` as source, built on Radix primitives and Tailwind CSS v4. It
replaces TarkUI (Ark UI for SolidJS). Components are owned by this repo and can
be edited.

The mobile app does **not** consume `packages/ui`: React Native cannot render
DOM components. Mobile UI lives in `mobile/` (see `docs/MOBILE.md`).

## Layout

```
packages/ui/                      @lofipix/ui (Bun workspace member)
├── .storybook/
│   ├── main.ts                   @storybook/react-vite, Tailwind plugin, icon plugin, @ alias
│   └── preview.ts                imports src/styles.css, layout padding
├── components.json               ShadCN config (new-york, neutral, CSS variables)
├── src/
│   ├── components/ui/
│   │   ├── button.tsx
│   │   ├── button.stories.tsx
│   │   └── …                     one component + one colocated story per item
│   ├── lib/utils.ts              cn(): clsx + tailwind-merge
│   ├── index.ts                  barrel: component exports + cn
│   ├── icons/
│   │   ├── vite.ts               iconsPlugin() for apps and Storybook (see docs/ICONS.md)
│   │   ├── types.d.ts            ~icons/* React module types
│   │   └── icons.stories.tsx
│   └── styles.css                Tailwind v4 entry + ShadCN theme tokens
├── package.json
├── tsconfig.json
└── vitest.config.ts              Vitest browser project that runs the Storybook stories
```

`package.json`:

- `exports`: `"."` → `src/index.ts`, `"./styles"` → `src/styles.css`, `"./icons/vite"` → `src/icons/vite.ts`, `"./icons/types"` → `src/icons/types.d.ts`
- `peerDependencies`: `react`, `react-dom`, `tailwindcss`; consumers provide them
- Scripts: `storybook`, `build-storybook`, `test`, `typecheck`

## Components

The starter set covers the current website screens:

| Component | Import | Notes |
| --- | --- | --- |
| Button | `Button`, `buttonVariants` | `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`; `sm`/`default`/`lg`/`icon`; `asChild`. |
| Input | `Input` | Native input with invalid state. |
| Label | `Label` | Radix label. |
| Card | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` | Album and dashboard surfaces. |
| Field | `Field`, `FieldSet`, `FieldLegend`, `FieldGroup`, `FieldContent`, `FieldLabel`, `FieldTitle`, `FieldDescription`, `FieldSeparator`, `FieldError` | Form-library-agnostic field primitives. |
| Dialog | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` | Modal editing. |
| AlertDialog | `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel` | Destructive confirmation. |
| Tabs | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Section switching. |
| DropdownMenu | `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, … | Action menus. |
| Separator | `Separator` | Horizontal/vertical rule. |
| Badge | `Badge`, `badgeVariants` | Sync/status chips. |
| Toaster | `Toaster` | Sonner toast host. |
| Skeleton | `Skeleton` | Loading placeholders. |

There is deliberately **no ShadCN `form` wrapper**: the website uses TanStack
Form + Zod, not react-hook-form. Use the `Field` primitives and render
validation errors with `FieldError`.

## Adding a component

ShadCN's CLI picks its package manager from lockfiles in the directory it runs
in. `packages/ui` has no workspace lockfile of its own, so running the CLI
inside it can write an `npm` lockfile at the repo root. Generate outside the Bun
workspace, then copy the source in:

```bash
# 1. Preview the registry item (read-only)
bunx --bun shadcn@latest view button

# 2. Generate in a scratch directory outside the repo
mkdir -p /tmp/shadcn && cd /tmp/shadcn
bunx --bun shadcn@latest add button --yes

# 3. Copy the generated source into packages/ui
cp /tmp/shadcn/components/ui/button.tsx <repo>/packages/ui/src/components/ui/

# 4. Adapt imports: "@/lib/utils" already resolves; replace "lucide-react" icons
#    with "~icons/lucide/<name>" so there is one web icon pipeline.

# 5. Export it from src/index.ts, add a colocated *.stories.tsx, then verify
cd <repo>/packages/ui
bun run typecheck && bun run test && bun run build-storybook
```

Do not re-copy a component that has local patches (especially icon imports).
Re-apply the patch instead.

## Theme

`src/styles.css` imports Tailwind v4 and `tw-animate-css`, defines the ShadCN
CSS variables for light and dark themes, and maps them with `@theme inline`.
Consumers import the stylesheet once:

```ts
import "@lofipix/ui/styles";
```

The Storybook preview imports the same file, so stories use the real tokens.

## Storybook

```bash
cd packages/ui
bun run storybook          # dev server, http://192.168.1.15:6006
bun run build-storybook    # static build into storybook-static/ (gitignored)
```

- Framework: `@storybook/react-vite` on the Vite builder.
- Stories: `src/**/*.stories.{ts,tsx}`, colocated with the component.
- Each CSF3 `meta` sets `tags: ["autodocs"]`. Story titles follow
  `ShadCN/<Name>` and `Icons/<Name>`.
- Tailwind, the icon plugin and the `@` alias are added in `.storybook/main.ts`
  through `viteFinal`. `preview.ts` imports `src/styles.css`.

## Testing

```bash
cd packages/ui
bunx playwright install chromium   # first run only
bun run test                       # vitest run
```

- `@storybook/addon-vitest` turns each story into a Vitest test. `play()`
  functions run as interactions in Chromium through
  `@vitest/browser-playwright`.
- Assertions come from `storybook/test` (`expect`, `userEvent`, `within`,
  `screen`).
- Portal content (dialogs, dropdown menus, toasts) is asserted with
  `screen` and `toBeInTheDocument()`; `toBeVisible()` can fail while Radix or
  Sonner animations are still running in the headless browser.

## Consuming from www

1. Add `"@lofipix/ui": "workspace:*"` to the app's dependencies.
2. Add `@tailwindcss/vite` to the app's Vite config and the icon plugin before
   the React plugin (see `docs/ICONS.md`).
3. Import the stylesheet once in the app entry, then import components from the
   barrel:

   ```ts
   import "@lofipix/ui/styles";
   import { Button, Card, CardContent } from "@lofipix/ui";
   ```

Importing `@import "tailwindcss"` in the app's own CSS alongside the package
stylesheet does not duplicate Tailwind's preflight.
