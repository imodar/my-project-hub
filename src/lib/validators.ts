// Reusable form-field validators. Return a translation key from `validation.*` or null when valid.

export type ValidatorResult = string | null;
export type Validator = (value: unknown) => ValidatorResult;

export const required: Validator = (value) => {
  if (value === null || value === undefined) return "required";
  if (typeof value === "string" && value.trim() === "") return "required";
  if (Array.isArray(value) && value.length === 0) return "required";
  return null;
};

export const minLength = (min: number): Validator => (value) => {
  if (typeof value !== "string") return null;
  if (value.trim().length < min) return "minLength";
  return null;
};

export const maxLength = (max: number): Validator => (value) => {
  if (typeof value !== "string") return null;
  if (value.trim().length > max) return "maxLength";
  return null;
};

export const validNumber: Validator = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return "invalidNumber";
  return null;
};

export const numericPositive: Validator = (value) => {
  if (value === "" || value === null || value === undefined) return "required";
  const n = Number(value);
  if (Number.isNaN(n)) return "invalidNumber";
  if (n <= 0) return "positiveNumber";
  return null;
};

export const validDate: Validator = (value) => {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "invalidDate";
  return null;
};

export const validPhone: Validator = (value) => {
  if (!value || typeof value !== "string") return null;
  const cleaned = value.replace(/[\s\-()]/g, "");
  if (!/^\+?\d{6,15}$/.test(cleaned)) return "invalidPhone";
  return null;
};

// Compose multiple validators — returns first failing key.
export const compose = (...validators: Validator[]): Validator => (value) => {
  for (const v of validators) {
    const r = v(value);
    if (r) return r;
  }
  return null;
};
