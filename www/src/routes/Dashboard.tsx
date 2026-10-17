import { For, Show } from 'solid-js';
import { authClient } from '../lib/auth-client';

export default function Dashboard() {
  const session = authClient.useSession();

  return (
    <main>
      <h1>Dashboard</h1>
      <Show when={session().isPending}>
        <p>Loading session…</p>
      </Show>
      <Show when={session().error}>
        {(error) => <p role="alert">{error().message}</p>}
      </Show>
      <Show
        when={session().data}
        fallback={
          <Show when={!session().isPending && !session().error}>
            <p>You are not signed in.</p>
          </Show>
        }
      >
        {(data) => (
          <>
            <section>
              <h2>User</h2>
              <dl>
                <For
                  each={Object.entries(data().user ?? {})}
                  fallback={<p>No user data.</p>}
                >
                  {([key, value]) => (
                    <>
                      <dt>{key}</dt>
                      <dd>{value === null ? '—' : String(value)}</dd>
                    </>
                  )}
                </For>
              </dl>
            </section>
            <section>
              <h2>Session</h2>
              <dl>
                <For
                  each={Object.entries(data().session ?? {})}
                  fallback={<p>No session data.</p>}
                >
                  {([key, value]) => (
                    <>
                      <dt>{key}</dt>
                      <dd>{value === null ? '—' : String(value)}</dd>
                    </>
                  )}
                </For>
              </dl>
            </section>
          </>
        )}
      </Show>
    </main>
  );
}
