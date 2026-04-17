"use client";

import React from "react";

/**
 * ResourceIdCell — Standardizes prefixed ID display (e.g., #TENANT-000001).
 * 
 * @param {string|number} id - The raw ID.
 * @param {string} prefix - The prefix (e.g. "TENANT", "TX", "RM").
 * @param {number} [length] - Padding length (default 6).
 */
export default function ResourceIdCell({ id, prefix, length = 6 }) {
  if (!id) return <span className="text-stone-300">—</span>;
  
  const formattedId = String(id).padStart(length, '0');
  
  return (
    <span className="font-mono text-[10px] font-black tracking-widest text-stone-400 tabular-nums uppercase">
      #{prefix}-{formattedId}
    </span>
  );
}
