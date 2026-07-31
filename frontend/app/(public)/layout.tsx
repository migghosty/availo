export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-slate-800 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2">
          <span className="text-amber-400 text-xl" aria-hidden>✂</span>
          <span className="font-bold text-lg tracking-tight">Availo</span>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        {children}
      </main>
    </div>
  );
}
