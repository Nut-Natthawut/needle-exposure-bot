# เข็มทิ่มตำ NKP

LINE OA bot: TypeScript + Cloudflare Workers, deterministic JSON routes.

## Local development

Requires Node.js 22 or newer.

```sh
npm ci
npm test
npm run typecheck
npm run dev
```

Current stage: Ticket 1 scaffold. The Worker returns 404. Clinical content and
LINE webhook handling are not implemented yet.

`npm run content:check` intentionally fails until the real routes corpus exists
in Ticket 2. Test fixtures are not clinical content. Deployment runs content
validation, type checks and tests first.

Keep LINE credentials out of Git. Original PDF/DOCX/JPG files remain local and
are ignored. Add the actual KV namespace and generate binding types with
`wrangler types` when provisioning in Ticket 8.
