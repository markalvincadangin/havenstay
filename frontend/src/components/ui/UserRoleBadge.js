import Avatar from './Avatar';

/**
 * UserRoleBadge — Identity badge for session management.
 * Optimized for both page headers and sidebar footers.
 */
export default function UserRoleBadge({
  username,
  roleName,
  user,
  isLoading,
  isSidebar = false,
}) {
  if (isLoading) {
    return (
      <div className="flex animate-pulse items-center gap-2 rounded-full bg-stone-100/10 px-3 py-1.5 border border-white/5">
        <div className="h-6 w-6 rounded-lg bg-white/10" />
        <div className="h-2 w-16 rounded bg-white/10" />
      </div>
    );
  }

  const safeIdentity =
    String(username || user?.username || '').trim() || 'Guest';
  const safeRole =
    String(roleName || user?.role?.role_name || '').trim() || 'User';

  if (isSidebar) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] border border-white/5 p-3 transition-all hover:bg-white/[0.06] group">
        <Avatar
          user={user || { username: safeIdentity }}
          size="md"
          variant="teal"
        />
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-black uppercase tracking-widest leading-none text-white truncate">
            {safeIdentity}
          </span>
          <span className="text-[9px] font-bold tracking-tight text-white/40 leading-none mt-1.5 group-hover:text-teal-400 transition-colors">
            {safeRole}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 border backdrop-blur-sm transition-all duration-300',
        username || user
          ? 'border-teal-100 bg-teal-50/30 text-teal-800 shadow-sm'
          : 'border-stone-200 bg-stone-50/50 text-stone-600',
      ].join(' ')}
    >
      <Avatar
        user={user || { username: safeIdentity }}
        size="sm"
        variant="teal"
      />
      <span className="text-[10px] font-black uppercase tracking-widest leading-none">
        {safeIdentity}
      </span>
      <div className="h-3 w-[1px] bg-current opacity-20" />
      <span className="text-[9px] font-bold tracking-tight text-stone-500 leading-none">
        {safeRole}
      </span>
    </div>
  );
}
