import { describe, expect, it } from "vitest";
import { existingHubSpotContactId } from "./hubspot-existing-contact";

const conflict =
  'HTTP-Code: 409 Message: An error occurred. Body: {"status":"error","message":"Contact already exists. Existing ID: 528641635034","category":"CONFLICT"}';

describe("existingHubSpotContactId", () => {
  it("returns the id when HubSpot says the contact already exists", () => {
    expect(existingHubSpotContactId(conflict)).toBe("528641635034");
  });

  it("returns null for a 409 that does not name an id", () => {
    expect(existingHubSpotContactId("HTTP-Code: 409")).toBeNull();
  });

  it("returns null for other HubSpot errors", () => {
    expect(existingHubSpotContactId("HTTP-Code: 401")).toBeNull();
    expect(existingHubSpotContactId("")).toBeNull();
  });
});
