import type { StateKV } from '../../src/domain/state';

/** In-memory implementation of only the KV operations used by the adapter. */
export class MemoryKV implements StateKV {
  values = new Map<string, string>();
  writes: {key:string; value:string; ttl:number}[] = [];
  deleted: string[] = [];
  failRead = false;
  failWrite = false;
  failContextWrite = false;
  failDelete = false;
  async get(key: string): Promise<string | null> {
    if (this.failRead) throw new Error('simulated KV read outage');
    return this.values.get(key) ?? null;
  }
  async put(key: string, value: string, options: {expirationTtl:number}): Promise<void> {
    if (this.failWrite || (this.failContextWrite && key.startsWith('context:'))) throw new Error('simulated KV quota/rate limit');
    this.writes.push({key, value, ttl:options.expirationTtl});
    this.values.set(key, value);
  }
  async delete(key: string): Promise<void> {
    if (this.failDelete) throw new Error('simulated KV delete outage');
    this.deleted.push(key); this.values.delete(key);
  }
}
