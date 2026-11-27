// Test doubles for the L402Claims Durable Object (used by l402 route and claims tests).
import { L402Claims } from "./l402-claims";

export type ClaimState = ConstructorParameters<typeof L402Claims>[0];

/**
 * Durable Object state stand-in. blockConcurrencyWhile runs callbacks one at
 * a time, as the runtime's input gate does for one object instance.
 */
export function fakeClaimState() {
  const data = new Map<string, unknown>();
  let chain: Promise<unknown> = Promise.resolve();
  const state = {
    data,
    alarmAt: null as number | null,
    blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T> {
      const run = chain.then(fn);
      chain = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    },
    storage: {
      get: async (k: string) => data.get(k),
      put: async (k: string, v: unknown) => void data.set(k, v),
      delete: async (k: string) => data.delete(k),
      deleteAll: async () => void data.clear(),
      setAlarm: async (t: number) => void (state.alarmAt = t),
    },
  };
  return state;
}

/** A namespace whose stubs reach one real L402Claims instance per name. */
export function fakeClaimsNamespace() {
  const objects = new Map<string, L402Claims>();
  return {
    idFromName: (name: string) => name,
    get: (id: never) => {
      const name = id as unknown as string;
      let obj = objects.get(name);
      if (!obj) {
        obj = new L402Claims(fakeClaimState() as unknown as ClaimState, {});
        objects.set(name, obj);
      }
      const target = obj;
      return { fetch: (input: string, init?: RequestInit) => target.fetch(new Request(input, init)) };
    },
  };
}
