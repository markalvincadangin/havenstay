"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest, setAuthToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

/**
 * OAuthCallbackPage
 *
 * Handles the secure token exchange after external identity verification.
 * Aligned with HavenStay Identity (SRS v5.2): Professional, Efficient, and User-Friendly.
 */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const errorParam = searchParams.get("error");

    if (!token && !errorParam) {
      // Direct access bypass: redirect to login immediately
      router.replace("/login");
      return;
    }

    if (errorParam === 'account_deactivated') {
      setError("This account has been deactivated. Please contact your system administrator to restore access.");
      return;
    }

    if (errorParam === 'account_not_found') {
      setError("This Google account is not registered with HavenStay. Please contact an administrator to request access.");
      return;
    }

    if (errorParam) {
      setError("Authentication could not be completed. Please try again or contact support.");
      return;
    }

    if (!token) {
      setError("Authentication token missing or invalid.");
      return;
    }

    async function initializeSession() {
      try {
        setAuthToken(token);
        const response = await apiRequest("/api/auth/me");

        if (response) {
          login(response);
          // Small delay for UX transition, using replace to clear token from history
          setTimeout(() => router.replace("/dashboard"), 800);
        } else {
          setError("We were unable to initialize your session. Please try again.");
        }
      } catch (err) {
        console.error("Session Initialization Error:", err);
        setError("A connection error occurred while establishing your session.");
      }
    }

    initializeSession();
  }, [searchParams, router, login]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#fafaf9]">
      {/* Subtle Background Aesthetic */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.05),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(20,184,166,0.03),transparent_50%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Brand Header */}
        <div className="mb-12 flex flex-col items-center gap-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl shadow-teal-900/5 border border-stone-100"
          >
            <Image src="/brand/logo-dark.svg" alt="HavenStay" width={36} height={36} />
          </motion.div>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xs font-black uppercase tracking-[0.4em] text-stone-400"
          >
            HavenStay
          </motion.span>
        </div>

        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="overflow-hidden rounded-[2.5rem] bg-white p-12 text-center shadow-[0_48px_80px_-16px_rgba(0,0,0,0.06)] border border-stone-100/50"
        >
          {error ? (
            <div className="space-y-8">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-black text-stone-900 tracking-tight">Access Restricted</h2>
                <p className="text-sm text-stone-500 leading-relaxed font-medium">
                  {error}
                </p>
              </div>
              <button
                onClick={() => router.push("/login")}
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-stone-900 !h-14 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-stone-800 active:scale-[0.98]"
              >
                <span className="relative z-10">Return to Login</span>
                <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
            </div>
          ) : (
            <div className="space-y-10">
              <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
                <div className="absolute inset-0 animate-[ping_3s_infinite] rounded-full bg-teal-100 opacity-20"></div>
                <div className="absolute inset-2 animate-[pulse_2s_infinite] rounded-full bg-teal-50 opacity-40"></div>
                <div className="relative flex h-full w-full items-center justify-center rounded-full bg-white text-teal-600 shadow-inner">
                  <Loader2 className="h-10 w-10 animate-spin stroke-[2.5px]" />
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-black text-stone-900 tracking-tight">Authenticating</h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-teal-600/60">
                  Preparing your secure session...
                </p>
              </div>

              <div className="flex justify-center gap-1.5">
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500/40"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-300">
            HavenStay Management System · v5.0
          </p>
        </motion.div>
      </div>
    </main>
  );
}
