"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { apiRequest, hasAuthToken, setAuthToken } from "@/lib/api";
import { flattenApiErrors } from "@/lib/errors";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Fields";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Lock, User as UserIcon, LayoutDashboard, History, ClipboardCheck } from "lucide-react";

/**
 * LoginPage — Professional Management Portal
 * Aligned with HavenStay Identity (SRS v5.2): Professional, Efficient, and User-Friendly.
 */
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const { login, user, loading: authLoading } = useAuth();
  const [apiError, setApiError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && user && hasAuthToken()) {
      router.replace(callbackUrl || "/dashboard");
    }
  }, [authLoading, user, router, callbackUrl]);

  // Handle OAuth and external errors from URL parameters
  useEffect(() => {
    const errorType = searchParams.get("error");
    if (errorType === "oauth_failed") {
      setApiError("Google authentication failed. Please check your credentials or try again.");
    } else if (errorType === "access_denied") {
      setApiError("Access denied. You cancelled the authentication request.");
    } else if (errorType === "account_not_found") {
      setApiError("This Google account is not registered in our system. Please contact an administrator to request access.");
    } else if (errorType === "account_deactivated") {
      setApiError("This account has been deactivated. Please contact an administrator for assistance.");
    }
  }, [searchParams]);

  useEffect(() => {
    const warmServer = async () => {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api/ping`, { mode: 'no-cors' });
      } catch (e) { /* silent catch */ }
    };
    warmServer();
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (values) => {
    setApiError("");
    try {
      const response = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: values.username,
          password: values.password,
        }),
      });
      if (response?.token) setAuthToken(response.token);
      if (response?.user) login(response.user);
      router.push(callbackUrl || "/dashboard");
    } catch (error) {
      setApiError(flattenApiErrors(error));
    }
  };

  const shouldReduceMotion = useReducedMotion();

  return (
    <main className="flex min-h-screen bg-white">
      {/* LEFT SECTION: BRANDING & VALUE PROPS (Professional & Inviting) */}
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

          <div className="mt-24 max-w-lg">
            <h1 className="text-5xl font-black leading-[1.1] tracking-tight text-white xl:text-6xl">
              Smarter <span className="text-teal-400">Boarding</span> Operations.
            </h1>
            <p className="mt-6 text-lg font-medium leading-relaxed text-teal-100/70">
              The professional choice for modern residential management.
              Efficiency, accuracy, and ease of use in one centralized platform.
            </p>
          </div>
        </motion.div>

        <motion.div
          className="relative z-10 grid grid-cols-2 gap-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        >
          <div className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-800/50 backdrop-blur-sm">
              <LayoutDashboard className="text-teal-400" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">Unified Control</h3>
              <p className="mt-1 text-xs leading-relaxed text-teal-100/50">Manage rooms, tenants, and billing from a single dashboard.</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-800/50 backdrop-blur-sm">
              <History className="text-teal-400" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">Full Transparency</h3>
              <p className="mt-1 text-xs leading-relaxed text-teal-100/50">Traceable histories and comprehensive financial audit trails.</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* RIGHT SECTION: LOGIN PORTAL (Friendly & Efficient) */}
      <section className="relative flex w-full flex-col items-center justify-center bg-stone-50 px-6 py-12 lg:w-1/2">
        <motion.div
          className="relative z-10 w-full max-w-[440px]"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className="hs-glass-effect !p-0 overflow-hidden rounded-[2.5rem] border-white/60 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] transition-all hover:shadow-[0_48px_80px_-24px_rgba(0,0,0,0.1)]">
            {/* Mobile Header */}
            <div className="flex flex-col items-center px-8 pt-12 text-center sm:px-12">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-stone-100 lg:hidden">
                <Image src="/brand/logo-dark.svg" alt="HavenStay" width={38} height={38} />
              </div>

              <p className="hs-strip-title !text-[9px] !text-stone-400">Management Portal</p>
              <h2 className="hs-page-title mt-2 !text-3xl">Welcome Back</h2>
              <p className="hs-page-subtitle mt-3 text-[13px] font-medium leading-relaxed text-stone-500/80">
                Sign in to your staff or admin account to get started.
              </p>
            </div>

            <div className="px-8 pb-12 pt-10 sm:px-12">
              <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="space-y-5">
                  <Field label="Username or Email" required error={errors.username?.message}>
                    <Input
                      autoFocus
                      type="text"
                      icon={UserIcon}
                      autoComplete="username"
                      placeholder="e.g. admin@havenstay.com"
                      className="!h-12 border-stone-200/60 !rounded-xl bg-white/40 focus:bg-white transition-all"
                      hasError={Boolean(errors.username)}
                      {...register("username", {
                        required: "Please enter your username or email.",
                      })}
                    />
                  </Field>

                  <Field label="Password" required error={errors.password?.message}>
                    <div className="relative group">
                      <Input
                        type={showPassword ? "text" : "password"}
                        icon={Lock}
                        autoComplete="current-password"
                        hasError={Boolean(errors.password)}
                        placeholder="Enter your password"
                        className="!h-12 border-stone-200/60 pr-12 !rounded-xl bg-white/40 focus:bg-white transition-all"
                        {...register("password", {
                          required: "Please enter your password.",
                        })}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-1 flex h-10 w-10 items-center justify-center self-center text-stone-400 transition-colors hover:text-teal-600 sm:h-12 sm:w-12"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff size={18} strokeWidth={2.5} aria-hidden />
                        ) : (
                          <Eye size={18} strokeWidth={2.5} aria-hidden />
                        )}
                      </button>
                    </div>
                  </Field>
                </div>

                {apiError && (
                  <Alert variant="error" title="Sign In Failed" className="rounded-xl border-red-100/50">
                    <p className="text-xs leading-relaxed">{apiError}</p>
                  </Alert>
                )}

                <div className="pt-2 flex flex-col gap-6">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    className="w-full !h-12 rounded-xl bg-teal-600 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_12px_24px_-4px_rgba(13,148,136,0.25)] hover:bg-teal-700 hover:shadow-[0_16px_32px_-4px_rgba(13,148,136,0.3)] hover:-translate-y-0.5 active:scale-[0.98] transition-all hs-pulse-glow"
                  >
                    {isSubmitting ? "Signing in..." : "Sign In"}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-stone-100"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                      <span className="bg-[#fcfcfc] px-4 text-stone-400">Or sign in with</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full !h-12 rounded-xl border-stone-200 bg-white text-[10px] font-bold uppercase tracking-[0.15em] text-stone-600 transition-all hover:bg-stone-50 hover:border-stone-300 active:scale-[0.98] shadow-sm flex items-center justify-center gap-3"
                    onClick={() => {
                      // Using relative path to leverage Next.js rewrites and avoid 'undefined' env var issues
                      window.location.href = "/api/auth/google/redirect";
                    }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    <span>Sign in with Google</span>
                  </Button>
                </div>
              </form>

              <div className="mt-10 flex flex-col items-center gap-4 text-center opacity-40">
                <div className="h-px w-8 bg-stone-200" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  HavenStay Management System · v5.0
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </section>
    </main>
  );
}
