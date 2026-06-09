import { describe, it, expect } from "vitest";
import { assertSafeId, escapeLiteral, escapeLikePattern } from "../escape";

describe("assertSafeId", () => {
  it("accepts a typical cuid", () => {
    expect(assertSafeId("clx1abc23def456ghi")).toBe("clx1abc23def456ghi");
  });

  it("accepts a uuid (with hyphens)", () => {
    expect(assertSafeId("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("accepts underscores and mixed case", () => {
    expect(assertSafeId("Col_Name_123")).toBe("Col_Name_123");
  });

  it("accepts a single character", () => {
    expect(assertSafeId("x")).toBe("x");
  });

  it("accepts max-length identifier (191 chars)", () => {
    const id = "a".repeat(191);
    expect(assertSafeId(id)).toBe(id);
  });

  it("throws on empty string", () => {
    expect(() => assertSafeId("")).toThrow("Unsafe SQL identifier rejected");
  });

  it("throws on over-length string (192 chars)", () => {
    expect(() => assertSafeId("a".repeat(192))).toThrow(
      "Unsafe SQL identifier rejected",
    );
  });

  it("throws on single quote", () => {
    expect(() => assertSafeId("it's")).toThrow("Unsafe SQL identifier rejected");
  });

  it("throws on double quote", () => {
    expect(() => assertSafeId('col"id')).toThrow(
      "Unsafe SQL identifier rejected",
    );
  });

  it("throws on backslash", () => {
    expect(() => assertSafeId("col\\id")).toThrow(
      "Unsafe SQL identifier rejected",
    );
  });

  it("throws on semicolon", () => {
    expect(() => assertSafeId("col;id")).toThrow(
      "Unsafe SQL identifier rejected",
    );
  });

  it("throws on space", () => {
    expect(() => assertSafeId("col id")).toThrow(
      "Unsafe SQL identifier rejected",
    );
  });

  it("allows consecutive hyphens (safe inside quoted literal)", () => {
    expect(assertSafeId("col--id")).toBe("col--id");
  });

  it("throws on newline", () => {
    expect(() => assertSafeId("col\nid")).toThrow(
      "Unsafe SQL identifier rejected",
    );
  });

  it("throws on tab", () => {
    expect(() => assertSafeId("col\tid")).toThrow(
      "Unsafe SQL identifier rejected",
    );
  });
});

describe("escapeLiteral", () => {
  it("returns a valid identifier unchanged", () => {
    expect(escapeLiteral("clx1abc23def456ghi")).toBe("clx1abc23def456ghi");
  });

  it("returns a uuid unchanged (no quotes to double)", () => {
    expect(escapeLiteral("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("throws on non-identifier input (spaces)", () => {
    expect(() => escapeLiteral("hello world")).toThrow(
      "Unsafe SQL identifier rejected",
    );
  });

  it("throws on non-identifier input (quotes)", () => {
    expect(() => escapeLiteral("it's")).toThrow(
      "Unsafe SQL identifier rejected",
    );
  });

  it("throws on empty string", () => {
    expect(() => escapeLiteral("")).toThrow("Unsafe SQL identifier rejected");
  });

  it("throws on special characters", () => {
    expect(() => escapeLiteral("abc123!@#$%^&*()")).toThrow(
      "Unsafe SQL identifier rejected",
    );
  });
});

describe("escapeLikePattern", () => {
  it("returns the string unchanged when there are no special characters", () => {
    expect(escapeLikePattern("hello")).toBe("hello");
  });

  it("escapes a percent wildcard", () => {
    expect(escapeLikePattern("50%")).toBe("50\\%");
  });

  it("escapes an underscore wildcard", () => {
    expect(escapeLikePattern("some_value")).toBe("some\\_value");
  });

  it("escapes a backslash", () => {
    expect(escapeLikePattern("C:\\Users")).toBe("C:\\\\Users");
  });

  it("escapes backslash before percent and underscore", () => {
    expect(escapeLikePattern("a\\%b")).toBe("a\\\\\\%b");
  });

  it("escapes multiple special characters together", () => {
    expect(escapeLikePattern("50%_val\\end")).toBe("50\\%\\_val\\\\end");
  });

  it("handles an empty string", () => {
    expect(escapeLikePattern("")).toBe("");
  });

  it("handles a string with only special characters", () => {
    expect(escapeLikePattern("_%\\")).toBe("\\_\\%\\\\");
  });

  it("does not escape other regex-special chars like ^ or $", () => {
    expect(escapeLikePattern("^price$")).toBe("^price$");
  });
});
