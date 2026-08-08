"use client";

import { useSyncExternalStore } from "react";

// Multiple ThemeToggle instances (public header + admin nav) can be mounted at
// once; this event keeps them all in sync when one of them is clicked.
const THEME_CHANGE_EVENT = "availo-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, callback);
}

function getIsDark() {
  return document.documentElement.classList.contains("dark");
}

// The no-FOUC inline script in the root layout may have already added the
// "dark" class before hydration runs; assuming light here just means the
// icon corrects itself in the same tick React reconciles the real snapshot.
function getServerIsDark() {
  return false;
}

const VARIANT_CLASSES = {
  // For the always-dark-navy header/nav bars used across the app.
  header: "text-slate-300 hover:text-white hover:bg-slate-700",
  // For light-card contexts (e.g. the admin login card) that also need to work in dark mode.
  surface:
    "text-gray-400 hover:text-slate-700 hover:bg-gray-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800",
};

export function ThemeToggle({
  variant = "header",
  className = "",
}: {
  variant?: keyof typeof VARIANT_CLASSES;
  className?: string;
}) {
  const isDark = useSyncExternalStore(subscribe, getIsDark, getServerIsDark);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`p-2 -m-2 rounded-lg transition-colors ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {isDark ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-[18px] h-[18px]"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-[18px] h-[18px]"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
