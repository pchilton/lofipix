import { powerSyncConnector } from "./connector";
import { powersync } from "./powersync";

let connection: Promise<void> | null = null;

export async function connectPowerSync(): Promise<void> {
  if (powersync.connected || powersync.connecting) {
    return;
  }
  connection ??= powersync.connect(powerSyncConnector).finally(() => {
    connection = null;
  });
  await connection;
}

export async function disconnectPowerSync(): Promise<void> {
  connection = null;
  if (powersync.connected || powersync.connecting) {
    await powersync.disconnect();
  }
}

export async function clearLocalData(): Promise<void> {
  connection = null;
  await powersync.disconnectAndClear();
}
