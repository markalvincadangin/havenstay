export function AppMain({ children }) {
  return (
    <main className="min-h-screen bg-[var(--color-background)] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">{children}</div>
    </main>
  );
}
