import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | AuthiChain',
  description: 'AuthiChain Terms of Service - Read our terms and conditions for using the AuthiChain platform.',
}

export default function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16 text-white">
      <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
      <p className="text-gray-400 mb-10">Effective Date: April 27, 2026</p>

      <section className="space-y-8 text-gray-300 leading-relaxed">
        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the AuthiChain platform (&ldquo;Service&rdquo;), you agree to be bound by these Terms of Service
            (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not use the Service.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">2. Description of Service</h2>
          <p>
            AuthiChain provides blockchain-based product authentication, QR code verification, NFT-backed provenance
            records, and supply chain traceability tools for brands, enterprises, and consumers.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">3. User Accounts</h2>
          <p>
            You must create an account to access certain features. You are responsible for maintaining the
            confidentiality of your credentials and all activity under your account. You must be at least 18 years old
            to use this Service.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">4. Acceptable Use</h2>
          <p>
            You agree not to misuse the Service, including but not limited to: attempting to forge authentication
            records, reverse-engineering smart contracts, uploading malicious content, or violating any applicable law
            or regulation.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">5. Intellectual Property</h2>
          <p>
            All content, trademarks, and technology on the AuthiChain platform are the property of AuthiChain or its
            licensors. You may not reproduce, distribute, or create derivative works without explicit written
            permission.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">6. QRON Token &amp; Payments</h2>
          <p>
            QRON tokens and any on-chain transactions are subject to blockchain network conditions. AuthiChain is not
            liable for transaction failures, gas fee fluctuations, or losses resulting from blockchain activity.
            Subscription payments processed via Stripe are subject to Stripe&#39;s terms.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, AuthiChain shall not be liable for indirect, incidental, or
            consequential damages arising from your use of the Service. Our total liability shall not exceed the amount
            you paid us in the 12 months prior to the claim.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">8. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account at our discretion for violations of these Terms.
            You may cancel your account at any time through your account settings.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">9. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the Service after changes constitutes
            acceptance of the new Terms. We will notify users of material changes via email or platform notice.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">10. Contact</h2>
          <p>
            For questions about these Terms, contact us at{' '}
            <a href="mailto:legal@authichain.com" className="text-blue-400 underline">
              legal@authichain.com
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
