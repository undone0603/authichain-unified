export type InboundContractGateInput = {
  contract?: {
    id?:string; sha256?:string; supplier?:string; role?:string; sku?:string;
    incomingTotalCents?:number; currency?:string; deliveryDays?:number; scope?:string;
    autoRenew?:boolean; indefiniteScope?:boolean; subcontractingRequired?:boolean;
    noProductionSecretsShared?:boolean;
  };
  operationalProof?:Record<string,unknown>;
  cashFlow?:Record<string,unknown>;
  risk?:Record<string,unknown>;
  buyer?:Record<string,unknown>;
};
export type InboundContractReadiness={
  schema:"authichain-inbound-contract-gate/0.1";
  role:"service_supplier_only";
  fundingPolicy:"ACCEPT_INBOUND_FUNDS_ONLY";
  status:"BLOCKED"|"PRELIMINARY_REVIEW_ONLY";
  conditions_met_by_untrusted_input:boolean;
  independentEvidenceVerified:false;
  exactContractAuthorityVerified:false;
  accepted:false;
  automaticAcceptanceAuthorized:false;
  automaticSpendAuthorized:false;
  legallyBindingAcceptanceSent:false;
  eSignatureApplied:false;
  signedContractCreated:false;
  noOutboundFunds:true;
  missing:string[];
  gates:Array<{key:string;pass:boolean;required:string}>;
  nextRequired:string[];
  note:string;
};
export function assessInboundSupplierContract(input?:InboundContractGateInput):InboundContractReadiness;
