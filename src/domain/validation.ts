export type ValidationResult<T = undefined> =
  | { valid: false; errors: string[] }
  | ([T] extends [undefined] ? { valid: true } : { valid: true; value: T });

export function validationResultFromErrors(errors: string[]): ValidationResult {
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
