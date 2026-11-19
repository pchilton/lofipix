import { Link, Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Badge, Button } from "@lofipix/ui";
import IconCamera from "~icons/lucide/camera";

import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import { pwaEnvironment } from "./config/environment";
import Welcome from "./routes/Welcome";

function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
            <IconCamera className="size-4" aria-hidden="true" />
            LoFi Pix
            <Badge variant="secondary">PWA</Badge>
          </Link>
          <nav className="flex items-center gap-3">
            <a
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
              href={pwaEnvironment.WEB_URL}
            >
              Website
            </a>
            <Button size="sm" disabled title="Authentication arrives in the next task">
              Sign in soon
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <Outlet />
      </main>
      <PwaUpdatePrompt />
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">The page you asked for does not exist.</p>
      <Button asChild className="mt-6">
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Welcome,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
