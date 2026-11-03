import { getTableColumns, getTableName } from 'drizzle-orm';
import type { SyncTable } from '@lofipix/db/schema';
import { getClient } from './db/client';
import { syncTableObjects } from './db/schema';

const DATE_FIELDS = new Set(['deletedAt', 'createdAt', 'updatedAt', 'capturedAt']);
const JSON_FIELDS = new Set(['config']);
const BOOLEAN_FIELDS = new Set(['outboxNeeded']);

export type LocalRow = Record<string, unknown>;

function toSqlValue(field: string, value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  if (BOOLEAN_FIELDS.has(field) || typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (JSON_FIELDS.has(field) && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

function fromSqlValue(field: string, value: unknown): unknown {
  if (BOOLEAN_FIELDS.has(field)) {
    return value === 1 || value === true;
  }
  if (DATE_FIELDS.has(field) && typeof value === 'number') {
    return new Date(value);
  }
  if (JSON_FIELDS.has(field) && typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return {};
    }
  }
  return value;
}

export function normalizeShapeRow(value: Record<string, unknown>): LocalRow {
  const row: LocalRow = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined) {
      continue;
    }
    const field = key;
    if (DATE_FIELDS.has(field)) {
      if (raw == null) {
        row[field] = null;
      } else {
        row[field] =
          raw instanceof Date ? raw : new Date(String(raw).replace(' ', 'T').replace(/\+00$/, '+00:00'));
      }
      continue;
    }
    if (BOOLEAN_FIELDS.has(field)) {
      row[field] = raw === true || raw === 1;
      continue;
    }
    if (JSON_FIELDS.has(field) && raw != null && typeof raw === 'object') {
      row[field] = JSON.stringify(raw);
      continue;
    }
    row[field] = raw;
  }
  return row;
}

export function readLocalRow(table: SyncTable, row: Record<string, unknown>): LocalRow {
  const localTable = syncTableObjects[table];
  const columns = getTableColumns(localTable);
  const result: LocalRow = {};
  for (const field of Object.keys(columns)) {
    if (field in row) {
      result[field] = row[field];
    }
  }
  return result;
}

export async function upsertLocalRow(table: SyncTable, input: Record<string, unknown>): Promise<void> {
  const localTable = syncTableObjects[table];
  const columns = getTableColumns(localTable);
  const entries = Object.entries(columns)
    .filter(([field]) => field in input)
    .map(([field, column]) => [field, column.name] as const);

  if (entries.length === 0) {
    return;
  }

  const tableName = getTableName(localTable);
  const columnNames = entries.map(([, name]) => name);
  const placeholders = entries.map(() => '?').join(', ');
  const updates = columnNames.map((name) => `${name} = excluded.${name}`).join(', ');
  const values = entries.map(([field]) => toSqlValue(field, input[field])) as Array<string | number | null>;

  await getClient().execute(
    `insert into ${tableName} (${columnNames.join(', ')}) values (${placeholders}) on conflict(id) do update set ${updates}`,
    values,
  );
}

export async function updateLocalRow(
  table: SyncTable,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const localTable = syncTableObjects[table];
  const columns = getTableColumns(localTable);
  const entries = Object.entries(columns)
    .filter(([field]) => field in fields)
    .map(([field, column]) => [field, column.name] as const);

  if (entries.length === 0) {
    return;
  }

  const assignments = entries.map(([, name]) => `${name} = ?`).join(', ');
  const values = entries.map(([field]) => toSqlValue(field, fields[field])) as Array<string | number | null>;
  await getClient().execute(
    `update ${getTableName(localTable)} set ${assignments} where id = ?`,
    [...values, recordId],
  );
}

export async function deleteLocalRow(table: SyncTable, recordId: string): Promise<void> {
  await getClient().execute(`delete from ${getTableName(syncTableObjects[table])} where id = ?`, [
    recordId,
  ]);
}

export function stripSystem(
  row: Record<string, unknown>,
  keepCreatedAt: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (
      key === 'id' ||
      key === 'organizationId' ||
      key === 'version' ||
      key === 'updatedAt' ||
      key === 'outboxNeeded' ||
      key === 'deletedAt' ||
      (!keepCreatedAt && key === 'createdAt')
    ) {
      continue;
    }
    payload[key] = value;
  }
  return payload;
}

function wireConfig(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

export function insertPayload(row: Record<string, unknown>): Record<string, unknown> {
  const payload = stripSystem(row, true);
  if ('config' in payload) {
    payload.config = wireConfig(payload.config);
  }
  return payload;
}

export function updatePayload(
  table: SyncTable,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  if (table === 'albums') {
    const payload: Record<string, unknown> = {};
    if ('name' in changes) payload.name = changes.name;
    if ('notes' in changes) payload.notes = changes.notes;
    return payload;
  }
  if (table === 'photos') {
    const payload: Record<string, unknown> = {};
    for (const key of [
      'position',
      'imageWidth',
      'imageHeight',
      'imageQuality',
      'imageSize',
      'imageChecksum',
    ]) {
      if (key in changes) payload[key] = changes[key];
    }
    return payload;
  }
  if (table === 'photo_locations') {
    return 'objectKey' in changes ? { objectKey: changes.objectKey } : {};
  }
  const payload: Record<string, unknown> = {};
  for (const key of ['providerType', 'label', 'externalId', 'config']) {
    if (key in changes) payload[key] = wireConfig(changes[key]);
  }
  return payload;
}

export function fullUpdatePayload(
  table: SyncTable,
  row: Record<string, unknown>,
): Record<string, unknown> {
  if (table === 'albums') {
    return { name: row.name, notes: row.notes };
  }
  if (table === 'photos') {
    return {
      position: row.position,
      imageWidth: row.imageWidth,
      imageHeight: row.imageHeight,
      imageQuality: row.imageQuality,
      imageSize: row.imageSize,
      imageChecksum: row.imageChecksum,
    };
  }
  if (table === 'photo_locations') {
    return { objectKey: row.objectKey };
  }
  return {
    providerType: row.providerType,
    label: row.label,
    externalId: row.externalId,
    config: wireConfig(row.config),
  };
}

export function normalizeServerRow(row: Record<string, unknown>): LocalRow {
  return normalizeShapeRow({ ...row, outboxNeeded: false });
}

export function sqlValueForTests(field: string, value: unknown): unknown {
  return toSqlValue(field, value);
}

export function fromSqlValueForTests(field: string, value: unknown): unknown {
  return fromSqlValue(field, value);
}
