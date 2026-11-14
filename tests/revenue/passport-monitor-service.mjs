/**
 * DORMANT Passport Monitor fulfillment coordinator.
 * Repository.transact MUST provide serializable per-subscription transactions
 * and persist the changed state and claimed event ID atomically.
 * A simple PostgREST read/then/write is NOT a valid implementation.
 *
 * This module DOES NOT verify Stripe signatures, payment settlement, account
 * ownership, or verifier identity. Keep it disconnected from production.
 */
import { transition, consumeOne } from './passport-monitor-lifecycle.mjs';

export function passportMonitorService(repository) {
  if (!repository || typeof repository.transact !== 'function') {
    throw new TypeError('atomic subscription transaction repository required');
  }
  return {
    // Called only by a future independently verified Stripe webhook adapter.
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
    // Called only by a future authenticated verifier entitlement check.
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
