import { SignedAttestation, AttestationStatus } from "./types";
import {
  AttestationStatusEvent,
  createStatusEvent,
  isValidStatusTransition,
} from "./lifecycle";

export class AttestationRepository {
  private attestations: Map<string, SignedAttestation> = new Map();
  private statusEvents: Map<string, AttestationStatusEvent[]> = new Map();

  async saveAttestation(
    attestation: SignedAttestation,
    createdBy: string
  ): Promise<void> {
    const id = attestation.payload.id;
    this.attestations.set(id, attestation);

    const initialEvent = createStatusEvent(id, "ISSUED", createdBy);
    const events = this.statusEvents.get(id) || [];
    events.push(initialEvent);
    this.statusEvents.set(id, events);
  }

  async getAttestation(id: string): Promise<SignedAttestation | null> {
    return this.attestations.get(id) || null;
  }

  async transitionStatus(
    attestationId: string,
    nextStatus: AttestationStatus,
    createdBy: string,
    options?: {
      reason?: string;
      supersededBy?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<AttestationStatusEvent> {
    const currentStatus = await this.getLatestStatus(attestationId);
    if (!currentStatus) {
      throw new Error(`Attestation not found: ${attestationId}`);
    }

    if (!isValidStatusTransition(currentStatus, nextStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${nextStatus} for attestation ${attestationId}`
      );
    }

    const event = createStatusEvent(
      attestationId,
      nextStatus,
      createdBy,
      options
    );
    const events = this.statusEvents.get(attestationId) || [];
    events.push(event);
    this.statusEvents.set(attestationId, events);

    return event;
  }

  async getLatestStatus(
    attestationId: string
  ): Promise<AttestationStatus | null> {
    const events = this.statusEvents.get(attestationId);
    if (!events || events.length === 0) return null;

    const attestation = this.attestations.get(attestationId);
    const latestEvent = events[events.length - 1];

    if (
      attestation?.payload.expiresAt &&
      new Date(attestation.payload.expiresAt) <= new Date() &&
      latestEvent.status !== "REVOKED" &&
      latestEvent.status !== "SUPERSEDED"
    ) {
      return "EXPIRED";
    }

    return latestEvent.status;
  }

  async getStatusEvents(
    attestationId: string
  ): Promise<AttestationStatusEvent[]> {
    return this.statusEvents.get(attestationId) || [];
  }
}
