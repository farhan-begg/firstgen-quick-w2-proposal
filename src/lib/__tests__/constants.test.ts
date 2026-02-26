import { describe, it, expect } from "vitest";
import { RATE_TOTAL, RATE_ER, RATE_EE, LINK_EXPIRY_DAYS } from "../constants";

describe("constants", () => {
  it("Total = ER + EE (rates must add up)", () => {
    expect(RATE_TOTAL).toBe(RATE_ER + RATE_EE);
  });

  it("all rates are positive integers", () => {
    expect(RATE_TOTAL).toBeGreaterThan(0);
    expect(RATE_ER).toBeGreaterThan(0);
    expect(RATE_EE).toBeGreaterThan(0);
    expect(Number.isInteger(RATE_TOTAL)).toBe(true);
    expect(Number.isInteger(RATE_ER)).toBe(true);
    expect(Number.isInteger(RATE_EE)).toBe(true);
  });

  it("Total rate is $3,356", () => {
    expect(RATE_TOTAL).toBe(3356);
  });

  it("ER rate is $1,186", () => {
    expect(RATE_ER).toBe(1186);
  });

  it("EE rate is $2,170", () => {
    expect(RATE_EE).toBe(2170);
  });

  it("link expiry is 30 days", () => {
    expect(LINK_EXPIRY_DAYS).toBe(30);
  });
});
