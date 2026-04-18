"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "./_components/ui/Card";
import Button from "./_components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface-base)]">
      <header className="flex h-16 shrink-0 items-center border-b border-[var(--neutral-200)] bg-white px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-[var(--neutral-900)] hover:opacity-80">
          <Image src="/logo.svg" alt="HavenStay" width={28} height={28} />
          HavenStay
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-50)] text-3xl font-bold text-[var(--primary-600)]">
              404
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-[var(--neutral-900)]">Page Not Found</h1>
          <p className="mb-8 text-sm text-[var(--neutral-600)]">
            We couldn&apos;t find the page you&apos;re looking for. It may have been moved, deleted, or you might have mistyped the URL.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="#" onClick={(e) => { e.preventDefault(); window.history.back(); }}>
                Go Back
              </Link>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
