// Ticket 1 scaffold: no webhook or clinical answers are exposed yet.
export default {
  fetch() {
    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler;

// Contract for the later state adapter; not a claim about deployed bindings.
export type StateStore = { STATE_KV: KVNamespace };
