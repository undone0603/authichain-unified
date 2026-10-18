export default function LiveSealPage() {
  const mintTx = "0xa07d0bbadcc958b3f6fc8d81acda16a54c4bcfdb5e86bd2ce186e27f5752ab3b";
  const holder = "authichain.base.eth";
  const contract = "0x34370EDA96e0C7e47f46F18e2D3a7298C241E16F";

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">This seal is already on Base.</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Founder example. Signature check + on-chain anchor. You can verify it without trusting us.
      </p>

      <section className="mt-8 rounded-lg border p-5">
        <h2 className="font-medium">Public proof</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Holder</dt>
            <dd className="font-mono">{holder}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Contract</dt>
            <dd className="font-mono text-xs">{contract}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Mint tx</dt>
            <dd>
              <a
                href={`https://basescan.org/tx/${mintTx}`}
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                view on BaseScan
              </a>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Open protocol</dt>
            <dd>
              <a href="/protocol" className="underline">run the verifier yourself</a>
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          What this does not prove: that any physical object is genuine. A signed record is not an inspection.
        </p>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <a
          href="/generate"
          className="inline-flex h-10 items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white"
        >
          Generate your own Living QR
        </a>
        <a
          href="/pricing"
          className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium"
        >
          Buy Starter — $29
        </a>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        100 generations for $29. Credits never expire unless you move to Launch.
      </p>

      <section className="mt-12 space-y-4 text-sm">
        <h2 className="font-medium">FAQ</h2>
        <details className="rounded border p-3">
          <summary className="cursor-pointer font-medium">Does this prove the product is authentic?</summary>
          <p className="mt-2 text-muted-foreground">
            No. It proves the claim was signed and the anchor hash matches what is on Base. Physical genuineness is a separate inspection.
          </p>
        </details>
        <details className="rounded border p-3">
          <summary className="cursor-pointer font-medium">Can I do this for my products?</summary>
          <p className="mt-2 text-muted-foreground">
            Yes. Self-serve generation and the $29 Starter Pack. No call required.
          </p>
        </details>
        <details className="rounded border p-3">
          <summary className="cursor-pointer font-medium">Is the public certificate registry live?</summary>
          <p className="mt-2 text-muted-foreground">
            In development. This page shows the live path that already exists.
          </p>
        </details>
      </section>
    </main>
  );
}
