import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  hint,
  leadingIcon,
  trailing,
  className,
  containerClassName,
  id,
  required,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;

  return (
    <div className={cn("w-full", containerClassName)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
          {required ? (
            <span className="ml-0.5 text-rose-500" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <div className="relative">
        {leadingIcon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-slate-400">
            {leadingIcon}
          </span>
        ) : null}

        <input
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? descriptionId : undefined}
          className={cn(
            "h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors",
            "placeholder:text-slate-400",
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
            leadingIcon ? "pl-10" : undefined,
            trailing ? "pr-10" : undefined,
            error
              ? "border-rose-400 focus:border-rose-500"
              : "border-slate-300 focus:border-brand-500",
            className,
          )}
          {...rest}
        />

        {trailing ? (
          <span className="absolute inset-y-0 right-0 flex w-10 items-center justify-center">
            {trailing}
          </span>
        ) : null}
      </div>

      {error ? (
        <p id={descriptionId} className="mt-1.5 text-xs text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={descriptionId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
