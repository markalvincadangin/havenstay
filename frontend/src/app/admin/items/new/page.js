"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  PackageCheck, 
  ArrowLeft, 
  Save, 
  Pocket,
  AlertCircle
} from "lucide-react";
import { useForm } from "react-hook-form";
import { applyServerFieldErrors } from "../../../../lib/forms";
import { motion } from "framer-motion";

import { apiRequest } from "../../../../lib/api";
import { useAuth } from "../../../_context/AuthContext";
import StandardPage from "../../../_components/ui/StandardPage";
import { Card } from "../../../_components/ui/Card";
import Button from "../../../_components/ui/Button";
import Alert from "../../../_components/ui/Alert";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";
import { FormSection } from "../../../_components/ui/FormSection";
import { Field, Input } from "../../../_components/ui/Fields";

/**
 * FR-023b: Register New Appliance / Add-on
 * Purpose: Provides a dedicated forensic entry point for cataloging billable assets
 * following the project's established separate-page create pattern.
 */
export default function RegisterItemPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors: fieldErrors, isSubmitting },
  } = useForm({
    defaultValues: {
      item_name: "",
      default_monthly_rate: "",
      is_active: true,
    },
  });
  
  const [apiError, setApiError] = useState("");
  
  const onSubmit = async (formData) => {
    setApiError("");
    try {
      await apiRequest("/api/add-ons", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      router.push("/admin/items");
    } catch (err) {
      applyServerFieldErrors(err, setError, { setApiError });
    }
  };

  return (
    <StandardPage
      title="Add New Item"
      subtitle="REGISTER A RECURRING SERVICE OR FURNISHING TO THE BILLING CATALOG"
      breadcrumbs={
        <Breadcrumbs items={[
          { label: "Administration", href: "/admin/items" }, 
          { label: "Assets & Services", href: "/admin/items" }, 
          { label: "Add Item" }
        ]} />
      }
      actions={
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            className="!h-10 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest border-stone-200"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button 
            form="register-item-form"
            type="submit"
            className="!h-10 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-900/20"
            loading={isSubmitting}
          >
            <Save size={14} className="mr-2" />
            Save Item
          </Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {apiError && (
          <Alert variant="error" title="Registration Failed">
            {apiError}
          </Alert>
        )}

        <form id="register-item-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                            placeholder="e.g. Electric Kettle, Personal Lounge"
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
 
                <div className="mt-8 border-t border-stone-100 pt-8">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <p className="text-sm font-bold text-stone-900">Availability</p>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tight">Only available items can be added to tenant contracts.</p>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input 
                                type="checkbox" 
                                className="peer sr-only" 
                                defaultChecked 
                                {...register("is_active")} 
                            />
                            <div className="peer h-6 w-11 rounded-full bg-stone-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-teal-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300"></div>
                        </label>
                    </div>
                </div>
            </FormSection>

            <Card className="bg-amber-50/20 border-dashed border-amber-200 p-8 flex gap-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <AlertCircle size={20} />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-amber-900">Note</h3>
                    <p className="text-xs leading-relaxed text-amber-800/80">
                        This item will be available for selection in new tenant contracts. 
                        Historical billing records remain immutable; updates here apply only to future contract assignments.
                    </p>
                </div>
            </Card>
        </form>
      </div>
    </StandardPage>
  );
}
