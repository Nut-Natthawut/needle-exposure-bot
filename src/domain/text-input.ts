// Formatting tolerance for complete registered phrases only. Do not remove
// negation, numbers, +/- signs, internal punctuation, names or medical words.
// Postback IDs must never pass through this function.
export function normalizeUserText(value:string):string {
  const trimEnding = (text:string) => text.trimEnd().replace(/[!?！？.。…]+$/u,'').trimEnd();
  const text = trimEnding(value.trim().replace(/\s+/gu,' '));
  // Strip at most one polite ending. Repeated or mixed suffixes stay unmatched.
  const withoutPoliteness = text.replace(/(?:นะครับ|นะคะ|นะค่ะ|ครับผม|ครับ|ค่ะ|คะ|คับ|ค้าบ|จ้า|จ๊ะ|ค่า)$/u,'');
  return trimEnding(withoutPoliteness).replace(/[A-Z]/gu,letter => letter.toLowerCase());
}
