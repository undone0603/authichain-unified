export type Jurisdiction = 'FEDERAL_FTC' | 'FEDERAL_CUSTOMS' | 'CALIFORNIA';

export type ClaimDecision =
  | 'UNQUALIFIED_ALLOWED'
  | 'QUALIFIED_ALLOWED'
  | 'SPECIFIC_PROCESS_CLAIM_ONLY'
  | 'REVIEW_REQUIRED'
  | 'BLOCKED'
  | 'INSUFFICIENT_EVIDENCE';

export type PassportStatus =
  | 'ACTIVE'
  | 'REVOKED'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'SUSPENDED'
  | 'REVIEW_REQUIRED';

export type SignatureStatus =
  | 'SIGNATURE_PRESENT'
  | 'SIGNATURE_VERIFIED'
  | 'SIGNATURE_UNVERIFIED'
  | 'SIGNATURE_INVALID'
  | 'SIGNATURE_NOT_DETECTED';

export type SubstantialTransformationStatus =
  | 'SUBSTANTIAL_TRANSFORMATION_CONFIRMED'
  | 'SUBSTANTIAL_TRANSFORMATION_SUPPORTED'
  | 'SUBSTANTIAL_TRANSFORMATION_UNKNOWN'
  | 'SUBSTANTIAL_TRANSFORMATION_NOT_SUPPORTED';

export interface RulesetVersion {
  id: string;
  jurisdiction: Jurisdiction;
  authority: string;
  citation: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  ruleType: string;
  parameters: {
    unqualifiedThresholdPercent: number; // e.g., 90 for "all or virtually all"
    historicalReferenceThresholdPercent?: number; // e.g., 75
    requireFinalAssemblyInUs: boolean;
    requireSubstantialTransformation: boolean;
    [key: string]: any;
  };
  sourceUrl: string;
  sourceHash: string;
  retrievedAt: string;
  status: 'ACTIVE' | 'DEPRECATED' | 'PROPOSED';
}

export interface BOMComponent {
  componentId: string;
  componentName: string;
  quantity: number;
  unitCost: number;
  currency: string;
  supplierId?: string;
  supplierName?: string;
  supplierCountry: string;
  manufacturingCountry: string;
  laborCost: number;
  materialCost: number;
  overheadCost: number;
  freightCost: number;
  htsCode?: string;
  countryOfOrigin: string;
  finalTransformationCountry: string;
  documentationId?: string;
}

export interface BOMPayload {
  productId: string;
  version: string;
  components: BOMComponent[];
}

export interface SupplierDocumentPayload {
  supplierId: string;
  documentType: 'AFFIDAVIT' | 'CERTIFICATE_OF_ORIGIN' | 'INVOICE' | 'COST_CERTIFICATION';
  fileUrl: string;
  documentHash: string;
  extractedFields: Record<string, any>;
  ocrConfidence: number;
  signatureStatus: SignatureStatus;
}

export interface CostCalculationResult {
  totalManufacturingCost: number;
  usManufacturingCost: number;
  foreignManufacturingCost: number;
  usContentPercentage: number;
  foreignContentPercentage: number;
  qualifyingCosts: Record<string, number>;
  excludedCosts: Record<string, number>;
  calculationDetails: any;
}

export interface OriginDeterminationResult {
  componentId?: string;
  htsCode?: string;
  manufacturingProcess?: string;
  processingSteps: string[];
  finalTransformationCountry: string;
  transformationStatus: SubstantialTransformationStatus;
  confidence: number;
  reasoning: string;
  evidenceManifest: any;
}

export interface ClaimEvaluationResult {
  decision: ClaimDecision;
  claimText: string;
  confidence: number;
  evidenceVector: {
    documentConfidence: number;
    ocrConfidence: number;
    signatureConfidence: number;
    supplierConfidence: number;
    originConfidence: number;
    costConfidence: number;
    htsConfidence: number;
    transformationConfidence: number;
    ruleConfidence: number;
    [key: string]: number;
  };
  warnings: string[];
  reviewRequired: boolean;
}

export interface ClaimPassport {
  passportId: string;
  productId: string;
  determinationId: string;
  issuer: string;
  client?: string;
  status: PassportStatus;
  documentHash: string;
  evidenceManifestHash: string;
  passportHash: string;
  signature: string;
  metadata: Record<string, any>;
  expiresAt?: string;
  createdAt: string;
}
