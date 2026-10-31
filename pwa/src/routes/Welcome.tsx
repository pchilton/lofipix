import { createSignal, Show } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { z } from 'zod';
import { authClient } from '../lib/auth-client';
import { errorText } from '../lib/form';
import { refreshSession } from '../lib/session';

const emailSchema = z.email('Enter a valid email address.');
const passwordSchema = z.string().min(1, 'Enter your password.');

export default function Welcome() {
  const [submitError, setSubmitError] = createSignal<string | null>(null);

  const form = createForm(() => ({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      if (!navigator.onLine) {
        setSubmitError('Connect to the internet to sign in.');
        return;
      }
      const { error } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      });
      if (error) {
        setSubmitError(error.message ?? 'Sign in failed.');
        return;
      }
      await refreshSession();
    },
  }));

  return (
    <main class="page narrow">
      <h1>lofipix</h1>
      <p>Sign in to capture vehicle damage photos.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="email" validators={{ onChange: emailSchema }}>
          {(field) => (
            <label>
              Email
              <input
                type="email"
                name="email"
                autocomplete="username"
                required
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
              />
              <Show when={errorText(field().state.meta.errors)}>
                {(message) => <span class="error">{message()}</span>}
              </Show>
            </label>
          )}
        </form.Field>
        <form.Field name="password" validators={{ onChange: passwordSchema }}>
          {(field) => (
            <label>
              Password
              <input
                type="password"
                name="password"
                autocomplete="current-password"
                required
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
              />
              <Show when={errorText(field().state.meta.errors)}>
                {(message) => <span class="error">{message()}</span>}
              </Show>
            </label>
          )}
        </form.Field>
        <Show when={submitError()}>
          {(message) => <p class="error" role="alert">{message()}</p>}
        </Show>
        <button type="submit" disabled={form.state.isSubmitting}>
          {form.state.isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
