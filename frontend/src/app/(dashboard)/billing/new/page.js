'use client';

import { canManageBilling } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import StandardPage from '@/components/ui/StandardPage';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Alert from '@/components/ui/Alert';
import BillingWizard from '@/features/billing/components/BillingWizard';
import { SkeletonDetailPage } from '@/components/ui/Skeleton';

/**
 * NewBillingPage — Orchestrator for the billing generation workflow.
 * Leverages the BillingWizard feature component.
 */
export default function NewBillingPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const readOnly = !canManageBilling(currentUser);

  return (
    <StandardPage
      title="Generate Bills"
      subtitle="Create new billing cycles for tenants."
      loading={authLoading}
      skeleton={<SkeletonDetailPage />}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: 'Billing', href: '/billing' },
            { label: 'Generate Bills' },
          ]}
        />
      }
    >
      {readOnly ? (
        <Alert
          variant="warning"
          title="Restricted Role"
          className="max-w-4xl mx-auto mb-6"
        >
          You do not have permission to execute billing ledgers.
        </Alert>
      ) : (
        <div className="animate-in fade-in duration-500">
          <BillingWizard />
        </div>
      )}
    </StandardPage>
  );
}
