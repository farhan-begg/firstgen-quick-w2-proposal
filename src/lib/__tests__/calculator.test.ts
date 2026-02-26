import { describe, it, expect } from "vitest";
import { calculateSavings, validateInput } from "../calculator";

describe("calculateSavings", () => {
  it("calculates correctly for 1 W-2", () => {
    const result = calculateSavings(1);
    expect(result.calc_total).toBe(3356);
    expect(result.calc_er).toBe(1186);
    expect(result.calc_ee).toBe(2170);
  });

  it("calculates correctly for 20 W-2s", () => {
    const result = calculateSavings(20);
    expect(result.calc_total).toBe(67120);
    expect(result.calc_er).toBe(23720);
    expect(result.calc_ee).toBe(43400);
  });

  it("calculates correctly for 100 W-2s", () => {
    const result = calculateSavings(100);
    expect(result.calc_total).toBe(335600);
    expect(result.calc_er).toBe(118600);
    expect(result.calc_ee).toBe(217000);
  });

  it("total always equals ER + EE", () => {
    for (const count of [1, 5, 10, 50, 100, 500, 1000]) {
      const result = calculateSavings(count);
      expect(result.calc_total).toBe(result.calc_er + result.calc_ee);
    }
  });

  it("stores the correct rates in calc_inputs", () => {
    const result = calculateSavings(10);
    expect(result.calc_inputs.rate_total).toBe(3356);
    expect(result.calc_inputs.rate_er).toBe(1186);
    expect(result.calc_inputs.rate_ee).toBe(2170);
  });

  it("stores the W-2 count in calc_inputs", () => {
    const result = calculateSavings(25);
    expect(result.calc_inputs.w2_count).toBe(25);
  });

  it("stores the current year as tax_year", () => {
    const result = calculateSavings(1);
    expect(result.calc_inputs.tax_year).toBe(new Date().getFullYear());
  });

  it("generates a non-empty explanation string", () => {
    const result = calculateSavings(10);
    expect(result.calc_explanation).toBeTruthy();
    expect(result.calc_explanation).toContain("10 W-2 employees");
    expect(result.calc_explanation).toContain("$33,560.00");
  });

  it("handles edge case of very large W-2 count", () => {
    const result = calculateSavings(100000);
    expect(result.calc_total).toBe(335600000);
    expect(result.calc_er + result.calc_ee).toBe(result.calc_total);
  });
});

describe("validateInput", () => {
  const valid = {
    company_name: "Acme Corp",
    industry: "Manufacturing",
    w2_count: 25,
  };

  it("returns empty array for valid input", () => {
    expect(validateInput(valid)).toEqual([]);
  });

  // Company name edge cases
  it("rejects empty company name", () => {
    const errors = validateInput({ ...valid, company_name: "" });
    expect(errors).toContain("Business Name");
  });

  it("rejects whitespace-only company name", () => {
    const errors = validateInput({ ...valid, company_name: "   " });
    expect(errors).toContain("Business Name");
  });

  it("rejects null company name", () => {
    const errors = validateInput({ ...valid, company_name: null });
    expect(errors).toContain("Business Name");
  });

  it("rejects numeric company name", () => {
    const errors = validateInput({ ...valid, company_name: 123 });
    expect(errors).toContain("Business Name");
  });

  // Industry edge cases
  it("rejects empty industry", () => {
    const errors = validateInput({ ...valid, industry: "" });
    expect(errors).toContain("Industry");
  });

  it("rejects null industry", () => {
    const errors = validateInput({ ...valid, industry: null });
    expect(errors).toContain("Industry");
  });

  // W-2 count edge cases
  it("rejects zero W-2 count", () => {
    const errors = validateInput({ ...valid, w2_count: 0 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects negative W-2 count", () => {
    const errors = validateInput({ ...valid, w2_count: -5 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects decimal W-2 count", () => {
    const errors = validateInput({ ...valid, w2_count: 10.5 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects string W-2 count", () => {
    const errors = validateInput({ ...valid, w2_count: "25" });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects null W-2 count", () => {
    const errors = validateInput({ ...valid, w2_count: null });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects undefined W-2 count", () => {
    const errors = validateInput({ ...valid, w2_count: undefined });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects NaN W-2 count", () => {
    const errors = validateInput({ ...valid, w2_count: NaN });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects Infinity W-2 count", () => {
    const errors = validateInput({ ...valid, w2_count: Infinity });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("accepts W-2 count of 1 (minimum)", () => {
    expect(validateInput({ ...valid, w2_count: 1 })).toEqual([]);
  });

  it("accepts large W-2 count", () => {
    expect(validateInput({ ...valid, w2_count: 100000 })).toEqual([]);
  });

  // Multiple errors
  it("reports multiple missing fields at once", () => {
    const errors = validateInput({
      company_name: "",
      industry: "",
      w2_count: 0,
    });
    expect(errors.length).toBe(3);
  });
});
