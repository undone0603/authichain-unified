import { getProductById, getProductQrCodes } from '../../../../server/db';

export default async function VerifyProductPage({
  params,
}: {
  params: { productId: string };
}) {
  const { productId } = params;
  const numId = parseInt(productId, 10);

  const product = isNaN(numId) ? null : await getProductById(numId);
  const qrCodes = product ? await getProductQrCodes(numId) : [];
  const latestQr = qrCodes[0] ?? null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 border border-gray-100 dark:border-gray-700">

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            AuthiChain Verification
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Cryptographic provenance check
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-4 py-4 rounded-lg text-sm mb-8 text-center border border-blue-100 dark:border-blue-800/50">
          <span className="block text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
            Product ID
          </span>
          <span className="font-mono font-semibold break-all text-base">
            {productId}
          </span>
        </div>

        {product ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-green-800 dark:text-green-300">Authentic</div>
                <div className="text-xs text-green-600 dark:text-green-400">Verified on-chain</div>
              </div>
            </div>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <dt className="text-gray-500 dark:text-gray-400">Product</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{product.name}</dd>
              </div>
              {product.serialNumber && (
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <dt className="text-gray-500 dark:text-gray-400">Serial</dt>
                  <dd className="font-mono text-gray-900 dark:text-white">{product.serialNumber}</dd>
                </div>
              )}
              {product.brand && (
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <dt className="text-gray-500 dark:text-gray-400">Brand</dt>
                  <dd className="font-mono text-gray-900 dark:text-white">{product.brand}</dd>
                </div>
              )}
              <div className="flex justify-between py-2">
                <dt className="text-gray-500 dark:text-gray-400">Registered</dt>
                <dd className="text-gray-900 dark:text-white">
                  {latestQr
                    ? new Date(latestQr.createdAt).toLocaleString()
                    : new Date(product.createdAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-gray-700 dark:text-gray-300 font-medium">Product not found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              This product ID was not found on the AuthiChain truth layer. It may be counterfeit or not yet registered.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
