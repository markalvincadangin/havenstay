'use client';

/**
 * StepIndicator — Standardized multi-step progress header for wizards.
 * @param {Array<{step: number, label: string, icon: React.ComponentType}>} steps
 * @param {number} currentStep
 */
export default function StepIndicator({ steps, currentStep }) {
  const totalSteps = steps.length;
  // Progress is (currentStep - 1) / (totalSteps - 1)
  const progressPercent =
    totalSteps > 1 ? ((currentStep - 1) / (totalSteps - 1)) * 100 : 100;

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-8">
        {steps.map((item) => (
          <div key={item.step} className="flex-1 flex flex-col items-center">
            <div
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 ${
                currentStep === item.step
                  ? 'bg-teal-600 text-white shadow-lg ring-4 ring-teal-50'
                  : currentStep > item.step
                    ? 'bg-stone-900 text-teal-400'
                    : 'bg-stone-100 text-stone-400'
              }`}
            >
              {item.icon && <item.icon size={18} />}
            </div>
            <span
              className={`mt-4 text-[10px] font-black uppercase tracking-widest hs-strip-title ${
                currentStep === item.step ? 'text-teal-700' : 'text-stone-300'
              }`}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-1 w-full bg-stone-100 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-teal-600 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
