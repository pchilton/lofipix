import { getTableConfig } from 'drizzle-orm/sqlite-core';

import { schemaStatements } from '../src/lib/db/ddl';
import { LOCAL_SCHEMA_VERSION, syncTableObjects } from '../src/lib/db/schema';

const ddl = schemaStatements.join('\n');

describe('local SQLite DDL', () => {
  it('is versioned', () => {
    expect(LOCAL_SCHEMA_VERSION).toBeGreaterThan(0);
  });

  it.each(Object.entries(syncTableObjects))('covers every %s column', (tableName, table) => {
    const config = getTableConfig(table);
    expect(ddl).toContain(`create table if not exists ${tableName}`);
    for (const column of config.columns) {
      expect(ddl).toContain(column.name);
    }
  });

  it('creates the client-only tables', () => {
    expect(ddl).toContain('create table if not exists outbox');
    expect(ddl).toContain('create table if not exists local_meta');
    expect(ddl).toContain('outbox_needed');
  });
});
