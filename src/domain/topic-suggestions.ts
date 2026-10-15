import {normalizeUserText} from './text-input';

export interface TopicSuggestion {
  label: string;
  terms: readonly string[];
  postbackId: string;
}

// Only approved top-level topic names participate, never clinical aliases,
// results, drugs, doses, codes or contextual branches. A match is a question,
// not permission to render an answer or save a clinical context.
function withinOneEdit(a:string,b:string):boolean {
  if (Math.abs(a.length-b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {i++; j++; continue;}
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (a.length-i) + (b.length-j) <= 1;
}

/** Bounded Thai topic spelling aid. No I/O, substring search or clinical inference. */
export function suggestTopic(value:string,topics:readonly TopicSuggestion[]):TopicSuggestion|null {
  // Bound work before normalization. Thai topic names use BMP letters/marks;
  // reject numbers, Latin codes and non-formatting punctuation.
  if (value.length > 64) return null;
  const text = normalizeUserText(value);
  if (text.length < 5 || !/^[\p{Script=Thai} ]+$/u.test(text) || /[^\p{L}\p{M} ]/u.test(text)) return null;
  const matches = topics.filter(topic => topic.terms.some(term => withinOneEdit(text,term)));
  // Even one-edit collisions must go back to the full menu, not pick the first.
  return matches.length === 1 ? matches[0]! : null;
}
