/**
 * A titled block of prose, shared by the three static public pages
 * (`/about`, `/privacy`, `/sms-terms`).
 *
 * It lived as an identical local copy inside `privacy/page.tsx` and
 * `sms-terms/page.tsx` before `/about` needed a third — at which point the
 * duplication stopped being cheaper than the import.
 *
 * Server component on purpose: these pages render no interactivity, and adding
 * `"use client"` here would pull all three into the browser bundle for nothing.
 */
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
        {title}
      </h2>
      <div className="text-sm text-gray-600 dark:text-slate-300 space-y-3 leading-relaxed">
        {children}
      </div>
    </section>
  );
}
