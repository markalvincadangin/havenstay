"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { apiRequest, hasAuthToken, setAuthToken } from "../../lib/api";
import { flattenApiErrors } from "../../lib/errors";
import Alert from "../_components/ui/Alert";
import Button from "../_components/ui/Button";
import { Card } from "../_components/ui/Card";
import { Field, Input } from "../_components/ui/Fields";
import { useAuth } from "../_context/AuthContext";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading: authLoading } = useAuth();
  const [apiError, setApiError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Only skip the form when we already have a validated session (not merely a stale token).
  useEffect(() => {
    if (!authLoading && user && hasAuthToken()) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, router]);

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
      const payload = response;

      if (payload?.token) {
        setAuthToken(payload.token);
      }

      if (payload?.user) {
        login(payload.user);
      }

      router.push("/dashboard");
    } catch (error) {
      setApiError(flattenApiErrors(error));
    }
  };

  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.98, y: shouldReduceMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
        when: "beforeChildren",
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-background)] px-4 py-10 sm:px-6 sm:py-12">
      <motion.div
        className="w-full max-w-[440px]"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <Card className="relative w-full overflow-hidden !p-0 rounded-2xl border-stone-200 shadow-xl">
          {/* Top accent bar with brand primary color (MASTER §2.2) */}
          <div className="h-1.5 w-full bg-teal-600" aria-hidden />

          <div className="px-8 pb-10 pt-10 sm:px-12 sm:pb-12 sm:pt-12">
            <motion.div variants={itemVariants} className="mb-10 flex flex-col items-center text-center">
              <div className="relative mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-50 shadow-sm ring-1 ring-stone-100">
                <Image src="/brand/logo-dark.svg" alt="HavenStay" width={32} height={32} priority />
              </div>

              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">HavenStay · BHMS</p>
              <h1 className="hs-page-title mt-2">System Authentication</h1>
              <p className="hs-page-subtitle mt-2 max-w-sm text-sm font-medium leading-relaxed text-stone-500">
                Sign in to manage boarding house operations, tenants, and billing cycles.
              </p>
            </motion.div>

            <motion.form variants={itemVariants} className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-5">
                <Field label="Username or Email" required error={errors.username?.message}>
                  <Input
                    autoFocus
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your username or email"
                    className="!h-11 border-stone-200 sm:!h-12"
                    hasError={Boolean(errors.username)}
                    {...register("username", {
                      required: "Username or email is required.",
                      minLength: { value: 3, message: "Must be at least 3 characters." },
                    })}
                  />
                </Field>

                <Field label="Password" required error={errors.password?.message}>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      hasError={Boolean(errors.password)}
                      placeholder="Enter your password"
                      className="!h-11 border-stone-200 pr-12 sm:!h-12"
                      {...register("password", {
                        required: "Password is required.",
                      })}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-3 flex h-11 w-11 items-center justify-center text-stone-400 transition-colors hover:text-stone-700 sm:h-12 sm:w-12"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff size={18} strokeWidth={2} aria-hidden />
                      ) : (
                        <Eye size={18} strokeWidth={2} aria-hidden />
                      )}
                    </button>
                  </div>
                </Field>
              </div>

              {apiError ? (
                <Alert variant="error" title="Authentication Failed">
                  <p className="text-xs leading-relaxed">{apiError}</p>
                </Alert>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={isSubmitting}
                className="w-full !h-11 rounded-xl bg-teal-600 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg shadow-teal-900/10 hover:bg-teal-700 active:scale-[0.98] sm:!h-12"
              >
                Login
              </Button>
            </motion.form>
          </div>
        </Card>
      </motion.div>
    </main>
  );
}
