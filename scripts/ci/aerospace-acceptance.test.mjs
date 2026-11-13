import test from 'node:test';
import assert from 'node:assert/strict';
import { assessAerospaceComponent } from './aerospace-acceptance.mjs';

const digest = c => 'sha256:' + c.repeat(64);
const valid = () => ({
  part: { manufacturer: 'Example Semiconductor', partNumber: 'EX-IC-001', serial: 'DEMO-SN-1' },
  issuer: { trusted: true, authorizedForPart: true },
  attestation: { signatureVerified: true, subjectMatched: true, currentStatus: 'active', issuerStatus: 'trusted', verifiedDecision: 'verified', freshStatusRead: true },
  procurement: { sourceType: 'authorized', authorityVerified: true, purchaseRecordDigest: digest('a') },
  custody: [
    { eventId:'origin', origin:'manufacturer', digest:digest('b'), signatureVerified:true, authorityVerified:true, partMatched:true, eventTimeMs:100 },
    { eventId:'transfer', origin:'distributor', digest:digest('c'), previousDigest:digest('b'), signatureVerified:true, authorityVerified:true, partMatched:true, eventTimeMs:200 },
  ],
  identityObservations:{registryChecked:true,duplicateCount:0,conflictCount:0},
  screening:{labAuthorityVerified:true,reportSignatureVerified:true,partMatched:true,result:'pass',reportDigest:digest('d'),projectRequirementsMatched:true},
  review:{missionSpecificReviewComplete:true,approvedSupplierListChecked:true,openDiscrepancies:0,qualityOwnerApproved:true}
});
function holds(label,mutate,reason) {
 test(label,()=>{const input=valid();mutate(input);const result=assessAerospaceComponent(input);assert.equal(result.decision,'HOLD');assert.equal(result.eligibleForHumanReview,false);assert.equal(result.flightReleaseAuthorized,false);assert.equal(result.counterfeitEstablished,false);assert.ok(result.reasons.includes(reason),JSON.stringify(result));});
}
test('positive synthetic package only qualifies for human quality review, not flight',()=>{
 const result=assessAerospaceComponent(valid());
 assert.equal(result.decision,'ELIGIBLE_FOR_HUMAN_REVIEW');
 assert.equal(result.eligibleForHumanReview,true);
 assert.equal(result.flightReleaseAuthorized,false);
 assert.equal(result.counterfeitEstablished,false);
 assert.deepEqual(result.reasons,[]);
});
test('null payload holds without counterfeit allegation',()=>{
 const result=assessAerospaceComponent(null);
 assert.equal(result.decision,'HOLD');
 assert.equal(result.counterfeitEstablished,false);
});
holds('part identity absent',x=>delete x.part.serial,'part_identity_missing');
holds('issuer is untrusted',x=>x.issuer.trusted=false,'manufacturer_authority_unverified');
holds('supplier lacks part-level authorization',x=>x.issuer.authorizedForPart=false,'manufacturer_authority_unverified');
holds('tampered cryptographic attestation',x=>x.attestation.signatureVerified=false,'signed_attestation_not_actionable');
holds('wrong signed product identity',x=>x.attestation.subjectMatched=false,'signed_attestation_not_actionable');
holds('revoked attestation',x=>x.attestation.currentStatus='revoked','signed_attestation_not_actionable');
holds('stale revocation status',x=>x.attestation.freshStatusRead=false,'signed_attestation_not_actionable');
holds('signed blocked decision',x=>x.attestation.verifiedDecision='blocked','signed_attestation_not_actionable');
holds('grey-market supplier',x=>x.procurement.sourceType='broker','authorized_provenance_not_established');
holds('invalid procurement digest',x=>x.procurement.purchaseRecordDigest='not-a-digest','authorized_provenance_not_established');
holds('incomplete custody chain',x=>x.custody.pop(),'custody_history_incomplete');
holds('unsigned custody transfer',x=>x.custody[1].signatureVerified=false,'custody_event_invalid');
holds('unmatched custody identity',x=>x.custody[1].partMatched=false,'custody_event_invalid');
holds('broken prior-event hash',x=>x.custody[1].previousDigest=digest('f'),'custody_continuity_invalid');
holds('timestamp rollback',x=>x.custody[1].eventTimeMs=90,'custody_continuity_invalid');
holds('unanchored manufacturer event',x=>x.custody[0].origin='unknown','manufacturer_custody_anchor_missing');
holds('duplicate custody IDs',x=>x.custody[1].eventId='origin','custody_event_invalid');
holds('duplicate serialized identity',x=>x.identityObservations.duplicateCount=1,'duplicate_identity_or_unchecked_registry');
holds('unchecked serial registry',x=>x.identityObservations.registryChecked=false,'duplicate_identity_or_unchecked_registry');
holds('unverified testing laboratory',x=>x.screening.labAuthorityVerified=false,'screening_evidence_incomplete');
holds('failed component screening',x=>x.screening.result='fail','screening_evidence_incomplete');
holds('wrong screening part',x=>x.screening.partMatched=false,'screening_evidence_incomplete');
holds('missing mission-specific testing',x=>x.screening.projectRequirementsMatched=false,'screening_evidence_incomplete');
holds('missing quality owner approval',x=>x.review.qualityOwnerApproved=false,'mission_quality_acceptance_pending');
holds('open nonconformity',x=>x.review.openDiscrepancies=1,'mission_quality_acceptance_pending');
