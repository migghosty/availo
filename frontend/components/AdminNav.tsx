"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/history", label: "History" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="bg-black text-white shadow-glow-bar">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          <Link
            href="/admin/dashboard"
            className="font-bold text-blue-400 drop-shadow-[0_0_8px_rgb(59_130_246/0.8)] text-lg tracking-tight"
          >
            ✂ Availo
          </Link>
          <div className="flex items-center gap-1 -mr-2">
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="text-sm text-slate-400 hover:text-white transition-colors px-2 py-2"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Nav links: even grid on phones so nothing gets cut off, inline pills from sm: up */}
        <div className="grid grid-cols-5 gap-1 pb-2 sm:flex sm:gap-1 sm:pb-3 sm:-mt-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-center sm:text-left text-xs sm:text-sm whitespace-nowrap px-1 sm:px-3 py-2 rounded transition-colors ${
                isActive(item.href)
                  ? "bg-blue-500/15 text-white ring-1 ring-inset ring-blue-500/40"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
