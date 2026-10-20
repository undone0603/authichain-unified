/** Metering is off. These zeros are not a passport scan. */
export function analyticsStub(period: string) {
  return {
    period,
    verifications: { total: 0 },
    qrCodesGenerated: 0,
    certificatesIssued: 0,
    activeAgents: 0,
    message:
      "Usage metering is not active. These counts are not a passport scan.",
  };
}
