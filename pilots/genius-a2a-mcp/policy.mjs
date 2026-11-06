// Standalone pilot policy decision point. No network or side effects.
export const TIERS = Object.freeze({GREEN:0,YELLOW:1,ORANGE:2,RED:3});
const actions = Object.freeze({
  'docs.write':'GREEN','fixture.generate':'GREEN','tests.local':'GREEN','patch.prepare':'GREEN',
  'public.read':'YELLOW','pr.draft':'YELLOW','outreach.nonbinding':'YELLOW',
  'deploy.production':'ORANGE','agent.enroll':'ORANGE','offer.commercial':'ORANGE',
  'funds.transfer':'RED','contract.accept':'RED','government.private_access':'RED','stablecoin.issue':'RED'
});
export function decide(action, ctx={}) {
  const tier=actions[action];
  if(!tier) return Object.freeze({allow:false,tier:'UNKNOWN',reason:'Unrecognized action'});
  if(tier==='GREEN') return Object.freeze({allow:true,tier,reason:'Local nonbinding action'});
  if(ctx.explicitDeny===true) return Object.freeze({allow:false,tier,reason:'Explicit denial'});
  if(tier==='YELLOW') {
    const allow=ctx.scopeApproved===true && Number.isSafeInteger(ctx.maxRequests) && ctx.maxRequests>=1 && ctx.maxRequests<=20 && ctx.publicOnly===true;
    return Object.freeze({allow,tier,reason:allow?'Bounded read-only scope':'Missing bounded public authorization'});
  }
  if(tier==='ORANGE') {
    const allow=ctx.scopeApproved===true && ctx.exactHeadTestsPassed===true && ctx.independentReviewApproved===true && ctx.rollbackReady===true;
    return Object.freeze({allow,tier,reason:allow?'Controlled release gate met':'Release gate incomplete'});
  }
  return Object.freeze({allow:false,tier,reason:'Restricted: requires separate lawful delegated authority and external controls'});
}
export function fallback(errorClass, context={}) {
  if(context.explicitDeny===true || errorClass==='policy_blocked') return Object.freeze({route:'STOP_AND_REVIEW',retry:false});
  if(errorClass==='transient' && Number.isSafeInteger(context.attempts) && context.attempts<3) return Object.freeze({route:'BACKOFF',retry:true});
  if(errorClass==='infrastructure_unavailable') return Object.freeze({route:'AUTHORIZED_ISOLATED_RUNNER',retry:false});
  if(errorClass==='permission_denied') return Object.freeze({route:'PREPARE_PATCH_AND_REQUEST_REVIEW',retry:false});
  if(errorClass==='validation_failed') return Object.freeze({route:'FIX_AND_RETEST',retry:false});
  return Object.freeze({route:'STOP_AND_REVIEW',retry:false});
}
