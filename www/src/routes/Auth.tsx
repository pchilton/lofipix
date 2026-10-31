import { createSignal, Show } from 'solid-js';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import { authClient } from '../lib/auth-client';
import { createOrganisation, describeError } from '../lib/organization';

function PasswordField(props: {
  name: string;
  label: string;
  autocomplete: string;
  value: string;
  onInput: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <label>
      {props.label}
      <input
        type={props.visible ? 'text' : 'password'}
        name={props.name}
        required
        autocomplete={props.autocomplete}
        value={props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
      />
      <button type="button" onClick={props.onToggle} aria-pressed={props.visible}>
        {props.visible ? 'Hide' : 'Show'}
      </button>
    </label>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/auth' });
  const session = authClient.useSession();

  // Sign in
  const [signInEmail, setSignInEmail] = createSignal('');
  const [signInPassword, setSignInPassword] = createSignal('');
  const [signInPasswordVisible, setSignInPasswordVisible] = createSignal(false);
  const [signInError, setSignInError] = createSignal<string | null>(null);
  const [signInPending, setSignInPending] = createSignal(false);

  function redirectTarget(): string | null {
    const target = search().redirect;
    return target && target.startsWith('/') ? target : null;
  }

  async function handleSignIn(event: SubmitEvent) {
    event.preventDefault();
    setSignInError(null);
    setSignInPending(true);
    const { error } = await authClient.signIn.email({
      email: signInEmail(),
      password: signInPassword(),
    });
    setSignInPending(false);
    if (error) {
      setSignInError(describeError(error, 'Sign in failed.'));
      return;
    }
    const target = redirectTarget();
    if (target) {
      window.location.assign(target);
    } else {
      navigate({ to: '/dashboard' });
    }
  }

  // Sign up
  const [orgName, setOrgName] = createSignal('');
  const [name, setName] = createSignal('');
  const [signUpEmail, setSignUpEmail] = createSignal('');
  const [signUpPassword, setSignUpPassword] = createSignal('');
  const [signUpPasswordVisible, setSignUpPasswordVisible] = createSignal(false);
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [confirmPasswordVisible, setConfirmPasswordVisible] = createSignal(false);
  const [signUpError, setSignUpError] = createSignal<string | null>(null);
  const [signUpPending, setSignUpPending] = createSignal(false);
  const [orgError, setOrgError] = createSignal<string | null>(null);
  const [accountCreated, setAccountCreated] = createSignal(false);
  const [orgPending, setOrgPending] = createSignal(false);

  async function finishOrganisationSetup() {
    const result = await createOrganisation(orgName());
    if (result.ok) {
      navigate({ to: '/dashboard' });
    } else {
      setOrgError(result.message);
    }
    return result.ok;
  }

  async function handleSignUp(event: SubmitEvent) {
    event.preventDefault();
    setSignUpError(null);

    if (signUpPassword().length < 8) {
      setSignUpError('Password must be at least 8 characters.');
      return;
    }
    if (signUpPassword() !== confirmPassword()) {
      setSignUpError('Passwords do not match.');
      return;
    }

    setSignUpPending(true);
    const { error } = await authClient.signUp.email({
      email: signUpEmail(),
      password: signUpPassword(),
      name: name(),
    });
    setSignUpPending(false);
    if (error) {
      setSignUpError(describeError(error, 'Sign up failed.'));
      return;
    }

    setAccountCreated(true);
    setOrgPending(true);
    await finishOrganisationSetup();
    setOrgPending(false);
  }

  return (
    <main>
      <h1>Sign in / Register</h1>
      <Show when={session().data?.user}>
        {(user) => <p>Signed in as {user().email}.</p>}
      </Show>
      <div class="auth-columns" style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '2rem' }}>
        <section>
          <h2>Sign in</h2>
          <form onSubmit={handleSignIn}>
            <label>
              Email address
              <input
                type="email"
                name="email"
                required
                autocomplete="email"
                value={signInEmail()}
                onInput={(event) => setSignInEmail(event.currentTarget.value)}
              />
            </label>
            <PasswordField
              name="password"
              label="Password"
              autocomplete="current-password"
              value={signInPassword()}
              onInput={setSignInPassword}
              visible={signInPasswordVisible()}
              onToggle={() => setSignInPasswordVisible(!signInPasswordVisible())}
            />
            <Show when={signInError()}>
              {(message) => <p role="alert">{message()}</p>}
            </Show>
            <button type="submit" disabled={signInPending()}>
              {signInPending() ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </section>

        <section>
          <h2>Create account</h2>
          <form onSubmit={handleSignUp}>
            <label>
              Organisation Name
              <input
                type="text"
                name="organisationName"
                required
                value={orgName()}
                disabled={accountCreated()}
                onInput={(event) => setOrgName(event.currentTarget.value)}
              />
            </label>
            <label>
              Name
              <input
                type="text"
                name="name"
                required
                autocomplete="name"
                value={name()}
                disabled={accountCreated()}
                onInput={(event) => setName(event.currentTarget.value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                required
                autocomplete="email"
                value={signUpEmail()}
                disabled={accountCreated()}
                onInput={(event) => setSignUpEmail(event.currentTarget.value)}
              />
            </label>
            <PasswordField
              name="password"
              label="Password"
              autocomplete="new-password"
              value={signUpPassword()}
              onInput={setSignUpPassword}
              visible={signUpPasswordVisible()}
              onToggle={() => setSignUpPasswordVisible(!signUpPasswordVisible())}
            />
            <PasswordField
              name="confirmPassword"
              label="Confirm password"
              autocomplete="new-password"
              value={confirmPassword()}
              onInput={setConfirmPassword}
              visible={confirmPasswordVisible()}
              onToggle={() => setConfirmPasswordVisible(!confirmPasswordVisible())}
            />
            <Show when={signUpError()}>
              {(message) => <p role="alert">{message()}</p>}
            </Show>
            <Show when={orgError()}>
              {(message) => (
                <p role="alert">
                  {message()} Your account was created; retry to finish setting up the organisation.
                </p>
              )}
            </Show>
            <Show
              when={accountCreated()}
              fallback={
                <button type="submit" disabled={signUpPending()}>
                  {signUpPending() ? 'Creating account…' : 'Create account'}
                </button>
              }
            >
              <button type="button" disabled={orgPending()} onClick={finishOrganisationSetup}>
                {orgPending() ? 'Creating organisation…' : 'Retry create organisation'}
              </button>
            </Show>
          </form>
        </section>
      </div>
    </main>
  );
}
