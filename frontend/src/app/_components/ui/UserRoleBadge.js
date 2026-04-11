import { User } from "lucide-react";

export default function UserRoleBadge({ username, roleName }) {
  const safeIdentity = String(username || "").trim() || "Guest";
  const safeRole = String(roleName || "").trim() || "User";

  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full border border-[var(--color-primary)]/20 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)] shadow-sm transition-all duration-200 hover:border-[var(--color-primary)]/40 hover:shadow-md"
      title={`Signed in as ${safeIdentity} (${safeRole})`}
    >
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
        <User size={12} strokeWidth={2.5} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="max-w-[80px] truncate">{safeIdentity}</span>
        <span className="text-[var(--color-primary)]/30" aria-hidden>
          •
        </span>
        <span className="opacity-60">{safeRole}</span>
      </div>
    </div>
  );
}
