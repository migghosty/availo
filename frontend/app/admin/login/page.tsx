import { ThemeToggle } from "@/components/ThemeToggle";
import { getBusinessName } from "@/lib/settingsData";
import { LoginForm } from "./LoginForm";

// Per request, so a renamed business shows up on the next visit rather than
// on the next deploy — the same reason the settings page is dynamic.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // The same name the installed app and the public header carry, so the admin
  // signs into something that looks like their own business.
  const businessName = await getBusinessName();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md p-8 w-full max-w-sm relative">
        <ThemeToggle variant="surface" className="absolute top-4 right-4" />

        <div className="text-center mb-7">
          <span className="text-5xl" aria-hidden>✂</span>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-2 tracking-tight">
            {businessName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Sign in to manage your schedule
          </p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
