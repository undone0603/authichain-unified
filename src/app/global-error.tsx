"use client";

import { useEffect } from "react";

// global-error.tsx catches errors thrown inside the root layout itself
// (e.g. a provider crash). It replaces the entire page, so it must include
// its own <html> and <body> tags.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
              Something went wrong
            </h1>
            <p
              style={{
                color: "#6b7280",
                marginTop: "0.5rem",
                fontSize: "0.875rem",
              }}
            >
              A critical error occurred. Please refresh the page.
            </p>
            {error.digest && (
              <p
                style={{
                  color: "#9ca3af",
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  marginTop: "0.25rem",
                }}
              >
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <button
            onClick={reset}
            style={{
              background: "#111827",
              color: "#fff",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
