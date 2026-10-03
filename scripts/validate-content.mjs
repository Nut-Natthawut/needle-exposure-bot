import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const schema = JSON.parse(readFileSync(new URL('../content/schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);
const args = process.argv.slice(2);
const corpusMode = args.length === 0 || args.includes('--corpus');
const files = args.filter(arg => arg !== '--corpus');
if (files.length === 0) files.push(fileURLToPath(new URL('../content/routes.json', import.meta.url)));
let failed = false;
const fail = (file, id, message) => {
  failed = true;
  console.error(`${file}: ${id}: ${message}`);
};
const read = name => JSON.parse(readFileSync(new URL(`../content/${name}.json`, import.meta.url), 'utf8'));
for (const file of files) {
  try {
    const routes = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(routes) || routes.length === 0) throw new Error('Expected a non-empty array of routes');
    for (const route of routes) {
      if (!validate(route)) {
        fail(file, route?.routeId ?? '<missing routeId>', ajv.errorsText(validate.errors, { separator: '; ' }));
      }
    }
    if (corpusMode) {
      const metadata = read('metadata');
      const aliases = read('aliases');
      const ids = new Map(routes.map(route => [route.routeId, route]));
      const seen = new Set();
      for (const route of routes) {
        if (seen.has(route.routeId)) fail(file, route.routeId, 'duplicate route ID');
        seen.add(route.routeId);
        if (route.source?.version !== metadata.version) fail(file, route.routeId, 'bad version');
        if (route.source?.pages.some(page => page > metadata.pageCount)) fail(file, route.routeId, 'page exceeds PDF');
        if (typeof route.enabled !== 'boolean') fail(file, route.routeId, 'enabled must be explicit');
        if (route.enabled === false && !route.disabledReason?.trim()) fail(file, route.routeId, 'disabled reason required');
        if (Array.isArray(route.next)) for (const next of route.next) {
          const target = ids.get(next.routeId);
          if (!target) fail(file, route.routeId, `missing target ${next.routeId}`);
          else if (route.enabled && !target.enabled) fail(file, route.routeId, `disabled target ${next.routeId}`);
        }
      }
      for (const [context, map] of [['global', aliases.global], ...Object.entries(aliases.byLastRoute)]) {
        if (context !== 'global' && !ids.get(context)?.enabled) fail(file, context, 'invalid alias context');
        for (const [alias, targets] of Object.entries(map)) {
          if (!alias.trim() || !Array.isArray(targets) || targets.length === 0) {
            fail(file, context, 'invalid alias'); continue;
          }
          for (const target of targets) if (!ids.get(target)?.enabled) fail(file, context, `alias ${alias} targets missing/disabled ${target}`);
        }
      }
    }
  } catch (error) {
    failed = true;
    console.error(`${file}: ${error.message}`);
  }
}
if (failed) process.exitCode = 1;
else console.log(`Content schema valid: ${files.length} file(s)`);
