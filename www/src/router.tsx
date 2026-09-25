import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/solid-router";

import Welcome from "./routes/Welcome";
import About from "./routes/About";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <Outlet />
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Welcome,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: About,
});

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}
