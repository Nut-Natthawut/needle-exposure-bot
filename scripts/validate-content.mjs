import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const schema = JSON.parse(readFileSync(new URL('../content/schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ allErrors: true }).compile(schema);
const files = process.argv.slice(2);
if (files.length === 0) files.push(fileURLToPath(new URL('../content/routes.json', import.meta.url)));
let failed = false;
for (const file of files) {
  try {
    const routes = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(routes) || routes.length === 0) throw new Error('Expected a non-empty array of routes');
    for (const route of routes) {
      if (!validate(route)) {
        failed = true;
        console.error(`${file}: ${route?.routeId ?? '<missing routeId>'}: ${new Ajv().errorsText(validate.errors, { separator: '; ' })}`);
      }
    }
  } catch (error) {
    failed = true;
    console.error(`${file}: ${error.message}`);
  }
}
if (failed) process.exitCode = 1;
else console.log(`Content schema valid: ${files.length} file(s)`);
