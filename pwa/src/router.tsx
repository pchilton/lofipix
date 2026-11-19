import { Link, Outlet, createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { Badge, Button } from "@lofipix/ui";
import IconCamera from "~icons/lucide/camera";

import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import { pwaEnvironment } from "./config/environment";
import { isSessionStale } from "./lib/session-store";
import { readCachedProfile } from "./lib/session-profile";
import { useSession } from "./lib/session";
import Capture from "./routes/albums/Capture";
import CreateAlbum from "./routes/albums/CreateAlbum";
import FinishAlbum from "./routes/albums/FinishAlbum";
import PhotoReview from "./routes/albums/PhotoReview";
import Dashboard from "./routes/Dashboard";
import Settings from "./routes/Settings";
import Welcome from "./routes/Welcome";

function RootLayout() {
  const { profile, isAuthenticated, signOut } = useSession();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
            <IconCamera className="size-4" aria-hidden="true" />
            LoFi Pix
            <Badge variant="secondary">PWA</Badge>
          </Link>
          <nav className="flex items-center gap-2">
            <a
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
              href={pwaEnvironment.WEB_URL}
            >
              Website
            </a>
            {isAuthenticated ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/dashboard" activeProps={{ className: "bg-muted" }}>
                    Albums
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/settings" activeProps={{ className: "bg-muted" }}>
                    Settings
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void signOut();
                  }}
                >
                  Log out
                </Button>
              </>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-xs text-muted-foreground">
        {profile ? `Signed in as ${profile.email}` : null}
      </footer>
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
  beforeLoad: () => {
    if (readCachedProfile() && !isSessionStale()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Welcome,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: Dashboard,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: Settings,
});

const createAlbumRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/albums/new",
  component: CreateAlbum,
});

const captureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/albums/$albumId/capture",
  component: Capture,
});

const finishAlbumRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/albums/$albumId/finish",
  component: FinishAlbum,
});

const photoReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/albums/$albumId/photos/$photoId",
  component: PhotoReview,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  settingsRoute,
  createAlbumRoute,
  captureRoute,
  finishAlbumRoute,
  photoReviewRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
