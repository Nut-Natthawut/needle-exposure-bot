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

Current stage: Ticket 2 content corpus. The Worker still returns 404; LINE
webhook handling is not implemented yet. PDF transcription, alias maps and UI
copy are under content/. See docs/source-map.md for source pages and disabled
ambiguous cases.

`npm run content:check` checks clinical schema, route IDs, versions, destination
links and aliases. Test fixtures are not clinical content. Deployment runs
content validation, type checks and tests first. Content snapshots record the
visually checked transcription; renderer checks will be added in Ticket 6.

Keep LINE credentials out of Git. Original PDF/DOCX/JPG files remain local and
are ignored. Add the actual KV namespace and generate binding types with
`wrangler types` when provisioning in Ticket 8.
