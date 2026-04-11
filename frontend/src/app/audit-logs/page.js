"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ClipboardList, Search, X } from "lucide-react";
import { apiRequest } from "../../lib/api";
import { canManageUsers } from "../../lib/auth";
import { flattenApiErrors } from "../../lib/errors";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import Alert from "../_components/ui/Alert";
import { AppMain } from "../_components/ui/AppShell";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import Button from "../_components/ui/Button";
import { Card } from "../_components/ui/Card";
import { Field, Input, Select } from "../_components/ui/Fields";
import FilterChips from "../_components/ui/FilterChips";
import PageHeader from "../_components/ui/PageHeader";
import { SkeletonListPage } from "../_components/ui/Skeleton";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import { Table } from "../_components/ui/Table";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

/** Map raw action enum values to human-readable labels (matches `audit_logs.action` ENUM). */
const ACTION_LABELS = {
  create: "Create",
  update: "Update",
  status_change: "Status change",
  login: "Login",
  logout: "Logout",
  delete: "Delete",
  access_denied: "Access denied",
};

function formatActionLabel(action) {
  if (!action) return "—";
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Humanize technical database field names for the Audit Detail view. */
const FIELD_LABELS = {
  first_name: "First Name",
  last_name: "Last Name",
  contact_number: "Phone Number",
  status: "Status",
  role_id: "Role ID",
  is_active: "Active Status",
  monthly_rate: "Monthly Rate",
  expected_move_out_date: "Expected Move-out",
  due_date: "Due Date",
  bed_label: "Bed Label",
  room_code: "Room Code",
  deposit_amount: "Deposit",
};

/** Humanize technical database entity/table names for the UI. */
const ENTITY_LABELS = {
  tenants: "Tenants",
  rooms: "Rooms",
  contracts: "Contracts",
  billing: "Billing",
  payments: "Payments",
  users: "Users",
  bed_spaces: "Bed Spaces",
  billing_line_items: "Line Items",
  roles: "Roles",
};

function formatEntityLabel(entity) {
  return ENTITY_LABELS[entity] ?? entity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFieldLabel(field) {
  if (!field) return "—";
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAuditTimestamp(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function safeParseJson(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildDiffLines(oldValues, newValues, action) {
  const oldObj = safeParseJson(oldValues);
  const newObj = safeParseJson(newValues);

  // If both are missing and it's update/status_change, return empty
  if (!oldObj && !newObj) return [];

  // FOR CREATE: Show all new values
  if (action === "create" && newObj) {
    return Object.entries(newObj).map(([key, value]) => ({
      field: key,
      before: "—",
      after: value === null ? "null" : JSON.stringify(value),
    }));
  }

  // FOR DELETE: Show all old values
  if (action === "delete" && oldObj) {
    return Object.entries(oldObj).map(([key, value]) => ({
      field: key,
      before: value === null ? "null" : JSON.stringify(value),
      after: "—",
    }));
  }

  // FOR UPDATE/STATUS_CHANGE
  if (!oldObj || !newObj || typeof oldObj !== "object" || typeof newObj !== "object") return [];

  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const lines = [];
  for (const key of keys) {
    const before = oldObj[key];
    const after = newObj[key];
    const beforeStr = before === undefined || before === null ? (before === null ? "null" : "—") : JSON.stringify(before);
    const afterStr = after === undefined || after === null ? (after === null ? "null" : "—") : JSON.stringify(after);
    if (beforeStr !== afterStr) {
      lines.push({ field: key, before: beforeStr, after: afterStr });
    }
  }
  return lines;
}

/** Renders a styled badge for an audit action type */
function ActionBadge({ action }) {
  if (!action) return <span className="text-sm text-stone-500">—</span>;

  const label = formatActionLabel(action);

  const variantMap = {
    create: "border-emerald-200 bg-emerald-50 text-emerald-900",
    update: "border-teal-200 bg-teal-50 text-teal-900",
    status_change: "border-amber-200 bg-amber-50 text-amber-900",
    login: "border-stone-200 bg-stone-100 text-stone-700",
    logout: "border-stone-200 bg-stone-100 text-stone-700",
    delete: "border-rose-200 bg-rose-50 text-rose-900",
    access_denied: "border-rose-200 bg-rose-50 text-rose-900",
  };

  const classes = variantMap[action] ?? "border-stone-200 bg-stone-100 text-stone-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${classes}`}
    >
      {label}
    </span>
  );
}

export default function AuditLogsPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();

  const [logsReady, setLogsReady] = useState(false);
  const [apiError, setApiError] = useState("");
  const [logs, setLogs] = useState([]);

  const [entityType, setEntityType] = useState("all");
  const [actionType, setActionType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userQuery, setUserQuery] = useState("");

  const [selectedLog, setSelectedLog] = useState(null);
  const modalRef = useFocusTrap(!!selectedLog);

  const canAccess = useMemo(() => canManageUsers(currentUser), [currentUser]);
  const accessDenied = !authLoading && currentUser !== null && !canManageUsers(currentUser);

  const loadLogs = useCallback(async (filters) => {
    const params = new URLSearchParams();
    if (filters?.entityType && filters.entityType !== "all") params.set("entity_type", filters.entityType);
    if (filters?.actionType && filters.actionType !== "all") params.set("action", filters.actionType);
    if (filters?.dateFrom) params.set("from", filters.dateFrom);
    if (filters?.dateTo) params.set("to", filters.dateTo);
    if (filters?.userQuery) params.set("user", filters.userQuery);

    const qs = params.toString();
    const url = qs ? `/api/audit-logs?${qs}` : "/api/audit-logs";

    try {
      const data = await apiRequest(url, { method: "GET" });
      const rows = Array.isArray(data) ? data : data?.logs || data?.rows || [];
      setLogs(Array.isArray(rows) ? rows : []);
      setApiError("");
    } catch (error) {
      setApiError(flattenApiErrors(error));
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !currentUser || accessDenied) return;

    let cancelled = false;
    (async () => {
      await loadLogs({
        entityType: "all",
        actionType: "all",
        dateFrom: "",
        dateTo: "",
        userQuery: "",
      });
      if (!cancelled) setLogsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, currentUser, accessDenied, loadLogs]);

  const chips = useMemo(
    () => [
      {
        key: "entityType",
        label: "Entity",
        value: entityType !== "all" ? entityType : "",
        onClear: () => setEntityType("all"),
      },
      {
        key: "actionType",
        label: "Action",
        value: actionType !== "all" ? formatActionLabel(actionType) : "",
        onClear: () => setActionType("all"),
      },
      { key: "dateFrom", label: "From", value: dateFrom || "", onClear: () => setDateFrom("") },
      { key: "dateTo", label: "To", value: dateTo || "", onClear: () => setDateTo("") },
      { key: "userQuery", label: "User", value: userQuery || "", onClear: () => setUserQuery("") },
    ],
    [actionType, dateFrom, dateTo, entityType, userQuery],
  );

  const diffLines = useMemo(() => {
    if (!selectedLog) return [];
    return buildDiffLines(selectedLog.old_values_json, selectedLog.new_values_json, selectedLog.action);
  }, [selectedLog]);

  useEffect(() => {
    if (!selectedLog) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setSelectedLog(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedLog]);

  const showSkeleton =
    authLoading || (!accessDenied && !!currentUser && canManageUsers(currentUser) && !logsReady);

  if (showSkeleton) {
    return <SkeletonListPage rows={8} />;
  }

  return (
    <AppMain>
      <motion.div
        className="space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Audit Logs"
          subtitle="Immutable trail of data changes and authentication events—restricted to management oversight."
          breadcrumbs={<Breadcrumbs items={[{ label: "Audit Logs" }]} />}
          actions={
            <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
          }
        />

        {accessDenied ? (
          <Alert variant="warning" title="Access restricted" data-testid="access-denied-audit-logs">
            You do not have permission to view this page. Only administrators can view audit logs. Contact an
            admin if you need an export or investigation.
          </Alert>
        ) : null}

        {canAccess && apiError ? (
          <Alert variant="error" title="Could not load audit logs">
            {apiError}
            <button
              type="button"
              onClick={() => {
                setApiError("");
                loadLogs({ entityType, actionType, dateFrom, dateTo, userQuery });
              }}
              className="mt-2 text-xs font-bold underline hover:opacity-80"
            >
              Retry
            </button>
          </Alert>
        ) : null}

        {canAccess ? (
          <>
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <ClipboardList size={16} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title">Registry Filters</h2>
                </div>
              </div>
              <div className="p-6 sm:p-8">
                <form
                  className="grid gap-6 lg:grid-cols-12"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setApiError("");
                    loadLogs({ entityType, actionType, dateFrom, dateTo, userQuery });
                  }}
                >
                  <div className="lg:col-span-3">
                    <Field label="Entity type">
                       <Select
                         value={entityType}
                         onChange={(e) => setEntityType(e.target.value)}
                         className="!h-12 border-stone-200"
                       >
                        <option value="all">All entities</option>
                        <option value="tenants">Tenants</option>
                        <option value="rooms">Rooms</option>
                        <option value="contracts">Contracts</option>
                        <option value="billing">Billing</option>
                        <option value="payments">Payments</option>
                        <option value="users">Users</option>
                        <option value="bed_spaces">Bed spaces</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="lg:col-span-3">
                    <Field label="Action">
                       <Select
                         value={actionType}
                         onChange={(e) => setActionType(e.target.value)}
                         className="!h-12 border-stone-200"
                       >
                        <option value="all">All actions</option>
                        <option value="create">Create</option>
                        <option value="update">Update</option>
                        <option value="delete">Delete</option>
                        <option value="status_change">Status change</option>
                        <option value="login">Login</option>
                        <option value="logout">Logout</option>
                        <option value="access_denied">Access denied</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="lg:col-span-6">
                    <Field label="User">
                      <div className="group relative">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                          aria-hidden
                        />
                        <Input
                          value={userQuery}
                          onChange={(e) => setUserQuery(e.target.value)}
                          placeholder="Username or display name…"
                          className="!h-11 border-stone-200 pl-11"
                        />
                      </div>
                    </Field>
                  </div>
                  <div className="lg:col-span-4">
                    <Field label="From">
                       <Input
                         type="date"
                         value={dateFrom}
                         onChange={(e) => setDateFrom(e.target.value)}
                         className="!h-12 border-stone-200"
                       />
                    </Field>
                  </div>
                  <div className="lg:col-span-4">
                    <Field label="To">
                         <Input
                           placeholder="Filter by user or IP..."
                           value={userQuery}
                           onChange={(e) => setUserQuery(e.target.value)}
                           className="pl-11 !h-12 border-stone-200"
                         />
                    </Field>
                  </div>
                  <div className="flex items-end lg:col-span-4">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full !h-11 rounded-xl bg-teal-600 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 hover:bg-teal-700"
                    >
                      Apply filters
                    </Button>
                  </div>
                </form>

                <FilterChips
                  className="mt-6"
                  items={chips}
                  onClearAll={() => {
                    setEntityType("all");
                    setActionType("all");
                    setDateFrom("");
                    setDateTo("");
                    setUserQuery("");
                    setApiError("");
                    loadLogs({ entityType: "all", actionType: "all", dateFrom: "", dateTo: "", userQuery: "" });
                  }}
                />
              </div>
            </Card>

            <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
              <ClipboardList className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden />
              <span>{logs.length} entr{logs.length === 1 ? "y" : "ies"} loaded</span>
            </div>

            <Table
              caption="Audit log records"
              ariaLabel="Audit logs table"
              columns={[
                { key: "timestamp", label: "Timestamp" },
                { key: "user", label: "User" },
                { key: "action", label: "Action" },
                { key: "entity", label: "Entity" },
                { key: "entity_id", label: "Entity ID" },
              ]}
              rows={logs.map((log, idx) => {
                const ts = log?.created_at || null;
                const userName =
                  log?.user_first_name && log?.user_last_name
                    ? `${log.user_first_name} ${log.user_last_name}`
                    : log?.user_username || "—";
                const entity = log?.entity_name || "—";
                const entityId = log?.entity_id ? `#${log.entity_id}` : "—";
                const action = log?.action || null;

                return (
                  <tr
                    key={log?.audit_log_id ?? idx}
                    tabIndex={0}
                    className="cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50 focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(13,148,136,0.3)]"
                    onClick={() => setSelectedLog(log)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedLog(log);
                      }
                    }}
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm tabular-nums text-stone-600">
                      {formatAuditTimestamp(ts)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-stone-900">{userName}</td>
                    <td className="px-6 py-4">
                      <ActionBadge action={action} />
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-700">{formatEntityLabel(entity)}</td>
                    <td className="px-6 py-4 font-mono text-xs tabular-nums text-stone-500">{entityId}</td>
                  </tr>
                );
              })}
              emptyTitle="No audit entries found"
              emptyDescription="Adjust filters, widen the date range, or apply again after new activity."
            />
          </>
        ) : null}
      </motion.div>

      {selectedLog ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-detail-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Close audit log details"
            onClick={() => setSelectedLog(null)}
          />
          <div
            ref={modalRef}
             className="HS-card-shadow relative w-full max-w-3xl overflow-hidden rounded-3xl border border-stone-200 bg-white"
          >
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/50 px-6 py-5">
              <div>
                <p id="audit-detail-title" className="text-sm font-bold text-stone-900">
                  Change details
                </p>
                <p className="mt-1 text-xs font-medium text-stone-500">
                  {formatAuditTimestamp(selectedLog?.created_at)}
                  {" · "}
                  {selectedLog?.user_first_name
                    ? `${selectedLog.user_first_name} ${selectedLog.user_last_name}`
                    : selectedLog?.user_username || "—"}
                  {" · "}
                  {selectedLog?.entity_name || "—"}
                  {selectedLog?.entity_id ? ` #${selectedLog.entity_id}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                onClick={() => setSelectedLog(null)}
                aria-label="Close details"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <ActionBadge action={selectedLog?.action} />
                <span className="text-xs font-medium text-stone-500">
                  {formatActionLabel(selectedLog?.action)} on {selectedLog?.entity_name || "—"}
                </span>
              </div>

              {diffLines.length ? (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                    Field-level changes
                  </p>
                  <div className="rounded-2xl border border-stone-100 overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 text-[10px] font-bold tracking-wider text-stone-500">
                        <tr>
                          <th className="px-5 py-3 border-r border-stone-100">Attribute</th>
                          <th className="px-5 py-3 border-r border-stone-100">Original</th>
                          <th className="px-5 py-3 text-emerald-800">Modified</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffLines.map((line) => (
                          <tr key={line.field} className="border-t border-stone-100 hover:bg-stone-50/50">
                            <td className="px-5 py-4 font-semibold text-stone-900 border-r border-stone-100 bg-stone-50/20">
                              {formatFieldLabel(line.field)}
                            </td>
                            <td className="px-5 py-4 font-mono text-stone-500 border-r border-stone-100 line-through decoration-rose-400/50">
                              <span className="bg-rose-50/50 px-1.5 py-0.5 rounded text-rose-900/70">{line.before === '""' ? "—" : line.before.replace(/"/g, "")}</span>
                            </td>
                            <td className="px-5 py-4 font-mono font-bold text-emerald-800">
                              <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/50">{line.after === '""' ? "—" : line.after.replace(/"/g, "")}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center bg-stone-50/30">
                  <p className="text-sm font-semibold text-stone-900">No field changes recorded</p>
                  <p className="mt-1 text-xs font-medium text-stone-500">
                    Auth event or non-attribute change detected.
                  </p>
                </div>
              )}

              <details className="mt-8 group">
                <summary className="flex cursor-pointer items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-600">
                  <div className="transition-transform group-open:rotate-90">▶</div>
                  Technical Data (Raw JSON)
                </summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300">Old State</p>
                    <pre className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-stone-100 bg-stone-50 p-3 font-mono text-[10px] text-stone-500">
                      {JSON.stringify(
                        safeParseJson(selectedLog?.old_values_json) ?? selectedLog?.old_values_json ?? null,
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300">New State</p>
                    <pre className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-stone-100 bg-stone-50 p-3 font-mono text-[10px] text-stone-500">
                      {JSON.stringify(
                        safeParseJson(selectedLog?.new_values_json) ?? selectedLog?.new_values_json ?? null,
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      ) : null}
    </AppMain>
  );
}
