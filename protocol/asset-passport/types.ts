export type AssetClass =
  | "generic_physical_asset"
  | "precious_metal_bar"
  | "battery"
  | "electronics"
  | "regulated_product";

export type IdentityScheme =
  | "gs1"
  | "issuer_serial"
  | "certificate"
  | "composite";

export interface AssetIdentity {
  scheme: IdentityScheme;
  objectId: string;
  issuerNamespace?: string;
  gtin?: string;
  serial?: string;
  lot?: string;
  certificateId?: string;
}

export interface AssetClaim {
  id: string;
  field: string;
  value: string | number | boolean;
  unit?: string;
  issuer: string;
  evidenceIds?: string[];
}

export type EvidenceType =
  | "assay_certificate"
  | "manufacturing_record"
  | "inspection_report"
  | "photograph"
  | "measurement"
  | "shipment_record"
  | "ownership_record";

export interface Evidence {
  id: string;
  type: EvidenceType;
  issuer: string;
  capturedAt: string;
  sha256?: string;
  sourceUri?: string;
  metadata?: Record<string, string | number | boolean>;
}

export type InspectionMethod =
  | "visual_serial_match"
  | "package_integrity"
  | "weight_measurement"
  | "dimension_measurement"
  | "xrf"
  | "ultrasound"
  | "density"
  | "microscopy";

export interface PhysicalInspection {
  id: string;
  inspector: string;
  inspectedAt: string;
  methods: InspectionMethod[];
  observations: Record<string, string | number | boolean>;
  evidenceIds?: string[];
}

export type LifecycleEventType =
  | "manufactured"
  | "packaged"
  | "inspected"
  | "shipped"
  | "custody_transfer"
  | "registered"
  | "revoked"
  | "superseded";

export interface LifecycleEvent {
  id: string;
  type: LifecycleEventType;
  occurredAt: string;
  actor: string;
  reason?: string;
  previousEventId?: string;
}

export interface HighValueAssetPassport {
  schema: "authichain.high-value-asset-passport/v0.1";
  assetClass: AssetClass;
  identity: AssetIdentity;
  issuer: string;
  claims: AssetClaim[];
  evidence: Evidence[];
  inspections?: PhysicalInspection[];
  lifecycle?: LifecycleEvent[];
  status: "active" | "revoked" | "superseded" | "unknown";
  verificationPolicy?: {
    requirePhysicalInspection?: boolean;
    requireTrustedIssuer?: boolean;
    requireEvidenceForClaims?: boolean;
  };
}
