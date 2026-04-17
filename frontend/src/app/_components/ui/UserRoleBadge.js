export default function UserRoleBadge({ username, roleName, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex animate-pulse items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 border border-stone-200/50">
        <div className="h-2 w-12 rounded bg-stone-200" />
        <div className="h-3 w-[1px] bg-stone-200" />
        <div className="h-2 w-10 rounded bg-stone-200" />
      </div>
    );
  }

  const safeIdentity = String(username || "").trim() || "Guest";
  const safeRole = String(roleName || "").trim() || "User";

  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 border backdrop-blur-sm transition-all duration-300",
        username
          ? "border-teal-100 bg-teal-50/30 text-teal-800 shadow-sm"
          : "border-stone-200 bg-stone-50/50 text-stone-600",
      ].join(" ")}
    >
      <span className="text-[10px] font-black uppercase tracking-widest leading-none">{safeIdentity}</span>
      <div className="h-3 w-[1px] bg-current opacity-20" />
      <span className="text-[9px] font-bold tracking-tight text-stone-500 leading-none">{safeRole}</span>
    </div>
  );
}
