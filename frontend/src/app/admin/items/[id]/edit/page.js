"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  PackageCheck, 
  ArrowLeft, 
  Save, 
  AlertCircle
} from "lucide-react";
import { useForm } from "react-hook-form";
import useSWR from "swr";

import { apiRequest, fetcher } from "../../../../../lib/api";
import { useAuth } from "../../../../_context/AuthContext";
import StandardPage from "../../../../_components/ui/StandardPage";
import { Card } from "../../../../_components/ui/Card";
import Button from "../../../../_components/ui/Button";
import Alert from "../../../../_components/ui/Alert";
import Breadcrumbs from "../../../../_components/ui/Breadcrumbs";
import { FormSection } from "../../../../_components/ui/FormSection";
import { Field, Input } from "../../../../_components/ui/Fields";
import { applyServerFieldErrors } from "../../../../../lib/forms";

export default function EditItemPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { user: currentUser } = useAuth();
  
  const { data: item, error: loadError, mutate } = useSWR(
    `/api/add-ons/${params.id}`,
    fetcher
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors: fieldErrors, isSubmitting, isDirty },
  } = useForm();
  
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (item) {
      reset({
        item_name: item.item_name,
        default_monthly_rate: item.default_monthly_rate,
        is_active: item.is_active,
      });
    }
  }, [item, reset]);

  const onSubmit = async (formData) => {
    setApiError("");
    try {
      await apiRequest(`/api/add-ons/${params.id}`, {
        method: "PUT",
        body: JSON.stringify(formData)
      });
      router.push(`/admin/items/${params.id}`);
    } catch (err) {
      applyServerFieldErrors(err, setError, { setApiError });
    }
  };

  if (loadError) return (
    <StandardPage title="Error" subtitle="Failed to load item details.">
        <Alert variant="error">{loadError.message || "Item not found."}</Alert>
    </StandardPage>
  );

  return (
    <StandardPage
      title={`Edit: ${item?.item_name || "..."}`}
      subtitle="UPDATE CATALOG CONFIGURATION AND PRICING LOGIC"
      breadcrumbs={
        <Breadcrumbs items={[
          { label: "Administration", href: "/admin/items" }, 
          { label: "Assets & Services", href: "/admin/items" }, 
          { label: "Edit Item" }
        ]} />
      }
      loading={!item}
      actions={
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            className="!h-10 rounded-xl px-5 text-[10px] font-black uppercase tracking-widest border-stone-200"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button 
            form="edit-item-form"
            type="submit"
            className="!h-10 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-900/20"
            loading={isSubmitting}
            disabled={!isDirty}
          >
            <Save size={14} className="mr-2" />
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {apiError && (
          <Alert variant="error" title="Update Failed">
            {apiError}
          </Alert>
        )}

        <form id="edit-item-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormSection 
                title="Item Details" 
                icon={PackageCheck}
            >
                <div className="grid gap-6 sm:grid-cols-2">
                    <Field 
                        label="Item Name / Description" 
                        error={fieldErrors.item_name?.message}
                        required
                    >
                        <Input 
                            placeholder="e.g. Electric Kettle"
                            className="font-bold border-stone-200"
                            {...register("item_name", { required: "Item name is required." })}
                        />
                    </Field>
 
                    <Field 
                        label="Monthly Fee (₱)" 
                        error={fieldErrors.default_monthly_rate?.message}
                        required
                    >
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-300">₱</span>
                            <Input 
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className="pl-9 font-mono font-bold border-stone-200"
                                {...register("default_monthly_rate", { required: "Monthly fee is required." })}
                            />
                        </div>
                    </Field>
                </div>
            </FormSection>

            <Card className="bg-amber-50/20 border-dashed border-amber-200 p-8 flex gap-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <AlertCircle size={20} />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-amber-900">Note</h3>
                    <p className="text-xs leading-relaxed text-amber-800/80">
                        Changes to the monthly fee only apply to new contract assignments. 
                        Active tenant contracts carrying this item will retain their originally agreed rates to maintain billing integrity.
                    </p>
                </div>
            </Card>
        </form>
      </div>
    </StandardPage>
  );
}
