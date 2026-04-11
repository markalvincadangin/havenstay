export function formatDateString(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateRange(fromDateStr, toDateStr) {
  if (!fromDateStr || !toDateStr) return "-";
  const fromDate = new Date(fromDateStr);
  const toDate = new Date(toDateStr);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return "-";
  
  const fromFormatted = fromDate.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const toFormatted = toDate.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  
  return `${fromFormatted} – ${toFormatted}`;
}

export function formatPHP(amount) {
  if (amount == null || amount === undefined) return "—";
  const num = Number(amount);
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatReportTimestamp() {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

export function matchesPath(current, target) {
  if (!current || !target) return false;
  if (target === "/dashboard") return current === "/dashboard";
  return current.startsWith(target);
}
