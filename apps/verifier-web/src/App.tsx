import { useState } from "react";
import {
  verifyAttestationJws,
  AuthiChainAttestationV01,
} from "../../../packages/verifier/src/index";

// Minimal JWKS for demonstration - In production, this would be fetched from /.well-known/jwks.json
const MOCK_JWKS = {
  kty: "OKP",
  crv: "Ed25519",
  x: "v7-3i1YQ27c8d92Vn-jY92Zk3J-D1w92h1g0F1", // Placeholder
  kid: "fixture-key-id",
};

const VerifierApp = () => {
  const [jws, setJws] = useState("");
  const [result, setResult] = useState<{
    valid: boolean;
    attestation?: AuthiChainAttestationV01;
    error?: string;
  } | null>(null);

  const handleVerify = async () => {
    try {
      setResult(null);
      const attestation = await verifyAttestationJws(jws, MOCK_JWKS);
      setResult({ valid: true, attestation });
    } catch (e: any) {
      setResult({ valid: false, error: e.message || "Verification failed" });
    }
  };

  return (
    <div
      style={{
        padding: "2rem",
        fontFamily: "sans-serif",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <h1>AuthiChain Verifier</h1>
      <textarea
        value={jws}
        onChange={e => setJws(e.target.value)}
        placeholder="Paste compact JWS here"
        style={{ width: "100%", height: "100px", marginBottom: "1rem" }}
      />
      <button onClick={handleVerify} style={{ padding: "0.5rem 1rem" }}>
        Verify
      </button>

      {result && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1rem",
            border: `1px solid ${result.valid ? "green" : "red"}`,
          }}
        >
          <h2>Result: {result.valid ? "VALID" : "INVALID"}</h2>
          {result.error && (
            <p style={{ color: "red" }}>Error: {result.error}</p>
          )}
          {result.attestation && (
            <pre style={{ background: "#f4f4f4", padding: "1rem" }}>
              {JSON.stringify(result.attestation, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default VerifierApp;
