import { createResource, createSignal, For, Show } from 'solid-js';
import { authClient } from '../lib/auth-client';
import { createOrganisation } from '../lib/organization';

export default function Dashboard() {
  const session = authClient.useSession();

  const [orgName, setOrgName] = createSignal('');
  const [orgError, setOrgError] = createSignal<string | null>(null);
  const [orgPending, setOrgPending] = createSignal(false);

  const [organizations, { refetch }] = createResource(async () => {
    try {
      const { data } = await authClient.organization.list();
      return data ?? [];
    } catch {
      return [];
    }
  });

  async function handleCreateOrganisation(event: SubmitEvent) {
    event.preventDefault();
    setOrgError(null);
    setOrgPending(true);
    const result = await createOrganisation(orgName());
    setOrgPending(false);
    if (result.ok) {
      setOrgName('');
      await refetch();
    } else {
      setOrgError(result.message);
    }
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <Show when={session().isPending}>
        <p>Loading session…</p>
      </Show>
      <Show when={session().error}>
        {(error) => <p role="alert">{error().message}</p>}
      </Show>
      <Show when={session().data}>
        {(data) => (
          <section>
            <h2>Organisation</h2>
            <Show when={organizations.loading}>
              <p>Loading organisations…</p>
            </Show>
            <Show when={!organizations.loading && organizations()?.length === 0}>
              <p>Your account has no organisation yet.</p>
              <form onSubmit={handleCreateOrganisation}>
                <label>
                  Organisation Name
                  <input
                    type="text"
                    name="organisationName"
                    required
                    value={orgName()}
                    onInput={(event) => setOrgName(event.currentTarget.value)}
                  />
                </label>
                <Show when={orgError()}>
                  {(message) => <p role="alert">{message()}</p>}
                </Show>
                <button type="submit" disabled={orgPending()}>
                  {orgPending() ? 'Creating organisation…' : 'Create organisation'}
                </button>
              </form>
            </Show>
            <Show when={!organizations.loading && organizations()?.length}>
              <ul>
                <For each={organizations()}>
                  {(organization) => <li>{organization.name}</li>}
                </For>
              </ul>
            </Show>
            <p>Signed in as {data().user.email}.</p>
          </section>
        )}
      </Show>
    </main>
  );
}
