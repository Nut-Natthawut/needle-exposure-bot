import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

const fixture = () => ({ routeId: 'first_aid.root', category: 'clinical', presentation: 'text', text: 'ข้อความทดสอบ ไม่ใช่คำตอบทางการแพทย์', source: { version: 'test-only', pages: [1] }, next: [] });
const validate = (value: unknown) => {
  const path = new URL('../content/schema.json', import.meta.url);
  expect(existsSync(path), 'route schema must exist').toBe(true);
  return new Ajv({ allErrors: true }).compile(JSON.parse(readFileSync(path, 'utf8')))(value);
};

describe('clinical route contract', () => {
  it('accepts a complete source-backed route', () => expect(validate(fixture())).toBe(true));
  it.each([
    ['empty route ID', { ...fixture(), routeId: '' }],
    ['missing source', { ...fixture(), source: undefined }],
    ['non-array next', { ...fixture(), next: {} }],
    ['empty pages', { ...fixture(), source: { version: 'test-only', pages: [] } }],
    ['invalid page', { ...fixture(), source: { version: 'test-only', pages: [0] } }],
    ['blank text', { ...fixture(), text: '  ' }],
  ])('rejects %s', (_, value) => expect(validate(value)).toBe(false));
  it('CLI rejects an invalid file and reports file and route', () => {
    const dir = mkdtempSync(join(tmpdir(), 'needle-schema-'));
    try {
      const file = join(dir, 'invalid.json');
      writeFileSync(file, JSON.stringify([{ ...fixture(), next: {} }]));
      const result = spawnSync(process.execPath, ['scripts/validate-content.mjs', file], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(file);
      expect(result.stderr).toContain('first_aid.root');
    } finally { rmSync(dir, { recursive: true }); }
  });
});
