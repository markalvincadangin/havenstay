"use client";

import React from "react";
import { getTenantInitials } from "@/lib/formatters";

/**
 * Avatar — variants per design-system/havenstay/MASTER.md.
 * Supports both tenant and user entity objects.
 * 
 * @param {object} [tenant] - Tenant entity.
 * @param {object} [user] - User entity.
 * @param {object} [entity] - Generic entity (backwards compatibility).
 * @param {"stone"|"teal"|"blue"} [variant="stone"]
 * @param {"sm"|"md"|"lg"|"xl"} [size="md"]
 */
export default function Avatar({ 
  tenant, 
  user, 
  entity, 
  variant = "stone",
  size = "md" 
}) {
  // Resolve entity priority
  const target = tenant || user || entity;
  const initials = getTenantInitials(target);
  
  const variants = {
    stone: "bg-stone-100 text-stone-500 ring-stone-200",
    teal: "bg-teal-50 text-teal-600 ring-teal-100",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
  };

  const sizes = {
    sm: "h-7 w-7 text-[9px]",
    md: "h-9 w-9 text-[10px]",
    lg: "h-12 w-12 text-sm",
    xl: "h-16 w-16 text-xl",
  };

  return (
    <div className={[
      "flex shrink-0 items-center justify-center rounded-xl font-black ring-1 uppercase tracking-tighter shadow-sm",
      variants[variant] || variants.stone,
      sizes[size] || sizes.md
    ].join(" ")}>
      {initials || "??"}
    </div>
  );
}
