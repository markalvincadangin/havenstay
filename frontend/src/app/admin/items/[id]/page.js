"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  PackageCheck, 
  ArrowLeft, 
  Edit3, 
  AlertCircle,
  History,
  Trash2,
  CheckCircle2,
  Wallet,
  Activity
} from "lucide-react";
import useSWR from "swr";

import { apiRequest, fetcher } from "../../../../lib/api";
import { useAuth } from "../../../_context/AuthContext";
import StandardPage from "../../../_components/ui/StandardPage";
import { Card } from "../../../_components/ui/Card";
import Button from "../../../_components/ui/Button";
import Alert from "../../../_components/ui/Alert";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";
import { KpiCard } from "../../../_components/ui/KpiCard";
import { StatusBadge } from "../../../_components/ui/StatusBadge";
import { formatPHP, formatDateString } from "../../../../lib/formatters";
import DetailRow from "../../../_components/ui/DetailRow";
import { Skeleton } from "../../../_components/ui/Skeleton";
import { primaryLinkCtaClass, secondaryOutlineLinkClass } from "../../../_components/ui/LinkTokens";

export default function ItemDetailPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const canManage = currentUser?.role?.role_name === 'admin';
  
  const { data: item, error: loadError, mutate, isValidating } = useSWR(
    `/api/add-ons/${params.id}`,
    fetcher
  );

  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const toggleStatus = async () => {
    setApiError("");
    setSuccessMessage("");
    try {
        await apiRequest(`/api/add-ons/${params.id}`, {
            method: "PUT",
            body: JSON.stringify({ is_active: !item.is_active })
        });
        mutate();
        setSuccessMessage(`Item ${!item.is_active ? 'made available' : 'hidden from selection'} successfully.`);
    } catch (err) {
        setApiError("Failed to update status.");
    }
  };

  if (loadError) return (
    <StandardPage title="Error" subtitle="Failed to load item details.">
        <Alert variant="error">{loadError.message || "Item not found."}</Alert>
    </StandardPage>
  );

  if (!item) {
    return (
      <StandardPage
        title="Loading Asset..."
        subtitle="Operational profile retrieval in progress."
        breadcrumbs={<Breadcrumbs items={[{ label: "Assets", href: "/admin/items" }, { label: "..." }]} />}
      >
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
            </div>
            <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-8">
                    <Skeleton className="h-64 rounded-2xl" />
                    <Skeleton className="h-48 rounded-2xl" />
                </div>
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        </div>
      </StandardPage>
    );
  }

  return (
    <StandardPage
      title={item.item_name}
      subtitle="ASSET SPECIFICATION AND OPERATIONAL ASSIGNMENT STATUS"
      breadcrumbs={
        <Breadcrumbs items={[
          { label: "Administration", href: "/admin/items" }, 
          { label: "Assets & Services", href: "/admin/items" }, 
          { label: item.item_name }
        ]} />
      }
      actions={
        <div className="flex items-center gap-3">
          <Button 
            className={secondaryOutlineLinkClass + " border-stone-200"}
            onClick={() => router.push("/admin/items")}
          >
            <ArrowLeft size={16} />
            Back to List
          </Button>

          {canManage && (
            <Button 
                className={primaryLinkCtaClass}
                onClick={() => router.push(`/admin/items/${params.id}/edit`)}
            >
                <Edit3 size={14} />
                Edit Details
            </Button>
          )}
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Assigned Contracts"
              value={item.active_contracts_count || 0}
              icon={History}
              isSuccess={item.active_contracts_count > 0}
              isLoading={!item}
              isSyncing={isValidating}
            />
            <KpiCard
              label="Catalog Status"
              value={item.is_active ? "Available" : "Hidden"}
              icon={CheckCircle2}
              isSuccess={item.is_active}
              isNeutral={!item.is_active}
              isLoading={!item}
              isSyncing={isValidating}
            />
             <div className="flex flex-col justify-center p-4 rounded-2xl bg-white border border-stone-200 shadow-sm transition-all hover:shadow-md group">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400 mb-2.5 group-hover:text-stone-500 transition-colors">Operational Status</p>
                <Button 
                    variant={item.is_active ? "danger" : "primary"}
                    size="sm"
                    className="w-full !rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm"
                    onClick={toggleStatus}
                    disabled={!item}
                >
                    {item.is_active ? <Trash2 size={12} className="mr-2" /> : <CheckCircle2 size={12} className="mr-2" />}
                    {item.is_active ? "Mark as Unavailable" : "Mark as Available"}
                </Button>
            </div>
        </div>

        {successMessage && (
          <Alert variant="success" className="mb-6">
            {successMessage}
          </Alert>
        )}

        {apiError && (
          <Alert variant="error" className="mb-6">
            {apiError}
          </Alert>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8">
                <Card title="ITEM DETAILS" icon={PackageCheck} className="overflow-hidden">
                    <div className="p-2">
                        <DetailRow 
                            label="Item Name" 
                            value={item.item_name}
                            icon={PackageCheck}
                        />
                        <DetailRow 
                            label="Monthly Fee" 
                            value={formatPHP(item.default_monthly_rate)}
                            icon={Wallet}
                            mono
                        />
                        <DetailRow 
                            label="Last Updated" 
                            value={item.updated_at ? formatDateString(item.updated_at) : "System Initialized"}
                            icon={History}
                        />
                    </div>
                </Card>

                <Card title="USAGE ANALYTICS" icon={Activity}>
                    <div className="p-8 text-center border-2 border-dashed border-stone-100 rounded-2xl">
                        <p className="text-sm font-medium text-stone-400 italic">
                            Assignment history and revenue trends for this asset will be displayed here in a future update.
                        </p>
                    </div>
                </Card>
            </div>

            <div className="space-y-6">
                <Card title="AVAILABILITY">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-stone-600">Current Status</span>
                        <StatusBadge variant={item.is_active ? "success" : "neutral"} size="sm">
                            {item.is_active ? "AVAILABLE" : "HIDDEN"}
                        </StatusBadge>
                    </div>
                    <div className="mt-4 pt-4 border-t border-stone-100">
                        <p className="text-[10px] font-bold text-stone-400 uppercase leading-relaxed">
                            Hidden items won't appear when creating new tenant contracts.
                        </p>
                    </div>
                </Card>

                <Card className="bg-amber-50/20 border-amber-100 flex gap-4 p-6">
                     <AlertCircle size={20} className="text-amber-500 shrink-0" />
                     <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">Forensic Rule</p>
                        <p className="text-[11px] leading-relaxed text-amber-800/80">
                            Asset histories are permanent. Deletion is restricted to maintain data integrity for past financial reports.
                        </p>
                     </div>
                </Card>
            </div>
        </div>
      </div>
    </StandardPage>
  );
}
