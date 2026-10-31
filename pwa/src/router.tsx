import { createRootRoute, createRoute, createRouter, Link, Outlet, redirect } from "@tanstack/solid-router";
import { Show } from "solid-js";

import Home from "./routes/Home";
import About from "./routes/About";
import TakePhotos from "./routes/TakePhotos";
import FinishAlbum from "./routes/FinishAlbum";
import PhotoReview from "./routes/PhotoReview";
import { loadSession, session, signedIn } from "./lib/session";

async function requireSession() {
  const current = await loadSession();
  if (!current) {
    throw redirect({ to: "/" });
  }
}

const rootRoute = createRootRoute({
  beforeLoad: async () => {
    await loadSession();
  },
  component: () => (
    <>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
        <Show when={signedIn(session())}>
          <span class="muted">Signed in</span>
        </Show>
      </nav>
      <Outlet />
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: About,
});

const captureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/albums/$albumId/capture",
  beforeLoad: requireSession,
  component: TakePhotos,
});

const finishRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/albums/$albumId/finish",
  beforeLoad: requireSession,
  validateSearch: (search: Record<string, unknown>): { existing?: boolean } =>
    search.existing === true || search.existing === "true" ? { existing: true } : {},
  component: FinishAlbum,
});

const photoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/albums/$albumId/photos/$photoId",
  beforeLoad: requireSession,
  component: PhotoReview,
});

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute, captureRoute, finishRoute, photoRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}
