import { decide } from './policy.mjs';
import { validateMandate, METHODS } from './mandate.mjs';

// Pilot-only pure authorization adapter. It does not execute tools or make network calls.
export function authorizePilotCall({ action, method, envelope, verification, policyContext }) {
  if (typeof action !== 'string' || !METHODS.includes(method)) throw Error('Unsupported pilot operation');
  const decision = decide(action, policyContext);
  if (!decision.allow) throw Error('Policy denied: '+decision.reason);
  if (action !== 'public.read') throw Error('Pilot MCP dispatch only supports public.read');
  if (!verification || !envelope) throw Error('Signed mandate required');
  const receipt=validateMandate(envelope,{...verification,method});
  return Object.freeze({authorized:true,method,taskId:receipt.taskId,requestLimit:Math.min(receipt.maxRequests,policyContext.maxRequests),expiresAt:receipt.expiresAt});
}
