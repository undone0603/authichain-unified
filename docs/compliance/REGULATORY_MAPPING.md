# AuthiChain Regulatory Compliance Mapping: DSCSA & QMSR

This document maps AuthiChain's cryptographically anchored evidence types to specific regulatory requirements, providing the foundation for our automated Compliance Readiness Pack generator.

## 1. Pharma (DSCSA) Compliance Mapping

| DSCSA Requirement                | AuthiChain Evidence Type  | Required Metadata                                 |
| :------------------------------- | :------------------------ | :------------------------------------------------ |
| **Transaction Information (TI)** | `commission` / `shipment` | `lotNumber`, `expirationDate`, `tradingPartnerId` |
| **Transaction Statement (TS)**   | `attestation` (signed)    | `transactionId`, `issuer.id`                      |
| **Transaction History (TH)**     | Evidence Graph (Chain)    | `parent_evidence_id` links                        |

## 2. Medical Device (QMSR) Compliance Mapping

| QMSR/UDI Requirement       | AuthiChain Evidence Type | Required Metadata               |
| :------------------------- | :----------------------- | :------------------------------ |
| **UDI Identity**           | `Identity Plane`         | `UDI-DI`, `UDI-PI`              |
| **Manufacturing Evidence** | `manufacturing`          | `modelNumber`, `lotNumber`      |
| **Inspection/QMS Record**  | `inspection`             | `inspectorId`, `passFailResult` |

## 3. Automated Compliance Report Generator (Design)

The report generator will ingest the Evidence Graph for a specific `subject_id` (Product/Batch) and:

1. Verify the presence of all required Evidence Types for the selected Profile (DSCSA/UDI).
2. Validate the integrity of cryptographic signatures for every required evidence record.
3. Consolidate required metadata into a JSON/PDF "Compliance Readiness Pack".

## 4. Next Implementation Steps

- [ ] Create the `AuditReportService` that queries the Evidence Graph for a given `subject_id`.
- [ ] Develop the template engine that converts the Evidence Graph into a readable compliance report.
- [ ] Finalize conformance testing to ensure the audit generator is tamper-evident (i.e., signatures are verified _before_ report generation).
