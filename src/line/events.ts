export type RepliableEvent = {
  replyToken: string;
  userId: string;
  eventId?: string;
  action: {kind:'text'|'postback'; value:string} | {kind:'follow'} | {kind:'unsupported'};
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Only known repliable 1:1 events; media receives UI copy, never analysis. */
export function parseEvent(value: unknown): RepliableEvent | null {
  if (!isRecord(value) || !isRecord(value.source) || value.source.type !== 'user' ||
      typeof value.source.userId !== 'string' || !value.source.userId ||
      typeof value.replyToken !== 'string' || !value.replyToken) return null;
  let action: RepliableEvent['action'];
  if (value.type === 'follow') action = {kind:'follow'};
  else if (value.type === 'message' && isRecord(value.message) &&
           value.message.type === 'text' && typeof value.message.text === 'string') {
    action = {kind:'text', value:value.message.text};
  } else if (value.type === 'message' && isRecord(value.message) &&
             ['image','file','audio'].includes(String(value.message.type))) {
    action = {kind:'unsupported'};
  } else if (value.type === 'postback' && isRecord(value.postback) && typeof value.postback.data === 'string') {
    action = {kind:'postback', value:value.postback.data};
  } else return null;
  return {replyToken:value.replyToken, userId:value.source.userId, action,
    ...(typeof value.webhookEventId === 'string' ? {eventId:value.webhookEventId} : {})};
}
