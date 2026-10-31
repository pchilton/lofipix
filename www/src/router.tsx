import { createRootRoute, createRoute, createRouter, Link, Outlet, redirect, useNavigate } from "@tanstack/solid-router";
import { Show } from "solid-js";

import Welcome from "./routes/Welcome";
import Auth from "./routes/Auth";
import Dashboard from "./routes/Dashboard";
import { authClient } from "./lib/auth-client";

function Nav() {
  const session = authClient.useSession();
  const navigate = useNavigate();

  async function handleSignOut() {
    await authClient.signOut();
    navigate({ to: "/" });
  }

  return (
    <nav>
      <Link to="/">Home</Link>
      <Show
        when={session().data?.user}
        fallback={<Link to="/auth">Sign in / Register</Link>}
      >
        <Link to="/dashboard">Dashboard</Link>
        <button type="button" onClick={handleSignOut}>Sign out</button>
      </Show>
    </nav>
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
  component: () => (
    <>
      <Nav />
      <Outlet />
    </>
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

const routeTree = rootRoute.addChildren([indexRoute, authRoute, dashboardRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}
