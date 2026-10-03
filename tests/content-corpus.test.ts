import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

const load = (name: string) => JSON.parse(readFileSync(`content/${name}.json`, 'utf8'));
it('covers every inventoried route and keeps source version and destinations valid', () => {
  const routes = load('routes');
  const metadata = load('metadata');
  const inventory = readFileSync('docs/source-map.md', 'utf8').matchAll(/\| `([a-z0-9_.]+)` \|/g);
  expect(routes.map((r: {routeId: string}) => r.routeId).sort()).toEqual([...inventory].map(m => m[1]).sort());
  const ids = new Set(routes.map((r: {routeId: string}) => r.routeId));
  expect(ids.size).toBe(routes.length);
  for (const route of routes) {
    expect(route.source.version).toBe(metadata.version);
    expect(route.source.pages.every((p: number) => p >= 1 && p <= 3)).toBe(true);
    for (const next of route.next) expect(ids.has(next.routeId)).toBe(true);
    if (!route.enabled) expect(route.disabledReason.trim().length).toBeGreaterThan(0);
  }
});
it('does not expose disabled routes through aliases or active next buttons', () => {
  const routes = load('routes');
  const active = new Set(routes.filter((r: {enabled: boolean}) => r.enabled).map((r: {routeId: string}) => r.routeId));
  const aliases = load('aliases');
  for (const map of [aliases.global, ...Object.values(aliases.byLastRoute)]) {
    for (const targets of Object.values(map as Record<string, string[]>)) {
      expect((targets as string[]).length).toBeGreaterThan(0);
      for (const id of targets as string[]) expect(active.has(id)).toBe(true);
    }
  }
  for (const route of routes.filter((r: {enabled: boolean}) => r.enabled)) {
    for (const next of route.next) expect(active.has(next.routeId)).toBe(true);
  }
});
it('CLI accepts a valid corpus with aliases and metadata', () => {
  const result = spawnSync(process.execPath, ['scripts/validate-content.mjs', '--corpus', 'content/routes.json'], {encoding: 'utf8'});
  expect(result.status).toBe(0);
});
it.each(['duplicate', 'missing target', 'bad version'])('CLI rejects corpus with %s', (problem) => {
  const routes = load('routes');
  if (problem === 'duplicate') routes.push(routes[0]);
  if (problem === 'missing target') routes[0].next.push({routeId: 'missing.route', label: 'test'});
  if (problem === 'bad version') routes[0].source.version = 'wrong';
  const dir = mkdtempSync(join(tmpdir(), 'needle-corpus-'));
  try {
    const file = join(dir, 'routes.json');
    writeFileSync(file, JSON.stringify(routes));
    const result = spawnSync(process.execPath, ['scripts/validate-content.mjs', '--corpus', file], {encoding: 'utf8'});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(file);
    expect(result.stderr).toContain(problem);
  } finally { rmSync(dir, {recursive: true}); }
});
