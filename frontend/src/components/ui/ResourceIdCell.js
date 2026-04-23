"use client";

import React from "react";
import { ID_PREFIX_MAP } from "@/lib/constants";

/**
 * ResourceIdCell — Standardizes prefixed ID display.
 * 
 * @param {string|number} id - The raw ID.
 * @param {keyof typeof ID_PREFIX_MAP} [type] - Entity type to lookup prefix.
 * @param {string} [prefix] - Manual prefix override (legacy).
 * @param {number} [length] - Padding length (default 6).
 */
export default function ResourceIdCell({ id, type, prefix: manualPrefix, length = 6 }) {
  if (!id) return <span className="text-stone-300">—</span>;
  
  const prefix = type ? ID_PREFIX_MAP[type] : manualPrefix;
  const formattedId = String(id).padStart(length, '0');
  
  return (
    <span className="font-mono text-[10px] font-black tracking-widest text-stone-400 tabular-nums uppercase">
      #{prefix}-{formattedId}
    </span>
  );
}
