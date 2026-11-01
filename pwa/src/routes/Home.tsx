import { ErrorBoundary, Show, Suspense } from 'solid-js';
import { session, signedIn } from '../lib/session';
import Welcome from './Welcome';
import Dashboard from './Dashboard';

export default function Home() {
  return (
    <Show when={session() !== undefined} fallback={<p>Loading…</p>}>
      <Show when={signedIn(session())} fallback={<Welcome />}>
        <Suspense fallback={<p class="muted">Loading albums…</p>}>
          <ErrorBoundary
            fallback={(error) => (
              <main class="page narrow">
                <section class="card">
                  <h1>Something went wrong</h1>
                  <pre>{String((error as Error)?.stack ?? error)}</pre>
                </section>
              </main>
            )}
          >
            <Dashboard />
          </ErrorBoundary>
        </Suspense>
      </Show>
    </Show>
  );
}
