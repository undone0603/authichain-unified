import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import * as verifier from "../../../packages/verifier/src/index";

// Mock the verifier to control outcomes
vi.mock("../../../packages/verifier/src/index", async () => {
  const actual = await vi.importActual("../../../packages/verifier/src/index");
  return {
    ...actual,
    verifyAttestationJws: vi.fn(),
  };
});

describe("VerifierApp", () => {
  it("renders correctly", () => {
    render(<App />);
    expect(screen.getByText(/AuthiChain Verifier/i)).toBeInTheDocument();
  });

  it("shows validation result on success", async () => {
    const mockAttestation = { version: "0.1", attestation_id: "test" };
    (verifier.verifyAttestationJws as any).mockResolvedValue(mockAttestation);

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/Paste compact JWS/i), {
      target: { value: "valid-jws" },
    });
    fireEvent.click(screen.getByText(/Verify/i));

    await waitFor(() => {
      expect(screen.getByText(/Result: VALID/i)).toBeInTheDocument();
      expect(screen.getByText(/"attestation_id": "test"/i)).toBeInTheDocument();
    });
  });

  it("shows error on failure", async () => {
    (verifier.verifyAttestationJws as any).mockRejectedValue(
      new Error("Invalid signature")
    );

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/Paste compact JWS/i), {
      target: { value: "invalid-jws" },
    });
    fireEvent.click(screen.getByText(/Verify/i));

    await waitFor(() => {
      expect(screen.getByText(/Result: INVALID/i)).toBeInTheDocument();
      expect(screen.getByText(/Error: Invalid signature/i)).toBeInTheDocument();
    });
  });
});
