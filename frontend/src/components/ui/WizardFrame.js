"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { Card } from "./Card";
import Button from "./Button";

/**
 * Next Gen (v7.0) WizardFrame
 * Provides a standardized shell for multi-step creation flows to reduce cognitive load.
 * Complies with spacing rules (px-8 py-5 for headers, p-8 for body).
 */
export function WizardFrame({
  title,
  steps = [],
  currentStepIndex = 0,
  onNext,
  onBack,
  onCancel,
  onSubmit,
  isSubmitting = false,
  cancelLabel = "Cancel",
  nextLabel = "Next Step",
  submitLabel = "Confirm & Save",
  children
}) {
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Wizard Header Strip */}
      <Card className="!p-0 border-stone-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
          <div className="flex items-center gap-4">
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors border border-stone-200"
                title={cancelLabel}
                type="button"
              >
                <ArrowLeft size={16} strokeWidth={2.5} />
              </button>
            )}
            <div>
              <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">
                {title}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                {steps.map((step, idx) => {
                  const isActive = idx === currentStepIndex;
                  const isPast = idx < currentStepIndex;
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <span
                        className={[
                          "text-xs font-bold font-mono tracking-tight",
                          isActive ? "text-teal-600" : isPast ? "text-stone-900" : "text-stone-300"
                        ].join(" ")}
                      >
                        {idx + 1}. {step.label}
                      </span>
                      {idx < steps.length - 1 && (
                        <span className="text-stone-300">/</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Wizard Body */}
        <div className="p-8">
          {children}
        </div>
      </Card>

      {/* Action Bar (Clean Bottom) */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-6">
        {!isFirstStep && (
          <Button variant="secondary" onClick={onBack} disabled={isSubmitting} type="button">
            Back
          </Button>
        )}
        {isLastStep ? (
          <Button 
            variant="primary" 
            onClick={onSubmit} 
            disabled={isSubmitting} 
            isLoading={isSubmitting}
            className="h-11 rounded-xl text-xs font-black uppercase tracking-widest"
            type="button"
          >
            {submitLabel}
          </Button>
        ) : (
          <Button 
            variant="primary" 
            onClick={onNext} 
            className="h-11 rounded-xl text-xs font-black uppercase tracking-widest"
            type="button"
          >
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
