import { v7 as uuidv7 } from "uuid";

import { powersync } from "../db/powersync";
import { buildOpfsProviderRow } from "./rows";

const DEVICE_ID_KEY = "lofipix.pwa.device-id";

const providerPromises = new Map<string, Promise<string>>();

export function getDeviceId(): string {
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const deviceId = uuidv7();
  window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

async function findProvider(organizationId: string, deviceId: string): Promise<string | null> {
  const row = await powersync.getOptional<{ id: string }>(
    `SELECT id FROM storage_providers
     WHERE organization_id = ? AND provider_type = 'opfs' AND external_id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [organizationId, deviceId],
  );
  return row?.id ?? null;
}

async function createProvider(organizationId: string): Promise<string> {
  const deviceId = getDeviceId();
  const existing = await findProvider(organizationId, deviceId);
  if (existing) {
    return existing;
  }

  const row = buildOpfsProviderRow({
    id: uuidv7(),
    organizationId,
    deviceId,
    userAgent: navigator.userAgent,
  });

  try {
    await powersync.execute(
      `INSERT INTO storage_providers (
         id, organization_id, provider_type, label, external_id, config,
         version, originated_at, created_at, updated_at, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.organization_id,
        row.provider_type,
        row.label,
        row.external_id,
        row.config,
        row.version,
        row.originated_at,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
    return row.id as string;
  } catch {
    const raced = await findProvider(organizationId, deviceId);
    if (raced) {
      return raced;
    }
    throw new Error("Could not register local photo storage.");
  }
}

export function ensureOpfsProvider(organizationId: string): Promise<string> {
  const pending = providerPromises.get(organizationId);
  if (pending) {
    return pending;
  }
  const promise = createProvider(organizationId).finally(() => {
    providerPromises.delete(organizationId);
  });
  providerPromises.set(organizationId, promise);
  return promise;
}