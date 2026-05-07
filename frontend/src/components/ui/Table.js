import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import EmptyState from "./EmptyState";

export function Table({
  columns,
  rows,
  emptyTitle = "No records found.",
  emptyDescription = "Adjust filters or add a new record.",
  caption,
  ariaLabel,
  /** When true, omit outer border/radius/shadow — use inside a registry card body. */
  embedded = false,
  /** Sticky header with backdrop blur. */
  stickyHeader = false,
  /** Reduces vertical padding for high-density registries. */
  dense = false,
  /** Optional client-side sort: column `sortKey` (or `key`) must match parent state. */
  sortColumn = null,
  sortDirection = "asc",
  onSortChange,
  /** ID of the row to briefly highlight/flash for context preservation. */
  highlightedRowId = null,
}) {
  const shouldReduceMotion = useReducedMotion();

  const shellClass = [
    "relative scroll-smooth scrollbar-hide w-full",
    embedded ? "min-w-0 overflow-x-auto" : "overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm"
  ].join(" ");

  const tbodyVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        // Faster stagger for a snappier feel. 
        // Disable stagger if there are too many rows (>25) or if it's just a data update.
        staggerChildren: (shouldReduceMotion || rows.length > 25) ? 0 : 0.01
      }
    }
  };

  const trVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 4 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.15, ease: "easeOut" } }
  };

  const headerRowClass = [
    "border-b border-stone-100",
    stickyHeader ? "sticky top-0 z-10 bg-stone-50/90 backdrop-blur-md" : "bg-stone-50/50"
  ].join(" ");

  const thPadding = dense ? "py-1.5" : "py-2.5";

  return (
    <div className={shellClass}>
      <table className="min-w-full text-left text-sm" aria-label={ariaLabel || caption}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className={headerRowClass}>
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
                    "px-6 text-[10px] font-black tracking-widest text-stone-400 uppercase",
                    thPadding,
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
        <motion.tbody
          initial="hidden"
          animate="visible"
          variants={tbodyVariants}
        >
          {rows.length > 0 ? (
            React.Children.map(rows, (child, index) => {
              if (React.isValidElement(child)) {
                // Destructure custom props that shouldn't reach the DOM
                const {
                  children,
                  className: childClass,
                  expandableContent: _expandableContent,
                  defaultExpanded: _defaultExpanded,
                  colSpan: _colSpan,
                  asChild = false,
                  ...otherProps
                } = child.props;

                // If it's an ExpandableTableRow or marked as a custom component, 
                // we render it directly to preserve its internal logic.
                if (_expandableContent || asChild) {
                  return child;
                }

                const isHighlighted = highlightedRowId != null && String(child.key || index).includes(String(highlightedRowId));

                const finalRowClass = [
                  childClass,
                  dense ? "hs-table-row-dense" : "",
                  isHighlighted ? "bg-teal-50 transition-colors duration-1000" : ""
                ].filter(Boolean).join(" ");

                // Use existing key if available
                const rowKey = child.key ?? `hs-row-${index}`;

                return (
                  <motion.tr
                    key={rowKey}
                    {...otherProps}
                    className={finalRowClass}
                    variants={trVariants}
                  >
                    {children}
                  </motion.tr>
                );
              }
              return child;
            })
          ) : (
            <motion.tr key="empty-state" variants={trVariants}>
              <td colSpan={columns.length} className="p-0">
                <EmptyState
                  title={emptyTitle}
                  description={emptyDescription}
                  className="border-0 shadow-none rounded-none py-20"
                />
              </td>
            </motion.tr>
          )}
        </motion.tbody>
      </table>
    </div>
  );
}


