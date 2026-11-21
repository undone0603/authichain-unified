/**
 * DORMANT Passport Monitor fulfillment service.
 * The injected repository MUST implement a serializable transaction per
 * subscription, atomically persisting both state and the event ID. Never
 * back this with a read-then-write over ordinary PostgREST REST requests.
 */
import { transition, consumeOne } from './passport-monitor-lifecycle.mjs';

export function passportMonitorService(repository) {
  if (!repository || typeof repository.transact !== 'function') {
    throw new TypeError('atomic subscription transaction repository required');
  }
  return {
    /** Only call after Stripe signature verification and line-item price match. */
    async applyVerifiedEvent(event) {
      if (!event || typeof event.subscriptionId !== 'string' || !event.subscriptionId) {
        return { ok: false, reason: 'invalid_subscription' };
      }
      return repository.transact(event.subscriptionId, ({ state, eventIds }) => {
        if (eventIds.has(event.id)) return { ok: true, action: 'duplicate', state, commit: false };
        const next = transition(state, event);
        if (!next.ok) return { ...next, commit: false };
        return { ...next, commit: true, claimedEventId: event.id };
      });
    },
    /** Must be called by authenticated verifier before each included use. */
    async consumeVerification(subscriptionId, nowSeconds) {
      if (typeof subscriptionId !== 'string' || !subscriptionId) {
        return { ok: false, reason: 'invalid_subscription' };
      }
      return repository.transact(subscriptionId, ({ state }) => {
        const next = consumeOne(state, nowSeconds);
        return { ...next, commit: next.ok };
      });
    },
  };
}
