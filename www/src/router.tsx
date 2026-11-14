import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { Button } from "@lofipix/ui";
import IconLogOut from "~icons/lucide/log-out";

import { authClient } from "./lib/auth-client";
import Auth from "./routes/Auth";
import Dashboard from "./routes/Dashboard";
import Settings from "./routes/Settings";
import Welcome from "./routes/Welcome";

function Nav() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  async function handleSignOut() {
    await authClient.signOut();
    await navigate({ to: "/" });
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="text-sm font-semibold">
          lofipix
        </Link>
        <nav className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link to="/settings" className="text-sm text-muted-foreground hover:text-foreground">
                Settings
              </Link>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <IconLogOut />
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in / Register</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}

async function signedInUser() {
  try {
    const session = await authClient.getSession();
    return session?.data?.user ?? null;
  } catch {
    return null;
  }
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

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth",
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async () => {
    if (await signedInUser()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Auth,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: Dashboard,
  beforeLoad: async ({ location }) => {
    if (!(await signedInUser())) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: Settings,
  beforeLoad: async ({ location }) => {
    if (!(await signedInUser())) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
});

const routeTree = rootRoute.addChildren([indexRoute, authRoute, dashboardRoute, settingsRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
