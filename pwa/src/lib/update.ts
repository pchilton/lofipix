import { registerSW } from 'virtual:pwa-register';
import { canApplyUpdate, refreshOutboxStatus } from './outbox';

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;
let updatePending = false;
let applying = false;

async function tryApplyUpdate(): Promise<void> {
  if (!updatePending || applying || !updateServiceWorker) {
    return;
  }
  applying = true;
  try {
    await refreshOutboxStatus();
    if (!canApplyUpdate()) {
      return;
    }
    updatePending = false;
    await updateServiceWorker(true);
  } finally {
    applying = false;
  }
}

export function setupAppUpdates(): void {
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      updatePending = true;
      void tryApplyUpdate();
    },
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        window.setInterval(() => void registration.update(), 60 * 60 * 1000);
      }
    },
  });

  window.setInterval(() => void tryApplyUpdate(), 10_000);
  window.addEventListener('online', () => void tryApplyUpdate());
}
