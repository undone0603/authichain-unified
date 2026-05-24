import React from 'react';

// Next.js App Router expects `params` to match the folder name `[productId]`
export default function VerifyProductPage({
  params,
}: {
  params: { productId: string };
}) {
  const { productId } = params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 border border-gray-100 dark:border-gray-700">
        
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            AuthiChain Verification
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Secure authenticity check in progress
          </p>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-4 py-4 rounded-lg text-sm mb-8 text-center border border-blue-100 dark:border-blue-800/50">
          <span className="block text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
            Target ID
          </span>
          <span className="font-mono font-semibold break-all text-base">
            {productId}
          </span>
        </div>

        {/* UI state while delegating verification to the Qron Edge Worker infrastructure */}
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-500"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
            Connecting to edge node...
          </p>
        </div>

      </div>
    </main>
  );
}
