import path from 'path';

/**
 * Prisma resolves a relative SQLite URL from the schema directory.
 * Passing the same relative URL through the client constructor resolves it
 * from the process cwd instead, which would open a different file.
 * This keeps Nest on backend/prisma/dev.db.
 */
export function resolveDatabaseUrl(databaseUrl: string, moduleDir: string): string {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }
  const spec = databaseUrl.slice('file:'.length);
  if (path.isAbsolute(spec)) {
    return databaseUrl;
  }
  const schemaDir = path.resolve(moduleDir, '../../../prisma');
  return `file:${path.resolve(schemaDir, spec)}`;
}
