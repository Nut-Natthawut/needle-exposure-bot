import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('preserves the visually checked PDF transcription character for character', () => {
  const routes = JSON.parse(readFileSync('content/routes.json', 'utf8'));
  expect(Object.fromEntries(routes.map((r: {routeId: string; text: string}) => [r.routeId, r.text]))).toMatchSnapshot();
});
