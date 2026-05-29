export default function EnterpriseCheckout() {
  return (
    <div className="min-h-screen bg-black text-white py-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Secure Your Supply Chain
          </h1>
          <p className="mt-4 text-xl text-gray-400">
            StrainChain Enterprise Pilot Onboarding. Instant access to Polygon + METRC bridging.
          </p>
        </div>

        <div className="bg-gray-900 rounded-3xl shadow-2xl border border-gray-800 overflow-hidden">
          <div className="p-8 sm:p-12">
            <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-8">
              <div>
                <h2 className="text-2xl font-bold text-white">Enterprise Anchor Partner</h2>
                <p className="text-gray-400 mt-1">Michigan Retail & Cultivation</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-extrabold text-white">$500</p>
                <p className="text-sm text-gray-500">/ month</p>
              </div>
            </div>

            <ul className="space-y-4 mb-8 text-gray-300">
              <li className="flex items-center"><span className="text-green-500 mr-3">✓</span> Unlimited Tag Mints (TruMark)</li>
              <li className="flex items-center"><span className="text-green-500 mr-3">✓</span> On-site AI Verification</li>
              <li className="flex items-center"><span className="text-green-500 mr-3">✓</span> Polygon RPC Node</li>
              <li className="flex items-center"><span className="text-green-500 mr-3">✓</span> Onboarding & API Keys</li>
            </ul>

            <form action="/api/checkout/enterprise" method="POST" className="mt-8">
              <button
                type="submit"
                className="w-full flex justify-center py-4 px-8 border border-transparent rounded-xl shadow-sm text-lg font-bold text-black bg-white hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-colors"
              >
                Proceed to Secure Payment
              </button>
            </form>
            <p className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Secured by Stripe
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
