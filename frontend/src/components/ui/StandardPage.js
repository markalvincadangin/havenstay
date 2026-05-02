"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { SkeletonListPage } from "@/components/ui/Skeleton";
import { AppMain } from "@/components/layout/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import UserRoleBadge from "@/components/ui/UserRoleBadge";

/**
 * StandardPage wrapper — centralizes page composition, auth guards, and skeletons.
 */
export default function StandardPage({
  title,
  subtitle,
  breadcrumbs,
  actions,
  loading = false,
  error = null,
  skeleton = <SkeletonListPage rows={10} />,
  children,
}) {
  const { authLoading, isUnauthorized, user } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();

  if (authLoading || (loading && !children)) {
    return skeleton;
  }

  if (isUnauthorized) {
    return null;
  }

  // Combine custom actions with the global user identity badge
  const headerActions = (
    <div className="flex items-center gap-4">
      {actions}
      <UserRoleBadge 
        username={user?.username} 
        roleName={user?.role?.role_name} 
      />
    </div>
  );

  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2, ease: "easeOut" },
  };

  const normalizedError =
    typeof error === "string"
      ? error
      : error && typeof error === "object"
        ? error.message || "Something went wrong. Please try again."
        : error;

  return (
    <AppMain>
      <motion.div
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
        className="space-y-6"
      >
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          actions={headerActions}
        />

        {normalizedError && (
          <Alert variant="error" title="An error occurred">
            {normalizedError}
          </Alert>
        )}

        {children}
      </motion.div>
    </AppMain>
  );
}
