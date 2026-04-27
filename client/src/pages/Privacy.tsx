import { useEffect } from "react";

export default function Privacy() {
  useEffect(() => {
    document.title = "Privacy Policy | AuthiChain";
  }, []);

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-sm leading-relaxed">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground mb-10">Effective Date: April 27, 2026</p>
      <p className="mb-6">
        AuthiChain respects your privacy. This Privacy Policy explains how we
        collect, use, disclose, and protect information when you use our
        platform, APIs, or otherwise engage with our services.
      </p>
    </main>
  );
}
