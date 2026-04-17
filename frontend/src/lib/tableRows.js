export const interactiveTableRowClass =
  "group cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50 active:bg-stone-100";

export function stopRowClick(event) {
  event.stopPropagation();
}
