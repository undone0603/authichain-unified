import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | AuthiChain',
  description: 'AuthiChain Privacy Policy - How we collect, use, and protect your personal data.',
}

export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16 text-white">
      <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-gray-400 mb-10">Effective Date: April 27, 2026</p>

      <section className="space-y-8 text-gray-300 leading-relaxed">
        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">1. Introduction</h2>
          <p>
            AuthiChain (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how
            we collect, use, disclose, and safeguard your information when you use our platform and services.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">2. Information We Collect</h2>
          <p>We may collect the following categories of information:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Account information (name, email address, wallet address)</li>
            <li>Transaction and authentication records stored on-chain</li>
            <li>Usage data (pages visited, features used, timestamps)</li>
            <li>Payment data processed securely via Stripe (we do not store card details)</li>
            <li>QR scan events and product verification logs</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Provide, operate, and improve the AuthiChain Service</li>
            <li>Process transactions and subscriptions</li>
            <li>Send transactional emails and platform notifications</li>
            <li>Detect fraud and ensure platform security</li>
            <li>Comply with legal obligations</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">4. Blockchain Data</h2>
          <p>
            Authentication records written to public blockchains (Base, Polygon) are immutable and publicly accessible
            by nature. Do not include sensitive personal information in on-chain metadata. AuthiChain is not
            responsible for public blockchain data once submitted.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">5. Data Sharing</h2>
          <p>
            We do not sell your personal information. We may share data with trusted third-party service providers
            (e.g., Supabase for database, Stripe for payments, Vercel for hosting) solely to operate the Service.
            These providers are bound by confidentiality obligations.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">6. Cookies &amp; Tracking</h2>
          <p>
            We use cookies and similar technologies to maintain sessions, analyze usage, and improve user experience.
            You can control cookie preferences through your browser settings.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">7. Data Retention</h2>
          <p>
            We retain your personal data for as long as your account is active or as needed to provide the Service. You
            may request deletion of your off-chain data by contacting us. On-chain records cannot be deleted.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">8. Your Rights</h2>
          <p>
            Depending on your jurisdiction, you may have rights to access, correct, or delete your personal data, as
            well as rights to data portability and objection to processing. To exercise these rights, contact{' '}
            <a href="mailto:privacy@authichain.com" className="text-blue-400 underline">
              privacy@authichain.com
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">9. Security</h2>
          <p>
            We implement industry-standard security measures including encryption in transit (TLS), environment
            variable isolation, and access-controlled databases. However, no method of transmission over the internet
            is 100% secure.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically. We will notify you of significant changes via email or a
            prominent notice on the platform. Continued use after changes constitutes acceptance.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">11. Contact Us</h2>
          <p>
            For privacy-related inquiries, contact us at{' '}
            <a href="mailto:privacy@authichain.com" className="text-blue-400 underline">
              privacy@authichain.com
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
