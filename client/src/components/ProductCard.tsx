import React from "react";

export interface ProductCardProps {
  title: string;
  description?: string;
  imageUrl?: string;
  score?: number; // authenticity / trust score 0-100
  onPrimaryClick?: () => void;
}

// Simple, reusable product/scan card used across dashboards and public pages.
export default function ProductCard({
  title,
  description,
  imageUrl,
  score,
  onPrimaryClick,
}: ProductCardProps) {
  return (
    <div className="w-full max-w-sm bg-white rounded-lg shadow-md overflow-hidden dark:bg-slate-900">
      {imageUrl ? (
        <img src={imageUrl} alt={title} className="h-48 w-full object-cover" />
      ) : (
        <div className="h-48 w-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
          <span className="text-sm text-gray-500">No image</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {description}
              </p>
            )}
          </div>

          {typeof score === "number" && (
            <div className="ml-3 flex flex-col items-end">
              <span className="text-xs text-gray-500">Authenticity</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.round(score)}
                </span>
                <span className="text-sm text-gray-500">/100</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={onPrimaryClick}
            className="inline-flex items-center px-3 py-2 bg-sky-600 text-white text-sm rounded-md hover:bg-sky-700"
          >
            View
          </button>

          <button
            onClick={() => navigator.clipboard?.writeText(title)}
            className="inline-flex items-center px-3 py-2 border border-slate-200 text-sm rounded-md text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            Copy title
          </button>
        </div>
      </div>
    </div>
  );
}
