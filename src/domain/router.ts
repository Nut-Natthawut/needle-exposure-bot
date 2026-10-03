export interface Route {
  routeId: string;
  category: string;
  presentation: string;
  text: string;
  source: { version: string; pages: number[] };
  next: { routeId: string; label: string }[];
  enabled: boolean;
  disabledReason?: string;
}
export interface Aliases {
  global: Record<string, string[]>;
  byLastRoute: Record<string, Record<string, string[]>>;
}
export type ActionInput = { kind: 'postback' | 'text'; value: string; lastRouteId?: string };
export type Resolution =
  | { kind: 'route'; route: Route }
  | { kind: 'choices'; routes: Route[] }
  | { kind: 'fallback'; reason: 'not_found' | 'missing_context' | 'unavailable' };

// Only whitespace is insignificant. Case, punctuation, numbers and Thai
// spelling are preserved; new variants must be registered as explicit aliases.
function normalize(text: string): string {
  return text.trim().replace(/\s+/gu, ' ');
}

function matchAliases(text: string, map: Record<string, string[]>): string[] {
  const matches = Object.entries(map)
    .filter(([alias]) => normalize(alias) === text)
    .flatMap(([, ids]) => ids);
  return [...new Set(matches)];
}

function resolveTargets(ids: string[], index: Map<string, Route>): Resolution {
  const selected: Route[] = [];
  for (const id of ids) {
    const route = index.get(id);
    if (!route || !route.enabled) return {kind: 'fallback', reason: 'unavailable'};
    selected.push(route);
  }
  const first = selected[0];
  if (!first) return {kind: 'fallback', reason: 'not_found'};
  return selected.length === 1 ? {kind: 'route', route: first} : {kind: 'choices', routes: selected};
}

/** Pure routing; callers supply already-expiry-checked context. No I/O or state writes. */
export function resolveAction(input: ActionInput, routes: readonly Route[], aliases: Aliases): Resolution {
  const index = new Map(routes.map(route => [route.routeId, route]));
  if (input.kind === 'postback') {
    if (!index.has(input.value)) return {kind: 'fallback', reason: 'not_found'};
    return resolveTargets([input.value], index);
  }

  const text = normalize(input.value);
  if (!text) return {kind: 'fallback', reason: 'not_found'};
  if (input.lastRouteId && index.get(input.lastRouteId)?.enabled &&
      Object.hasOwn(aliases.byLastRoute, input.lastRouteId)) {
    const contextAliases = aliases.byLastRoute[input.lastRouteId];
    if (contextAliases) {
      const targets = matchAliases(text, contextAliases);
      if (targets.length) return resolveTargets(targets, index);
    }
  }

  const globalTargets = matchAliases(text, aliases.global);
  if (globalTargets.length) return resolveTargets(globalTargets, index);
  const isFollowUp = Object.values(aliases.byLastRoute).some(map => matchAliases(text, map).length > 0);
  return {kind: 'fallback', reason: isFollowUp ? 'missing_context' : 'not_found'};
}
