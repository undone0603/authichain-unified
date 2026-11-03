/**
 * Inbound contract acceptance preflight for AuthiChain acting as a service supplier.
 * IMPORTANT: This function is NOT an electronic signature, agreement, or mandate.
 * Every caller field is untrusted until reconciled with external original receipts.
 * Even a passing preflight DOES NOT execute or authorize acceptance.
 */
const PRODUCTS = new Set(["mcp_a2a_build", "agent_rail_hosting", "read_only_verification"]);
const SHA256 = /^[0-9a-f]{64}$/i;
const REF = /^private:[a-zA-Z0-9_.:-]{10,160}$/;
const ID = /^[a-zA-Z0-9_.:-]{8,100}$/;
const isObject = x => x !== null && typeof x === "object" && !Array.isArray(x);
const money = n => Number.isSafeInteger(n) && n >= 0 && n <= 100_000_000;
const safeArray = x => Array.isArray(x) && x.length <= 20 && x.every(z => typeof z === "string" && z.length <= 120);

/**
 * IMPORTANT: "conditions_met" is a preliminary shape check only.
 * User-provided attestations/booleans are never considered authenticated proof.
 * Trusted external validation, a scoped owner mandate, a record of the exact
 * offer, and a legally appropriate signing channel are all separate release gates.
 */
export function assessInboundSupplierContract(input = {}) {
  const c = isObject(input.contract) ? input.contract : {};
  const op = isObject(input.operationalProof) ? input.operationalProof : {};
  const finance = isObject(input.cashFlow) ? input.cashFlow : {};
  const risks = isObject(input.risk) ? input.risk : {};
  const buyer = isObject(input.buyer) ? input.buyer : {};
  const gates = [];
  const check = (key, pass, required) => gates.push({
    key, pass: pass === true, required
  });
  check("immutable_contract_identifier",
    typeof c.id === "string" && ID.test(c.id) && typeof c.sha256 === "string" && SHA256.test(c.sha256),
    "Signed or otherwise authenticated exact contract version and SHA-256 digest");
  check("authichain_is_supplier",
    c.supplier === "AuthiChain" && c.role === "service_provider" &&
    PRODUCTS.has(c.sku),
    "Inbound authorized AuthiChain digital service; not a purchase from a vendor");
  check("finite_revenue_and_scope",
    money(c.incomingTotalCents) && c.incomingTotalCents > 0 &&
    c.currency === "usd" &&
    Number.isInteger(c.deliveryDays) && c.deliveryDays > 0 && c.deliveryDays <= 90 &&
    typeof c.scope === "string" && c.scope.length >= 12 && c.scope.length <= 600,
    "Fixed payable amount, bounded deliverables, and an achievable deadline");
  check("no_outgoing_cash_obligation",
    money(finance.maxOutboundCents) && finance.maxOutboundCents === 0 &&
    safeArray(finance.requiredActions) && finance.requiredActions.length === 0 &&
    finance.noProcurement === true &&
    finance.noVendorPayments === true,
    "No purchases, deposits, transfers, external vendor fees, or mandatory funding");
  check("no_unlimited_liability",
    risks.unlimitedLiability === false &&
    risks.physicalGoods === false && risks.regulatedClaims === false &&
    risks.thirdPartyFulfillment === false &&
    money(risks.maxContractLiabilityCents) &&
    risks.maxContractLiabilityCents <= c.incomingTotalCents,
    "Bounded provider liability, software-only deliverable, no dependence on uncontrolled parties");
  check("buyer_and_payment_authority",
    typeof buyer.businessId === "string" && ID.test(buyer.businessId) &&
    buyer.independentFromFounder === true &&
    typeof buyer.authorityEvidenceRef === "string" && REF.test(buyer.authorityEvidenceRef) &&
    buyer.processorEligibilityReviewed === true,
    "Verified independent buyer and payment processor eligibility for the exact service");
  check("agentz_reproducible_fulfillment",
    typeof op.targetRevision === "string" && SHA256.test(op.targetRevision) &&
    op.deployedToApprovedEnvironment === true &&
    op.exactHeadQualityGatePassed === true &&
    op.independentReviewApproved === true &&
    op.completeDeliverySimulationPassed === true &&
    op.customerAccessibleOutputVerified === true &&
    op.retriesAndIdempotencyProven === true &&
    op.revocationAndIncidentResponseTested === true &&
    typeof op.evidenceRef === "string" && REF.test(op.evidenceRef),
    "Independent exact-head environment, end-to-end proof, retry, revocation and buyer access");
  check("no_open_ended_performance",
    c.autoRenew === false && c.indefiniteScope === false &&
    c.subcontractingRequired === false && c.noProductionSecretsShared === true,
    "Time-bounded single scope; no unapproved recurring or sensitive duties");
  check("legal_and_refund_policy_review",
    risks.legalReviewCompleted === true && risks.mandatoryRefundPathReviewed === true &&
    typeof risks.reviewEvidenceRef === "string" && REF.test(risks.reviewEvidenceRef),
    "Human legal review of enforceability, consumer/commercial refund duties, and disclosures");

  const failures = gates.filter(g => !g.pass).map(g => g.key);
  const preliminarilyEligible = failures.length === 0;
  return {
    schema:"authichain-inbound-contract-gate/0.1",
    role:"service_supplier_only",
    fundingPolicy:"ACCEPT_INBOUND_FUNDS_ONLY",
    status:preliminarilyEligible ? "PRELIMINARY_REVIEW_ONLY" : "BLOCKED",
    conditions_met_by_untrusted_input:preliminarilyEligible,
    independentEvidenceVerified:false,
    exactContractAuthorityVerified:false,
    eSignatureApplied:false,
    legallyBindingAcceptanceSent:false,
    signedContractCreated:false,
    accepted:false,
    automaticAcceptanceAuthorized:false,
    automaticSpendAuthorized:false,
    noOutboundFunds:true,
    missing:failures,
    gates,
    nextRequired:[
      "Validate genuine signed supplier authority and customer identity against original private records",
      "Independently reproduce AgentZ delivery and refund/incident capability on approved exact deployment",
      "Review the exact contract version and applicable law, and verify a time-limited signer mandate",
      "Only then enable a separately audited binding acceptance adapter with durable receipts and revocation controls"
    ],
    note:"A green caller-provided checklist is not evidence of actual fulfillment or contract authority. This function cannot sign, transmit, bind, bill, spend, or fulfill."
  };
}
