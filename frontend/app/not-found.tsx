import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-6xl font-bold text-amber-400 mb-4">404</p>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Page not found</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">That page doesn&apos;t exist.</p>
        <Link
          href="/"
          className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
