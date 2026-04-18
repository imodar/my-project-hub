import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Validator } from "@/lib/validators";

export type ValidationSchema<T extends string> = Partial<Record<T, Validator | Validator[]>>;

export interface UseFormValidationOptions {
  /** When this changes (e.g. drawer `open` toggling), errors are cleared. */
  resetKey?: unknown;
}

export function useFormValidation<T extends string>(
  schema: ValidationSchema<T>,
  options: UseFormValidationOptions = {}
) {
  const { t } = useLanguage();
  const [errors, setErrors] = useState<Partial<Record<T, string>>>({});

  // Clear errors whenever the resetKey changes (e.g. drawer reopens).
  useEffect(() => {
    setErrors({});
  }, [options.resetKey]);

  const runField = useCallback(
    (field: T, value: unknown): string | null => {
      const rule = schema[field];
      if (!rule) return null;
      const validators = Array.isArray(rule) ? rule : [rule];
      for (const v of validators) {
        const key = v(value);
        if (key) {
          const messages = (t as unknown as { validation?: Record<string, string> }).validation || {};
          return messages[key] || key;
        }
      }
      return null;
    },
    [schema, t]
  );

  const validate = useCallback(
    (values: Partial<Record<T, unknown>>): boolean => {
      const next: Partial<Record<T, string>> = {};
      let ok = true;
      (Object.keys(schema) as T[]).forEach((field) => {
        const msg = runField(field, values[field]);
        if (msg) {
          next[field] = msg;
          ok = false;
        }
      });
      setErrors(next);
      return ok;
    },
    [schema, runField]
  );

  const clearError = useCallback((field: T) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const reset = useCallback(() => setErrors({}), []);

  const setError = useCallback((field: T, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  return { errors, validate, clearError, reset, setError };
}
