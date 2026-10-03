import routes from '../content/routes.json';
import aliases from '../content/aliases.json';
import ui from '../content/ui.json';
import { resolveAction } from './domain/router';
import { reply, type Fetcher } from './line/reply';
import { verifyLineSignature } from './line/signature';
import { isRecord, parseEvent } from './line/events';
import { renderText } from './line/render';

const MAX_BODY_BYTES = 256 * 1024;

async function readBody(request: Request): Promise<ArrayBuffer | null> {
  const reader = request.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {buffer.set(chunk, offset); offset += chunk.byteLength;}
  return buffer.buffer;
}

export function createWebhookHandler(fetcher: Fetcher = fetch) {
  return async (request: Request, env: Env): Promise<Response> => {
    if (new URL(request.url).pathname !== '/webhook') return new Response('Not Found', {status:404});
    if (request.method !== 'POST') return new Response('Method Not Allowed', {status:405, headers:{Allow:'POST'}});
    if (!env.LINE_CHANNEL_SECRET) return new Response('Configuration unavailable', {status:503});
    const signature = request.headers.get('x-line-signature');
    if (!signature) return new Response('Unauthorized', {status:401});
    let rawBody: ArrayBuffer | null;
    try {rawBody = await readBody(request);} catch {return new Response('Invalid body', {status:400});}
    if (!rawBody) return new Response('Payload too large', {status:413});
    if (!await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET)) return new Response('Unauthorized', {status:401});
    let body: unknown;
    try {body = JSON.parse(new TextDecoder('utf-8', {fatal:true, ignoreBOM:true}).decode(rawBody));}
    catch {return new Response('Invalid JSON', {status:400});}
    if (!isRecord(body) || !Array.isArray(body.events)) return new Response('Invalid events', {status:400});
    let failed = false;
    for (const rawEvent of body.events) {
      const event = parseEvent(rawEvent);
      if (!event) continue;
      const messages = event.action.kind === 'follow' ? [{type:'text' as const, text:ui.welcome}]
        : renderText(resolveAction(event.action, routes, aliases));
      const result = await reply(event.replyToken, messages, env.LINE_CHANNEL_ACCESS_TOKEN, fetcher);
      if (!result.ok) failed = true;
    }
    return new Response(failed ? 'Reply failed' : 'OK', {status:failed ? 502 : 200});
  };
}

export default {
  fetch: createWebhookHandler(),
} satisfies ExportedHandler<Env>;

// Contract for the later state adapter; not a claim about deployed bindings.
export type StateStore = { STATE_KV: KVNamespace };
