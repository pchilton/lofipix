import { Show } from 'solid-js';
import { session, signedIn } from '../lib/session';
import Welcome from './Welcome';
import Dashboard from './Dashboard';

export default function Home() {
  return (
    <Show when={session() !== undefined} fallback={<p>Loading…</p>}>
      <Show when={signedIn(session())} fallback={<Welcome />}>
        <Dashboard />
      </Show>
    </Show>
  );
}
