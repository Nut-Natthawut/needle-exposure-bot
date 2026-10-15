export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export type QuickReplyItem = {type:'action'; action:{type:'postback'; label:string; data:string}};
export type TextMessage = { type: 'text'; text: string; quickReply?: {items: QuickReplyItem[]} };
export type FlexAction = {type:'postback'; label:string; data:string} | {type:'uri'; label:string; uri:string};
export type FlexText = {type:'text'; text:string; wrap:true; size?:string; color?:string; weight?:'bold'; flex?:number; align?:'center'; margin?:string; lineSpacing?:string};
export type FlexBox = {type:'box'; layout:'vertical'|'horizontal'; contents:FlexComponent[]; spacing?:string; paddingAll?:string; backgroundColor?:string; cornerRadius?:string; width?:string; height?:string; justifyContent?:'center'; flex?:number; margin?:string};
export type FlexButton = {type:'button'; action:FlexAction; style:'primary'|'secondary'|'link'; height:'md'; color?:string; margin?:string};
export type FlexComponent = FlexText | FlexBox | FlexButton | {type:'separator'; margin?:string; color?:string};
export type FlexMessage = {type:'flex'; altText:string; contents:{type:'bubble'; size:'mega'; body:FlexBox; footer?:FlexBox}; quickReply?:{items:QuickReplyItem[]}};
export type ReplyMessage = TextMessage | FlexMessage;
export type ReplyResult = {ok: true} | {ok: false; code: 'http_error' | 'network_error' | 'invalid_request'; status?: number};
export async function reply(replyToken: string, messages: ReplyMessage[], accessToken: string, fetcher: Fetcher = fetch): Promise<ReplyResult> {
  if (!replyToken || !accessToken || messages.length < 1 || messages.length > 5 ||
      messages.some(message => message.type === 'text'
        ? !message.text || message.text.length > 5000
        : !message.altText || message.altText.length > 400 || new TextEncoder().encode(JSON.stringify(message.contents)).length > 30000)) return {ok:false, code:'invalid_request'};
  try {
    const response = await fetcher('https://api.line.me/v2/bot/message/reply', {
      method:'POST',
      headers:{'Content-Type':'application/json', Authorization:`Bearer ${accessToken}`},
      body:JSON.stringify({replyToken, messages}),
      // Workers fetch rejects 'error'. Manual keeps redirects from forwarding credentials.
      redirect:'manual',
      signal:AbortSignal.timeout(5000),
    });
    // Do not read/log response bodies: they may echo request details.
    const ok = response.ok;
    const status = response.status;
    await response.body?.cancel();
    return ok ? {ok:true} : {ok:false, code:'http_error', status};
  } catch {
    return {ok:false, code:'network_error'};
  }
}
