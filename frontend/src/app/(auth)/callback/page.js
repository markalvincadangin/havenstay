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

    if (!token) {
      setError("Authorization token missing.");
      return;
    }

    async function initializeSession() {
      try {
        setAuthToken(token);
        const response = await apiRequest("/api/auth/me");
        
        if (response) {
          login(response);
          // Small delay for UX transition
          setTimeout(() => router.push("/dashboard"), 800);
        } else {
          setError("Failed to retrieve user profile.");
        }
      } catch (err) {
        console.error("Session Initialization Error:", err);
        setError(err.message || "An error occurred while establishing your session.");
      }
    }

    initializeSession();
  }, [searchParams, router, login]);

  return (
    <main className="flex min-h-screen bg-white">
      {/* LEFT SECTION: BRANDING (Matches Login Page) */}
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-teal-900 p-16 lg:flex">
        <div className="absolute inset-0 z-0 scale-105 transform">
          <Image
            src="/brand/login-hero.png"
            alt="HavenStay Management"
            fill
            className="object-cover opacity-20 mix-blend-overlay grayscale-[30%]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-teal-950/90 via-teal-900/60 to-transparent" />
        </div>

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-xl">
              <Image src="/brand/logo-dark.svg" alt="HavenStay" width={28} height={28} />
            </div>
            <span className="text-xl font-black uppercase tracking-[0.3em] text-white">HavenStay</span>
          </div>
        </motion.div>

        <div className="relative z-10">
          <h1 className="text-5xl font-black leading-tight text-white xl:text-6xl">
            Identity <br />
            <span className="text-teal-400">Verified.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-teal-100/80">
            Establishing a secure handshake with your authenticated provider.
          </p>
        </div>

        <div className="relative z-10 flex gap-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-400">Encryption</p>
            <p className="mt-1 text-sm font-medium text-white">AES-256 Bit</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-400">Protocol</p>
            <p className="mt-1 text-sm font-medium text-white">OAuth 2.0</p>
          </div>
        </div>
      </section>

      {/* RIGHT SECTION: HANDSHAKE STATE */}
      <section className="flex w-full flex-col items-center justify-center p-8 lg:w-1/2 lg:p-24">
        <div className="w-full max-w-sm space-y-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl bg-[#fcfcfc] p-12 text-center shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] border border-stone-100"
          >
            {error ? (
              <div className="space-y-6">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-stone-900 tracking-tight">Verification Failed</h2>
                  <p className="text-sm text-stone-500 leading-relaxed">{error}</p>
                </div>
                <button
                  onClick={() => router.push("/login")}
                  className="w-full !h-14 rounded-2xl bg-stone-900 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl hover:bg-stone-800 transition-all active:scale-95"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="relative mx-auto h-24 w-24">
                   <div className="absolute inset-0 animate-ping rounded-full bg-teal-100 opacity-20"></div>
                   <div className="relative flex h-full w-full items-center justify-center rounded-full bg-teal-50 text-teal-600">
                     <Loader2 className="h-10 w-10 animate-spin" />
                   </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-stone-900 tracking-tight">Finalizing Session</h2>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">
                    Establishing Secure Handshake...
                  </p>
                </div>
                <div className="flex justify-center gap-2">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600" style={{ animationDelay: '0ms' }}></div>
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600" style={{ animationDelay: '150ms' }}></div>
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </motion.div>

          <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
            HavenStay BHMS - Forensic Identity Suite
          </p>
        </div>
      </section>
    </main>
  );
}
