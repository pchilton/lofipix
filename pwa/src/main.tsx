import { render } from "solid-js/web";
import { supportsLocalDatabase } from "./lib/local-context";
import { initLocalDatabase } from "./lib/db/client";
import { initCollections } from "./lib/db/collections";
import { setupAppUpdates } from "./lib/update";
import "./index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Application root element is missing.");
}

function message(title: string, body: string, detail?: string) {
  return (
    <main class="page narrow">
      <section class="card">
        <h1>{title}</h1>
        <p>{body}</p>
        {detail ? <code>{detail}</code> : null}
      </section>
    </main>
  );
}

if (!supportsLocalDatabase()) {
  render(
    () =>
      message(
        "Secure context required",
        "Open chrome://flags/, find “Insecure origins treated as secure”, add this exact origin, enable the flag, and relaunch Chrome:",
        window.location.origin,
      ),
    root,
  );
} else {
  await navigator.locks.request(
    "lofipix-db",
    { ifAvailable: true },
    async (lock) => {
      if (!lock) {
        render(
          () =>
            message(
              "Already open",
              "lofipix is open in another tab. Close this tab or use the other one to avoid conflicting local changes.",
            ),
          root,
        );
        return;
      }

      try {
        await initLocalDatabase();
        initCollections();
      } catch (error) {
        render(
          () =>
            message(
              "Local database unavailable",
              error instanceof Error
                ? error.message
                : "The local database could not be opened.",
            ),
          root,
        );
        return;
      }

      const [{ RouterProvider }, { router }] = await Promise.all([
        import("@tanstack/solid-router"),
        import("./router"),
      ]);

      render(() => <RouterProvider router={router} />, root);
      setupAppUpdates();

      await new Promise<void>(() => {});
    },
  );
}
