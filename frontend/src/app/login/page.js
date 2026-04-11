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
import { Eye, EyeOff, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (hasAuthToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

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

      if (response?.token) {
        setAuthToken(response.token);
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
          <div className="h-1.5 w-full bg-[var(--color-primary)]" aria-hidden />

          <div className="px-8 pb-10 pt-9 sm:px-10 sm:pb-11 sm:pt-10">
            <motion.div variants={itemVariants} className="mb-8 flex flex-col items-center text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-stone-100 bg-stone-50 shadow-sm">
                <Image src="/brand/logo-dark.svg" alt="" width={32} height={32} priority />
              </div>
              <p className="text-xs font-bold uppercase tracking-wide text-stone-400 [word-spacing:0.1em]">HavenStay</p>
              <h1 className="hs-page-title mt-2">Welcome back</h1>
              <p className="hs-page-subtitle mt-2 max-w-sm text-sm font-medium leading-relaxed text-stone-500">
                Sign in to manage rooms, Tenants, and billing.
              </p>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-stone-400 [word-spacing:0.1em]">
                Boarding house management
              </p>
            </motion.div>

            <motion.form variants={itemVariants} className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-5">
                <Field label="Username" required error={errors.username?.message}>
                  <Input
                    autoFocus
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. staff or admin"
                    className="!h-11 border-stone-200 sm:!h-12"
                    hasError={Boolean(errors.username)}
                    {...register("username", {
                      required: "Enter your username.",
                      minLength: { value: 3, message: "Username must be at least 3 characters." },
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
                        required: "Enter your password.",
                        minLength: { value: 5, message: "Password must be at least 5 characters." },
                      })}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-3 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
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
                <Alert variant="error" title="Sign-in failed">
                  <p className="leading-relaxed">{apiError}</p>
                  <p className="mt-2 text-xs font-medium text-rose-900/80">
                    Check your username and password, then try again.
                  </p>
                </Alert>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={isSubmitting}
                className="w-full !h-11 rounded-xl bg-teal-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-teal-900/10 hover:bg-teal-700 sm:!h-12"
              >
                Sign in
              </Button>

              <motion.div
                variants={itemVariants}
                className="flex items-start justify-center gap-2 border-t border-stone-100 pt-6 text-center"
              >
                <Lock className="mt-0.5 size-3.5 shrink-0 text-stone-400" aria-hidden />
                <p className="text-left text-[11px] leading-relaxed text-stone-500">
                  Staff and administrators only. Sessions are role-based; sign-ins are recorded for audit.
                </p>
              </motion.div>
            </motion.form>
          </div>
        </Card>
      </motion.div>
    </main>
  );
}
