import { RATE_TOTAL, RATE_ER, RATE_EE } from "./constants";
import { formatUSD } from "./format";

export interface CalculationResult {
  calc_total: number;
  calc_er: number;
  calc_ee: number;
  calc_inputs: {
    w2_count: number;
    tax_year: number;
    rate_total: number;
    rate_er: number;
    rate_ee: number;
  };
  calc_explanation: string;
}

/**
 * Calculate tax savings from W-2 count.
 * Pure function — no side effects, fully testable.
 */
export function calculateSavings(w2Count: number): CalculationResult {
  const taxYear = new Date().getFullYear();
  const calcTotal = w2Count * RATE_TOTAL;
  const calcEr = w2Count * RATE_ER;
  const calcEe = w2Count * RATE_EE;

  return {
    calc_total: calcTotal,
    calc_er: calcEr,
    calc_ee: calcEe,
    calc_inputs: {
      w2_count: w2Count,
      tax_year: taxYear,
      rate_total: RATE_TOTAL,
      rate_er: RATE_ER,
      rate_ee: RATE_EE,
    },
    calc_explanation:
      `Based on ${w2Count} W-2 employees (Tax Year ${taxYear}):\n` +
      `Total Tax Reduction: ${formatUSD(calcTotal)} = Employer Net Savings: ${formatUSD(calcEr)} + Employee Reduction: ${formatUSD(calcEe)}\n` +
      `Per W-2: Total ${formatUSD(RATE_TOTAL)} = ER ${formatUSD(RATE_ER)} + EE ${formatUSD(RATE_EE)}`,
  };
}

/**
 * Validate proposal input fields.
 * Returns array of error messages (empty = valid).
 */
export function validateInput(input: {
  company_name: unknown;
  industry: unknown;
  w2_count: unknown;
}): string[] {
  const errors: string[] = [];

  if (
    !input.company_name ||
    typeof input.company_name !== "string" ||
    !input.company_name.trim()
  ) {
    errors.push("Business Name");
  }

  if (
    !input.industry ||
    typeof input.industry !== "string" ||
    !input.industry.trim()
  ) {
    errors.push("Industry");
  }

  const w2 = input.w2_count;
  if (
    w2 === undefined ||
    w2 === null ||
    typeof w2 !== "number" ||
    !Number.isFinite(w2) ||
    w2 <= 0 ||
    !Number.isInteger(w2)
  ) {
    errors.push("W-2 Count (must be a positive whole number)");
  }

  return errors;
}
