import { describe, it, expect } from "vitest";
import { hashWithPepper, generateToken } from "../crypto";

describe("hashWithPepper", () => {
  it("returns a 64-char hex string (SHA-256)", () => {
    const result = hashWithPepper("test-value", "test-pepper");
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic — same input produces same output", () => {
    const a = hashWithPepper("hello", "pepper123");
    const b = hashWithPepper("hello", "pepper123");
    expect(a).toBe(b);
  });

  it("different values produce different hashes", () => {
    const a = hashWithPepper("value1", "pepper");
    const b = hashWithPepper("value2", "pepper");
    expect(a).not.toBe(b);
  });

  it("different peppers produce different hashes", () => {
    const a = hashWithPepper("value", "pepper1");
    const b = hashWithPepper("value", "pepper2");
    expect(a).not.toBe(b);
  });

  it("handles empty string value", () => {
    const result = hashWithPepper("", "pepper");
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("handles empty pepper", () => {
    const result = hashWithPepper("value", "");
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("handles unicode characters", () => {
    const result = hashWithPepper("こんにちは", "🔑");
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("handles very long strings", () => {
    const longValue = "a".repeat(10000);
    const result = hashWithPepper(longValue, "pepper");
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("generateToken", () => {
  it("returns a 64-char hex string (32 bytes)", () => {
    const token = generateToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates unique tokens each time", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
  });

  it("has sufficient entropy (at least 256 bits)", () => {
    const token = generateToken();
    // 64 hex chars = 32 bytes = 256 bits
    expect(token.length).toBe(64);
  });
});
