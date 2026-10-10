path = "/workspaces/authichain-unified/apps/verifier-web/src/App.tsx"
code = """import { useState } from "react";
import {
  verifyAttestationJwS,
  AttestationEvaluation,
} from "../../../packages/verifier/src/index";

const MOCK_JWKS = {
  kty: "OKP",
  crv: "Ed25519",
  x: "V7-3l1VQZ7C8US2Vn-jY9Z2k3J-D1w92h1g0F1",
  kid: "fixture-key-id",
};

const VerifierApp = () => {
  const [ws, setWs] = useState("");
  const [result, setResult] = useState<{
    valid: boolean;
    attestation?: AttestationEvaluation;
    error?: string;
  } | null>(null);

  const handleVerify = async () => {
    try {
      const attestation = await verifyAttestationJwS(ws, MOCK_JWKS);
      setResult({ valid: true, attestation });
    } catch (err: any) {
      setResult({ valid: false, error: err.message || "Verification failed" });
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>AuthIChain Verifier</h1>
      <textarea
        value={ws}
        onChange={(e) => setWs(e.target.value)}
        placeholder="Paste compact JWS here"
        style={{ width: "100%", height: "100px", marginBottom: "1rem" }}
      />
      <button onClick={handleVerify} style={{ padding: "0.5rem 1rem" }}>
        Verify
      </button>
      {result && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Result: {result.valid ? "VALID" : "INVALID"}</h3>
          {result.error && <p style={{ color: "red" }}>{result.error}</p>}
          {result.attestation && (
            <pre>{JSON.stringify(result.attestation, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
};

export default VerifierApp;
"""

with open(path, "w") as f:
    f.write(code)

print("FILE_REWRITTEN_CLEAN")
