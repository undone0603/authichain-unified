export type NegotiationDirection = "minimize" | "maximize";
export type NegotiationIssue = {
  key: string;
  direction: NegotiationDirection;
  target: number;
  walkAway: number;
  weight: number;
  unit?: string;
};
export type NegotiationOffer = {
  id: string;
  terms: Record<string, number>;
};
export type NegotiationInput = {
  objective: string;
  issues: NegotiationIssue[];
  counterpartOffers?: NegotiationOffer[];
  outsideOption?: { terms: Record<string, number> };
  inboundContract?: import('./inbound-contract-gate.mjs').InboundContractGateInput;
};
export type NegotiationScore = {
  withinWalkAway: boolean;
  weightedUtility: number;
  issues: Array<{key:string;value:number;within:boolean;utility:number}>;
};
export type NegotiationOutput = {
  schema: "authichain-negotiate/0.1";
  status: "PROPOSALS_ONLY";
  decision: "NO_AGREEMENT_OR_AUTHORIZATION";
  issuePreferences: Array<NegotiationIssue & {unit:string|null}>;
  batna: {declared:boolean;verifiedByIndependentSource:false;weightedUtility?:number;withinWalkAway?:boolean;note:string};
  zopa: {status:"UNKNOWN";reason:string};
  counterpartOffers: Array<NegotiationScore & {id:string;status:string;source:string}>;
  proposals: Array<{id:string;strategy:string;terms:Record<string,number>;score:NegotiationScore}>;
  strategicNotes:string[];
  nextChecks:string[];
  allowedActions:{draft:true;score:true;counterpropose:false;sendMessage:false;acceptOffer:false;purchase:false;issuePayment:false;sign:false;createAccount:false};
  humanApprovalRequired:true;
  sideEffectsPerformed:0;
  inboundContractReadiness?: import('./inbound-contract-gate.mjs').InboundContractReadiness;
  caution:string;
};
export class NegotiationInputError extends Error {}
export function evaluateNegotiation(input: unknown): NegotiationOutput;
