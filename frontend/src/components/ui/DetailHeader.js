"use client";

import React from "react";
import ResourceIdCell from "./ResourceIdCell";
import { StatusBadge } from "./StatusBadge";
import Breadcrumbs from "./Breadcrumbs";

/**
 * DetailHeader — A premium, standardized header for entity detail pages ([id]).
 * Handles loading states, breadcrumbs, titles, and identity badges consistently.
 */
export default function DetailHeader({
  type, // 'tenant', 'room', 'contract', etc.
  id,
  title,
  subtitle,
  status,
  loading = false,
  loadingTitle = "Synchronizing data...",
  loadingSubtitle = "Connecting to the forensic registry...",
  listHref,
  listLabel,
  detailLabel = "Detail Profile",
}) {
  // 1. Loading State Implementation
  if (loading) {
    return {
      title: (
        <span className="animate-pulse text-stone-300">
          {loadingTitle}
        </span>
      ),
      subtitle: loadingSubtitle,
      breadcrumbs: (
        <Breadcrumbs
          items={[
            { label: listLabel, href: listHref },
            { label: "..." },
          ]}
        />
      ),
    };
  }

  // 2. Standardized Entity Identity (Title + ID + Status)
  const displayTitle = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="truncate">{title}</span>
      {id && <ResourceIdCell id={id} type={type} />}
      {status && (
        <div className="scale-90 origin-left">
          <StatusBadge size="sm">{status}</StatusBadge>
        </div>
      )}
    </div>
  );

  // 3. Standardized Breadcrumb Flow
  const displayBreadcrumbs = (
    <Breadcrumbs
      items={[
        { label: listLabel, href: listHref },
        { label: detailLabel },
      ]}
    />
  );

  return {
    title: displayTitle,
    subtitle: subtitle,
    breadcrumbs: displayBreadcrumbs,
  };
}
