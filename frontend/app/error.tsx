"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4 text-gray-400">⚠</p>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h1>
        <p className="text-gray-500 text-sm mb-6">An unexpected error occurred.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="border border-gray-200 text-gray-600 hover:bg-gray-100 font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
