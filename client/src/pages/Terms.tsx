import { useEffect } from "react";

export default function Terms() {
  useEffect(() => {
    document.title = "Terms of Service | AuthiChain";
  }, []);

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-sm leading-relaxed">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground mb-10">Effective Date: April 27, 2026</p>
      <p className="mb-6">
        Welcome to AuthiChain. These Terms of Service govern your access to and
        use of the AuthiChain platform, APIs, QRON-related services, and all
        associated software and functionality. By accessing AuthiChain, you
        agree to be bound by these Terms.
      </p>
    </main>
  );
}
