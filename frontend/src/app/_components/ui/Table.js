import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function Table({
  columns,
  rows,
  emptyTitle = "No records found.",
  emptyDescription = "Adjust filters or add a new record.",
  caption,
  ariaLabel,
  /** When true, omit outer border/radius/shadow — use inside a registry card body (`p-0`, MASTER.md Section 5.1). */
  embedded = false,
  /** Optional client-side sort: column `sortKey` (or `key`) must match parent state. */
  sortColumn = null,
  sortDirection = "asc",
  onSortChange,
}) {
  const shouldReduceMotion = useReducedMotion();

  const shellClass = embedded
    ? "min-w-0 overflow-x-auto relative scroll-smooth scrollbar-hide"
    : "overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm relative scroll-smooth scrollbar-hide";

  const tbodyVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { 
        staggerChildren: shouldReduceMotion ? 0 : 0.04 
      }
    }
  };

  const trVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } }
  };
  return (
    <div className={shellClass}>
      <table className="min-w-full text-left text-sm" aria-label={ariaLabel || caption}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="border-b border-stone-100 bg-stone-50/50">
          <tr>
            {columns.map((col) => {
              const sk = col.sortKey ?? col.key;
              const active = sortColumn != null && sk === sortColumn;
              const sortable = Boolean(col.sortable && typeof onSortChange === "function");

              return (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    "px-6 py-2.5 text-[9px] font-black tracking-[0.15em] text-stone-400 uppercase border-b border-stone-100",
                    col.className?.includes("text-right") ? "text-right" : 
                    col.className?.includes("text-center") ? "text-center" : "text-left",
                    col.headerClassName,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-sort={
                    sortable
                      ? active
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                >
                  {sortable ? (
                    <button
                      type="button"
                      className={[
                        "max-w-full items-center gap-1.5 rounded-md py-0.5 font-inherit tracking-widest text-stone-400 transition-colors hover:text-stone-700",
                        col.className?.includes("text-right") ? "flex w-full justify-end" : 
                        col.className?.includes("text-center") ? "flex w-full justify-center" : "inline-flex",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => onSortChange(sk)}
                    >
                      <span>{col.label}</span>
                      <span className="inline-flex shrink-0 text-stone-400" aria-hidden>
                        {active ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="size-3.5" strokeWidth={2.5} />
                          ) : (
                            <ArrowDown className="size-3.5" strokeWidth={2.5} />
                          )
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-45" strokeWidth={2.5} />
                        )}
                      </span>
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <motion.tbody initial="hidden" animate="visible" variants={tbodyVariants}>
          {rows.length > 0 ? (
            React.Children.map(rows, (child) => {
              if (React.isValidElement(child)) {
                const { children, ...otherProps } = child.props;
                return (
                  <motion.tr {...otherProps} key={child.key} variants={trVariants}>
                    {children}
                  </motion.tr>
                );
              }
              return child;
            })
          ) : (
            <motion.tr variants={trVariants}>
              <td colSpan={columns.length} className="px-6 py-20 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-stone-100 bg-stone-50 text-stone-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <p className="text-sm font-bold text-stone-900 leading-none">{emptyTitle}</p>
                <p className="mt-2 text-xs font-medium text-stone-500 leading-relaxed max-w-xs mx-auto">{emptyDescription}</p>
              </td>
            </motion.tr>
          )}
        </motion.tbody>
      </table>
    </div>
  );
}


