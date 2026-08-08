"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/slots/new", label: "Add Slots" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="bg-slate-800 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          <Link
            href="/admin/dashboard"
            className="font-bold text-amber-400 text-lg tracking-tight"
          >
            ✂ Availo
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="text-sm text-slate-400 hover:text-white transition-colors px-2 py-2 -mr-2"
          >
            Sign out
          </button>
        </div>

        {/* Nav links: even grid on phones so nothing gets cut off, inline pills from sm: up */}
        <div className="grid grid-cols-4 gap-1 pb-2 sm:flex sm:gap-1 sm:pb-3 sm:-mt-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-center sm:text-left text-xs sm:text-sm whitespace-nowrap px-1 sm:px-3 py-2 rounded transition-colors ${
                isActive(item.href)
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-700"
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
