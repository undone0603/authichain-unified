export function FreeToolCta({ tool }: { tool: 'dpp-check' | 'generate' | 'battery-passport' }) {
  const title =
    tool === 'generate'
      ? 'Your Living QR is ready.'
      : tool === 'battery-passport'
        ? 'Your battery passport readiness map is ready.'
        : 'Your readiness map is ready.';
  const body =
    tool === 'generate'
      ? 'Keep generating scannable AI art with signed payloads. 100 per month on Launch.'
      : 'Close the gaps with signed seals and 100 Living QR generations per month.';

  return (
    <section className="mt-8 border border-warm-steel rounded-lg p-6 bg-ivory">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-elevated-charcoal">{body}</p>
      <p className="mt-1 text-sm text-steel">
        Free check complete. Nothing stored. Not a filing or legal opinion.
      </p>
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <a
          href="https://authichain.com/checkout/qron_launch"
          className="inline-flex items-center justify-center px-5 py-3 bg-ink text-ivory rounded font-medium"
          onClick={() =>
            fetch('/api/lead-capture', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tool,
                event: 'cta_click_launch',
                sku: 'qron_launch_mo',
              }),
            })
          }
        >
          Start Launch — $19/mo (cancel anytime)
        </a>
        <a
          href="https://authichain.com/checkout/starter"
          className="inline-flex items-center justify-center px-5 py-3 border border-ink text-ink rounded"
          onClick={() =>
            fetch('/api/lead-capture', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tool,
                event: 'cta_click_starter',
                sku: 'starter',
              }),
            })
          }
        >
          Or one-time Starter Pack $29
        </a>
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" />
        <span>
          Email me a copy of this summary (work email only).
          <span className="block text-xs text-steel">
            For cart recovery and one follow-up. No newsletter.
          </span>
        </span>
      </label>
    </section>
  );
}
