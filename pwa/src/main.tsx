import { render } from "solid-js/web";
import { supportsPowerSyncContext } from "./lib/powersync/secure-context";
import "./index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Application root element is missing.");
}

if (supportsPowerSyncContext()) {
  const [{ RouterProvider }, { router }] = await Promise.all([
    import("@tanstack/solid-router"),
    import("./router"),
  ]);
  render(() => <RouterProvider router={router} />, root);
} else {
  render(
    () => (
      <main class="page narrow">
        <section class="card">
          <h1>Secure context required</h1>
          <p>
            Open <code>chrome://flags/</code>, find <strong>Insecure origins treated as secure</strong>, add this exact origin, enable the flag, and relaunch Chrome:
          </p>
          <code>{window.location.origin}</code>
        </section>
      </main>
    ),
    root,
  );
}
