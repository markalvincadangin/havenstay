"use client";

import React from "react";
import { ArrowLeft, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import Button from "./Button";

/**
 * Enhanced WizardFrame — Centralized multi-step flow controller.
 * Aligns to HCI principles: visibility of system status, recognition rather than recall.
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
  isNextDisabled = false,
  isSubmitDisabled = false,
  cancelLabel = "Cancel",
  nextLabel = "Next Step",
  submitLabel = "Confirm & Save",
  extraActions = null,
  children
}) {
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      {/* Visual Stepper & Header */}
      <Card className="!p-0 border-stone-200 shadow-sm overflow-hidden hs-glass-effect">
        <div className="flex flex-col border-b border-stone-100 bg-stone-50/30">
          <div className="flex items-center justify-between px-8 py-5">
            <div className="flex items-center gap-4">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors border border-stone-200 shadow-sm"
                  title={cancelLabel}
                  type="button"
                >
                  <ArrowLeft size={16} strokeWidth={2.5} />
                </button>
              )}
              <h2 className="hs-strip-title text-stone-400">
                {title}
              </h2>
            </div>
            
            {/* Step Counter */}
            <div className="font-mono text-[10px] font-black uppercase tracking-widest text-stone-300">
              Step {currentStepIndex + 1} <span className="mx-1">/</span> {steps.length}
            </div>
          </div>

          {/* Visual Progress Bar / Stepper */}
          <div className="flex border-t border-stone-100/50">
            {steps.map((step, idx) => {
              const isActive = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;
              return (
                <div 
                  key={idx} 
                  className={`flex-1 relative py-3 px-4 flex items-center justify-center gap-2 border-r border-stone-100/50 last:border-r-0 transition-colors duration-300 ${isActive ? 'bg-white' : ''}`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black transition-all duration-500 ${
                    isPast ? 'bg-emerald-500 text-white' : 
                    isActive ? 'bg-teal-600 text-white scale-110 shadow-md' : 'bg-stone-100 text-stone-400'
                  }`}>
                    {isPast ? <Check size={10} strokeWidth={3} /> : idx + 1}
                  </div>
                  <span className={`hidden sm:inline text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 ${
                    isPast ? 'text-stone-900' : isActive ? 'text-teal-700' : 'text-stone-300'
                  }`}>
                    {step.label}
                  </span>
                  
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <motion.div 
                      layoutId="wizard-active-bar"
                      className="absolute bottom-0 left-0 h-0.5 w-full bg-teal-500" 
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Body with Transition */}
        <div className="p-8 sm:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </Card>

      {/* Navigation Controls */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:items-center">
        {!isFirstStep && (
          <Button 
            variant="secondary" 
            onClick={onBack} 
            disabled={isSubmitting} 
            type="button"
            className="h-12 px-8 rounded-xl font-bold text-sm text-stone-600 hover:text-stone-900 border-stone-200"
          >
            Back
          </Button>
        )}

        {extraActions}
        
        {isLastStep ? (
          <Button 
            variant="primary" 
            onClick={onSubmit} 
            disabled={isSubmitting || isSubmitDisabled} 
            isLoading={isSubmitting}
            className="h-12 px-10 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-teal-500/20 active:scale-95 transition-transform"
            type="button"
          >
            {submitLabel}
          </Button>
        ) : (
          <Button 
            variant="primary" 
            onClick={onNext} 
            disabled={isNextDisabled}
            className="h-12 px-10 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-teal-500/20 active:scale-95 transition-transform"
            type="button"
          >
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
