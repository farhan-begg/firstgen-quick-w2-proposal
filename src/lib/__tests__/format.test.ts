import { describe, it, expect } from "vitest";
import { formatUSD } from "../format";

describe("formatUSD", () => {
  it("formats a positive number as USD", () => {
    expect(formatUSD(12345.67)).toBe("$12,345.67");
  });

  it("formats zero", () => {
    expect(formatUSD(0)).toBe("$0.00");
  });

  it("formats negative numbers", () => {
    expect(formatUSD(-500)).toBe("-$500.00");
  });

  it("formats large numbers with commas", () => {
    expect(formatUSD(1000000)).toBe("$1,000,000.00");
  });

  it("formats string numbers", () => {
    expect(formatUSD("67140")).toBe("$67,140.00");
  });

  it("handles null", () => {
    expect(formatUSD(null)).toBe("$0.00");
  });

  it("handles undefined", () => {
    expect(formatUSD(undefined)).toBe("$0.00");
  });

  it("handles NaN string", () => {
    expect(formatUSD("not-a-number")).toBe("$0.00");
  });

  it("handles empty string", () => {
    expect(formatUSD("")).toBe("$0.00");
  });

  it("rounds to 2 decimal places", () => {
    expect(formatUSD(1.999)).toBe("$2.00");
    expect(formatUSD(1.004)).toBe("$1.00");
  });

  it("formats the exact per-W2 rates correctly", () => {
    expect(formatUSD(3356)).toBe("$3,356.00");
    expect(formatUSD(1186)).toBe("$1,186.00");
    expect(formatUSD(2170)).toBe("$2,170.00");
  });
});
