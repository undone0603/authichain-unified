import test from "node:test";
import assert from "node:assert/strict";
import {assessInboundSupplierContract} from "./inbound-contract-gate.mjs";
const sha="a".repeat(64);
const good=()=>({
 contract:{
  id:"signed_sow_2026_001",sha256:sha,supplier:"AuthiChain",role:"service_provider",
  sku:"mcp_a2a_build",incomingTotalCents:150000,currency:"usd",
  deliveryDays:20,scope:"One scoped MCP and A2A integration delivered digitally",
  autoRenew:false,indefiniteScope:false,subcontractingRequired:false,noProductionSecretsShared:true
 },
 operationalProof:{
  targetRevision:sha,deployedToApprovedEnvironment:true,exactHeadQualityGatePassed:true,
  independentReviewApproved:true,completeDeliverySimulationPassed:true,
  customerAccessibleOutputVerified:true,retriesAndIdempotencyProven:true,
  revocationAndIncidentResponseTested:true,evidenceRef:"private:operator_test_receipt_20261103"
 },
 cashFlow:{maxOutboundCents:0,requiredActions:[],noProcurement:true,noVendorPayments:true},
 risk:{unlimitedLiability:false,physicalGoods:false,regulatedClaims:false,
  thirdPartyFulfillment:false,maxContractLiabilityCents:150000,
  legalReviewCompleted:true,mandatoryRefundPathReviewed:true,
  reviewEvidenceRef:"private:contract_legal_review_001"},
 buyer:{businessId:"business_independent_001",independentFromFounder:true,
  authorityEvidenceRef:"private:signer_authorization_001",processorEligibilityReviewed:true}
});
test("empty evidence is blocked and never a contract",()=>{
 const r=assessInboundSupplierContract();
 assert.equal(r.status,"BLOCKED");
 assert.equal(r.accepted,false);
 assert.equal(r.automaticAcceptanceAuthorized,false);
 assert.equal(r.automaticSpendAuthorized,false);
});
test("even all self-asserted green inputs cannot bind an agreement",()=>{
 const r=assessInboundSupplierContract(good());
 assert.equal(r.status,"PRELIMINARY_REVIEW_ONLY");
 assert.equal(r.independentEvidenceVerified,false);
 assert.equal(r.exactContractAuthorityVerified,false);
 assert.equal(r.accepted,false);
 assert.equal(r.legallyBindingAcceptanceSent,false);
 assert.equal(r.eSignatureApplied,false);
});
test("never accepts contracts as purchaser rather than supplier",()=>{
 const i=good();i.contract.role="buyer";
 assert.ok(assessInboundSupplierContract(i).missing.includes("authichain_is_supplier"));
});
test("supplier contract cannot require even one cent to leave the account",()=>{
 const i=good();i.cashFlow.maxOutboundCents=1;
 assert.ok(assessInboundSupplierContract(i).missing.includes("no_outgoing_cash_obligation"));
});
test("supplier contract cannot require external part procurement",()=>{
 const i=good();i.cashFlow.requiredActions=["purchase_parts"];
 assert.ok(assessInboundSupplierContract(i).missing.includes("no_outgoing_cash_obligation"));
});
test("no physical shipments and unverified regulated claims",()=>{
 const i=good();i.risk.physicalGoods=true;i.risk.regulatedClaims=true;
 assert.ok(assessInboundSupplierContract(i).missing.includes("no_unlimited_liability"));
});
test("overriding liability to unlimited fails",()=>{
 const i=good();i.risk.unlimitedLiability=true;
 assert.ok(assessInboundSupplierContract(i).missing.includes("no_unlimited_liability"));
});
test("unverified or incomplete AgentZ fulfillment fails",()=>{
 const i=good();i.operationalProof.customerAccessibleOutputVerified=false;
 assert.ok(assessInboundSupplierContract(i).missing.includes("agentz_reproducible_fulfillment"));
});
test("no independent buyer or payment processing permission fails",()=>{
 const i=good();i.buyer.processorEligibilityReviewed=false;
 assert.ok(assessInboundSupplierContract(i).missing.includes("buyer_and_payment_authority"));
});
test("auto renewing terms and indefinite duties fail",()=>{
 const i=good();i.contract.autoRenew=true;i.contract.indefiniteScope=true;
 assert.ok(assessInboundSupplierContract(i).missing.includes("no_open_ended_performance"));
});
test("missing exact contract hash fails",()=>{
 const i=good();i.contract.sha256="unbound_claim";
 assert.ok(assessInboundSupplierContract(i).missing.includes("immutable_contract_identifier"));
});
test("legal and mandatory-refund review required even for receive-only",()=>{
 const i=good();i.risk.mandatoryRefundPathReviewed=false;
 assert.ok(assessInboundSupplierContract(i).missing.includes("legal_and_refund_policy_review"));
});
test("cannot use third-party-dependent delivery as fully autonomous",()=>{
 const i=good();i.risk.thirdPartyFulfillment=true;
 assert.ok(assessInboundSupplierContract(i).missing.includes("no_unlimited_liability"));
});
test("zero-value and unscheduled scopes fail",()=>{
 const i=good();i.contract.incomingTotalCents=0;i.contract.deliveryDays=0;
 assert.ok(assessInboundSupplierContract(i).missing.includes("finite_revenue_and_scope"));
});
