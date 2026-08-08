"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export function AdminNav() {
  const pathname = usePathname();

  function navItem(href: string, label: string) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`text-sm px-3 py-2 rounded transition-colors ${
          active
            ? "bg-slate-700 text-white"
            : "text-slate-300 hover:text-white hover:bg-slate-700"
        }`}
      >
        {label}
      </Link>
    );
  }

  return (
    <nav className="bg-slate-800 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href="/admin/dashboard"
          className="font-bold text-amber-400 text-lg tracking-tight flex-none"
        >
          ✂ Availo
        </Link>
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {navItem("/admin/dashboard", "Dashboard")}
          {navItem("/admin/slots/new", "Add Slots")}
          {navItem("/admin/services", "Services")}
          {navItem("/admin/settings", "Settings")}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="text-sm text-slate-400 hover:text-white transition-colors flex-none px-2 py-2"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
