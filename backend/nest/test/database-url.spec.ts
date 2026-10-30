import path from 'path';
import { resolveDatabaseUrl } from '../src/prisma/database-url';

describe('resolveDatabaseUrl', () => {
  it('points a relative sqlite file at the existing prisma directory', () => {
    const moduleDir = path.resolve(__dirname, '../src/prisma');
    const resolved = resolveDatabaseUrl('file:./dev.db', moduleDir);
    expect(resolved).toBe(`file:${path.resolve(__dirname, '../../prisma/dev.db')}`);
  });

  it('leaves postgres urls unchanged', () => {
    const url = 'postgresql://user:pass@localhost:5432/filfilu';
    expect(resolveDatabaseUrl(url, '/tmp')).toBe(url);
  });
});
