import routes from '../content/routes.json';
import aliases from '../content/aliases.json';
import ui from '../content/ui.json';
import { resolveAction } from './domain/router';
import { suggestTopic } from './domain/topic-suggestions';
import { reply, type Fetcher } from './line/reply';
import { verifyLineSignature } from './line/signature';
import { isRecord, parseEvent } from './line/events';
import { renderResolution, renderTopicSuggestion, renderUi, resolveUiCommand } from './line/render';
import { createState, type StateKV } from './domain/state';

type RuntimeEnv = Pick<Env, 'LINE_CHANNEL_SECRET' | 'LINE_CHANNEL_ACCESS_TOKEN'> & {
  STATE_KV?: StateKV;
  HMAC_SECRET?: string;
  REPLY_DIAGNOSTICS?: string;
};

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

export function createWebhookHandler(fetcher: Fetcher = fetch, now = Date.now) {
  return async (request: Request, env: RuntimeEnv): Promise<Response> => {
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
    const state = createState(env.STATE_KV, env.HMAC_SECRET, now);
    for (const rawEvent of body.events) {
      const event = parseEvent(rawEvent);
      if (!event) continue;
      if (await state.hasReplied(event.eventId)) continue;
      const command = event.action.kind === 'follow' ? 'home' : event.action.kind === 'unsupported' ? 'unsupported' : resolveUiCommand(event.action);
      const resolution = command === 'opep' ? resolveAction({kind:'text',value:'PEP'},routes,aliases)
        : command || event.action.kind === 'follow' || event.action.kind === 'unsupported' ? null : resolveAction({...event.action, lastRouteId:await state.getLastRouteId(event.userId) ?? undefined}, routes, aliases);
      const suggestion = event.action.kind === 'text' && resolution?.kind === 'fallback' && resolution.reason === 'not_found'
        ? suggestTopic(event.action.value,ui.topicSuggestions) : null;
      const messages = command && command !== 'opep' ? renderUi(command)
        : suggestion ? renderTopicSuggestion(suggestion) : renderResolution(resolution!);
      const result = await reply(event.replyToken, messages, env.LINE_CHANNEL_ACCESS_TOKEN, fetcher);
      if (!result.ok) {
        // Temporary live probe: never log body, identifiers, credentials or exceptions.
        if (env.REPLY_DIAGNOSTICS === 'enabled') {
          console.warn('[DEBUG-reply-502]', JSON.stringify({code:result.code, status:result.status ?? null}));
        }
        failed = true;
        continue;
      }
      await state.markReplied(event.eventId);
      if (resolution?.kind === 'route') await state.putLastRouteId(event.userId, resolution.route.routeId);
      else {
        // Small talk and unrecognized text are detours, not topic resets.
        // Leave the stored value/expiry untouched; never refresh context here.
        const preserveContext = command === 'greeting' || command === 'thanks' ||
          (event.action.kind === 'text' && resolution?.kind === 'fallback' && resolution.reason === 'not_found');
        if (!preserveContext) await state.clearLastRouteId(event.userId);
      }
    }
    return new Response(failed ? 'Reply failed' : 'OK', {status:failed ? 502 : 200});
  };
}

export default {
  fetch: createWebhookHandler(),
} satisfies ExportedHandler<Env>;
