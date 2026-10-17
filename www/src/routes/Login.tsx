import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { authClient } from '../lib/auth-client';

export default function Login() {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal(false);

  const session = authClient.useSession();
  const navigate = useNavigate();

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await authClient.signIn.email({
      email: email(),
      password: password(),
    });
    setPending(false);
    if (error) {
      setError(error.message ?? 'Sign in failed.');
    } else {
      navigate({ to: '/dashboard' });
    }
  }

  return (
    <main>
      <h1>Sign in</h1>
      <Show when={session()?.data?.user}>
        {(user) => <p>Signed in as {user().email}.</p>}
      </Show>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            name="email"
            required
            autocomplete="email"
            value={email()}
            onInput={(event) => setEmail(event.currentTarget.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            required
            autocomplete="current-password"
            value={password()}
            onInput={(event) => setPassword(event.currentTarget.value)}
          />
        </label>
        <Show when={error()}>
          {(message) => <p role="alert">{message()}</p>}
        </Show>
        <button type="submit" disabled={pending()}>
          {pending() ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
