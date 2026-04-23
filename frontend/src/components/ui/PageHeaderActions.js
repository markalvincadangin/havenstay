"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import UserRoleBadge from "./UserRoleBadge";
import { headerIconBackButtonClass, primaryLinkCtaClass } from "./LinkTokens";

export default function PageHeaderActions({
  backHref,
  backLabel = "Go back",
  ctaHref,
  ctaLabel,
  ctaIcon: CtaIcon,
  ctaClassName = "",
  user,
  children = null,
}) {
  const hasCta = Boolean(ctaHref && ctaLabel);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {backHref ? (
        <Link href={backHref} className={headerIconBackButtonClass} aria-label={backLabel} title={backLabel}>
          <ArrowLeft size={18} aria-hidden />
        </Link>
      ) : null}
      {hasCta ? (
        <Link href={ctaHref} className={`${primaryLinkCtaClass} ${ctaClassName}`.trim()}>
          {CtaIcon ? <CtaIcon size={18} aria-hidden /> : null}
          <span>{ctaLabel}</span>
        </Link>
      ) : null}
      {children}
      <div className={`${backHref || hasCta ? "border-l border-stone-200 pl-3" : ""}`}>
        <UserRoleBadge username={user?.username} roleName={user?.role?.role_name} />
      </div>
    </div>
  );
}
