"use client";

import { useActionState, type ReactNode } from "react";
import type { FormAction, FormState } from "@/lib/form-state";

const emptyState: FormState = { message: "" };

export function ActionForm({
  action,
  submitLabel,
  children,
  className = "",
}: {
  action: FormAction;
  submitLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, emptyState);

  return (
    <form action={formAction} className={`record-form ${className}`}>
      {children}
      <div className="form-footer">
        <button className="button button-primary" disabled={pending} type="submit">
          {pending ? "Saving…" : submitLabel}
        </button>
        <p
          aria-live="polite"
          className={`form-message ${state.success ? "is-success" : ""}`}
          role="status"
        >
          {state.message}
        </p>
      </div>
    </form>
  );
}

export function FormField({
  label,
  name,
  type = "text",
  placeholder,
  required,
  min,
  max,
  step,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
  defaultValue?: string | number;
  children?: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children ?? (
        <input
          defaultValue={defaultValue}
          min={min}
          max={max}
          name={name}
          placeholder={placeholder}
          required={required}
          step={step}
          type={type}
        />
      )}
    </label>
  );
}

export function FormSelect({
  label,
  name,
  options,
  required = true,
  defaultValue = "",
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} required={required} defaultValue={defaultValue}>
        {!required && <option value="">—</option>}
        {required && <option disabled value="">Choose…</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FormTextArea({
  label,
  name,
  placeholder,
  required,
  rows = 3,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  defaultValue?: string;
}) {
  return (
    <label className="field field-wide">
      <span>{label}</span>
      <textarea
        name={name}
        placeholder={placeholder}
        required={required}
        rows={rows}
        defaultValue={defaultValue}
      />
    </label>
  );
}
