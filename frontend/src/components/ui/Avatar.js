'use client';
import React, { useState } from 'react';
import { getTenantInitials } from '@/lib/formatters';

/**
 * Avatar — variants per design-system/havenstay/MASTER.md.
 * Supports both tenant and user entity objects.
 */
function AvatarComponent({
  tenant,
  user,
  entity,
  size = 'md',
  variant = 'stone',
}) {
  const [hasError, setHasError] = useState(false);

  // Resolve entity priority
  const target = tenant || user || entity;
  const initials = getTenantInitials(target);
  const avatarUrl =
    target?.avatar_url || target?.profile_photo_url || target?.image;

  const variants = {
    stone: 'bg-stone-100 text-stone-500 ring-stone-200',
    teal: 'bg-teal-50 text-teal-600 ring-teal-100',
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
  };

  const sizes = {
    sm: 'h-7 w-7 text-[9px]',
    md: 'h-9 w-9 text-[10px]',
    lg: 'h-12 w-12 text-sm',
    xl: 'h-16 w-16 text-xl',
  };

  const containerClasses = [
    'flex shrink-0 items-center justify-center rounded-xl font-black ring-1 uppercase tracking-tighter shadow-sm overflow-hidden relative',
    variants[variant] || variants.stone,
    sizes[size] || sizes.md,
  ].join(' ');

  if (avatarUrl && !hasError) {
    return (
      <div className={containerClasses}>
        <img
          src={avatarUrl}
          alt={initials || 'User'}
          className="h-full w-full object-cover transition-opacity duration-300"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return <div className={containerClasses}>{initials || '??'}</div>;
}

// Industry Pattern: Memoize repeating list components to prevent CPU jank during scrolls.
export default React.memo(AvatarComponent);
