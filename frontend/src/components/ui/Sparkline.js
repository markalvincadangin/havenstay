"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * Sparkline - A micro-trend visualization for KPI cards.
 * @param {number[]} data - Array of relative numbers (0-100) or absolute values.
 * @param {string} color - CSS color for the line (e.g. "stroke-teal-500").
 */
export function Sparkline({ data = [20, 40, 35, 50, 45, 70, 65, 80], color = "stroke-teal-500", height = 40, width = 120 }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((val, i) => {
    const x = i * stepX;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="relative" style={{ height, width }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        aria-hidden="true"
      >
        <motion.polyline
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={color}
          points={points}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        {/* Subtle shadow glow */}
        <polyline
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${color} opacity-10 blur-sm`}
          points={points}
        />
      </svg>
    </div>
  );
}
