"use client";

import { canManageBilling } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import StandardPage from "@/components/ui/StandardPage";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Alert from "@/components/ui/Alert";
import PaymentWizard from "@/features/payments/components/PaymentWizard";
import { SkeletonDetailPage } from "@/components/ui/Skeleton";

/**
 * RecordPaymentPage — Orchestrator for the payment collection workflow.
 * Leverages the PaymentWizard feature component.
 */
export default function RecordPaymentPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const readOnly = !canManageBilling(currentUser);

  return (
    <StandardPage
      title="Post Payment"
      subtitle="Log a new payment for a tenant's bill."
      loading={authLoading}
      skeleton={<SkeletonDetailPage />}
      breadcrumbs={
        <Breadcrumbs items={[{ label: "Payments", href: "/payments" }, { label: "Record Payment" }]} />
      }
    >
      {readOnly ? (
        <Alert variant="warning" title="Access Restricted" className="max-w-4xl mx-auto mb-6">
          Administrative clearance is required to post payments.
        </Alert>
      ) : (
        <div className="animate-in fade-in duration-500">
          <PaymentWizard />
        </div>
      )}
    </StandardPage>
  );
}
