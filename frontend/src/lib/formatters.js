export function formatDateString(dateStr) {
  if (!dateStr) return "-";
  
  // Normalize naked timestamps to UTC for correct local interpretation.
  const normalized = typeof dateStr === 'string' && dateStr.includes(' ') && !dateStr.includes('T') && !dateStr.includes('Z')
    ? dateStr.replace(' ', 'T') + 'Z'
    : dateStr;

  const date = new Date(normalized);
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

/**
 * Directory / registry style: "Last, First" (family name first, then given).
 * Matches table sort order (last name, then first) without string-concat bugs.
 */
export function formatTenantDirectoryName(tenant) {
  if (!tenant) return "—";
  const first = String(tenant.first_name ?? "").trim();
  const last = String(tenant.last_name ?? "").trim();
  if (last && first) return `${last}, ${first}`;
  if (last) return last;
  if (first) return first;
  return "—";
}

/**
 * Common style: "First Last" (given name first).
 * Used in summaries, banners, and personalized greetings.
 */
export function formatTenantFullName(tenant) {
  if (!tenant) return "—";
  const first = String(tenant.first_name ?? "").trim();
  const last = String(tenant.last_name ?? "").trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  return "—";
}

/** Two-letter initials for avatars (first + last char when both exist). */
export function getTenantInitials(tenant) {
  if (!tenant) return "?";
  const f = String(tenant.first_name ?? "").trim();
  const l = String(tenant.last_name ?? "").trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  const single = f || l;
  if (single.length >= 2) return single.slice(0, 2).toUpperCase();
  return single.toUpperCase() || "?";
}

/** Sort key: last name, then first (do not concatenate for sort). */
export function compareTenantDirectoryName(a, b) {
  const ln = (t) => String(t?.last_name ?? "").trim();
  const fn = (t) => String(t?.first_name ?? "").trim();
  const last = ln(a).localeCompare(ln(b), undefined, { sensitivity: "base", numeric: true });
  if (last !== 0) return last;
  return fn(a).localeCompare(fn(b), undefined, { sensitivity: "base", numeric: true });
}

export function formatTimestamp(ts) {
  if (!ts) return "—";
  
  // Normalize naked timestamps to UTC for correct local interpretation.
  const normalized = typeof ts === 'string' && ts.includes(' ') && !ts.includes('T') && !ts.includes('Z')
    ? ts.replace(' ', 'T') + 'Z'
    : ts;

  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/**
 * Normalise a date to the very beginning of the day (00:00:00.000).
 * Critical for date comparison logic (e.g. isPastDue).
 */
export function startOfDay(d) {
  if (!d) return null;
  const x = new Date(d);
  if (isNaN(x.getTime())) return null;
  x.setHours(0, 0, 0, 0);
  return x;
}

export function safeParseJson(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Returns the RFC3339 date range for the current month start to today.
 * Standardizes MTD (Month-to-Date) reporting filters.
 */
export function getCurrentMonthRange() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const start = `${year}-${month}-01`;
  const end = d.toISOString().slice(0, 10);
  return { start, end };
}

/**
 * Returns today's date in YYYY-MM-DD format (ISO 8601).
 * Standardizes daily filter parameters.
 */
export function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parse user-entered money for PHP peso amounts.
 * Strips commas, trims, and rounds to centavos.
 */
export function parseMoneyInput(value) {
  if (value === "" || value == null) return NaN;
  const normalized = String(value).trim().replace(/,/g, "");
  const n = Number(normalized);
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * 100) / 100;
}

/** Stop event propagation (useful for table row clicks). */
export function stopRowClick(event) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
}

/**
 * Format PII (Phone/Email) for non-administrative roles.
 */
export function formatPII(value, type = "phone", isAuthorized = true) {
  if (!value) return "—";
  if (isAuthorized) return value;

  const str = String(value).trim();

  if (type === "phone") {
    // Basic redaction: 0917****123
    if (str.length < 8) return "***";
    return str.replace(/^(\d{4})\d+(\d{3,4})$/, "$1****$2");
  }

  if (type === "email") {
    // Redaction: j***@example.com
    const parts = str.split("@");
    if (parts.length !== 2) return "***";
    const [user, domain] = parts;
    return `${user.charAt(0)}***@${domain}`;
  }

  return "***";
}
