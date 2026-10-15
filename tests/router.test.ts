import { describe, expect, it } from 'vitest';
import routes from '../content/routes.json';
import aliases from '../content/aliases.json';
import { resolveAction } from '../src/domain/router';

describe('deterministic routing', () => {
  it('uses an exact enabled postback ID', () => {
    const result = resolveAction({kind: 'postback', value: 'first_aid.eye'}, routes, aliases);
    expect(result.kind).toBe('route');
    if (result.kind === 'route') expect(result.route.routeId).toBe('first_aid.eye');
  });
  it.each(['first_aid.fake', 'routeId=first_aid.eye', ' first_aid.eye ', '__proto__'])('rejects unregistered postback %s', value => {
    expect(resolveAction({kind: 'postback', value}, routes, aliases)).toEqual({kind: 'fallback', reason: 'not_found'});
  });
  it('never routes a disabled postback', () => {
    expect(resolveAction({kind: 'postback', value: 'lab.staff.ic06'}, routes, aliases)).toEqual({kind: 'fallback', reason: 'unavailable'});
  });
  it('matches a complete registered Thai alias', () => {
    const result = resolveAction({kind: 'text', value: '  เข็มทิ่มตำ\n '}, routes, aliases);
    expect(result.kind).toBe('route');
    if (result.kind === 'route') expect(result.route.routeId).toBe('first_aid.root');
  });
  it('collapses repeated whitespace without changing words', () => {
    const result = resolveAction({kind: 'text', value: 'การรับยา   oPEP'}, routes, aliases);
    expect(result.kind).toBe('choices');
    if (result.kind === 'choices') expect(result.routes.map(r => r.routeId)).toEqual(['opep.office', 'opep.after_hours']);
  });
  it('asks for a choice when an alias has multiple routes', () => {
    const result = resolveAction({kind: 'text', value: 'PEP'}, routes, aliases);
    expect(result.kind).toBe('choices');
    if (result.kind === 'choices') expect(result.routes.map(r => r.routeId)).toEqual(['opep.office', 'opep.after_hours']);
  });
  it('uses the latest context for a follow-up', () => {
    const result = resolveAction({kind: 'text', value: 'ผลบวก', lastRouteId: 'lab.source.ic04'}, routes, aliases);
    expect(result.kind).toBe('route');
    if (result.kind === 'route') expect(result.route.routeId).toBe('lab.source.positive');
  });
  it('asks for a topic when a known follow-up has no context', () => {
    expect(resolveAction({kind: 'text', value: 'ผลบวก'}, routes, aliases)).toEqual({kind: 'fallback', reason: 'missing_context'});
  });
  it.each(['lab.staff.ic06', 'unknown.route', 'first_aid.root'])('does not use wrong or unavailable context %s', lastRouteId => {
    expect(resolveAction({kind: 'text', value: 'ผลบวก', lastRouteId}, routes, aliases)).toEqual({kind: 'fallback', reason: 'missing_context'});
  });
  it('allows a global topic change despite old context', () => {
    const result = resolveAction({kind: 'text', value: 'เลือดเข้าตา', lastRouteId: 'lab.source.ic04'}, routes, aliases);
    expect(result.kind).toBe('route');
    if (result.kind === 'route') expect(result.route.routeId).toBe('first_aid.eye');
  });
  it.each(['HN 123 เข็มทิ่มตำ', 'เข็มทิ่มตำ นายสมชาย', 'เลือดเข้าตา ต้องใช้ยาอะไร', 'ผมติดเชื้อไหม', 'เข็มทิ่มตํา', '', 'IC06'])('does not infer a clinical route from %s', value => {
    expect(resolveAction({kind: 'text', value}, routes, aliases)).toEqual({kind: 'fallback', reason: 'not_found'});
  });
  it('prioritizes an alias in the active context over a global alias', () => {
    const custom = {global: {'อ่าน': ['first_aid.eye']}, byLastRoute: {'first_aid.root': {'อ่าน': ['first_aid.mouth']}}};
    const result = resolveAction({kind: 'text', value: 'อ่าน', lastRouteId: 'first_aid.root'}, routes, custom);
    expect(result.kind).toBe('route');
    if (result.kind === 'route') expect(result.route.routeId).toBe('first_aid.mouth');
  });
  it('merges normalized alias collisions instead of picking the first', () => {
    const custom = {global: {'อ่าน ต่อ': ['first_aid.eye'], 'อ่าน  ต่อ': ['first_aid.mouth']}, byLastRoute: {}};
    const result = resolveAction({kind: 'text', value: 'อ่าน ต่อ'}, routes, custom);
    expect(result.kind).toBe('choices');
    if (result.kind === 'choices') expect(result.routes.map(r => r.routeId)).toEqual(['first_aid.eye', 'first_aid.mouth']);
  });
  it('does not silently drop a disabled candidate from an ambiguous alias', () => {
    const custom = {global: {'ตรวจ': ['lab.staff.ic05', 'lab.staff.ic06']}, byLastRoute: {}};
    expect(resolveAction({kind: 'text', value: 'ตรวจ'}, routes, custom)).toEqual({kind: 'fallback', reason: 'unavailable'});
  });
});
