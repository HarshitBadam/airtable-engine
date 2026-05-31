import { describe, it, expect } from "vitest";
import { escapeLiteral, escapeLikePattern } from "../escape";

describe("escapeLiteral", () => {
  it("returns the string unchanged when there are no single quotes", () => {
    expect(escapeLiteral("hello world")).toBe("hello world");
  });

  it("escapes a single quote by doubling it", () => {
    expect(escapeLiteral("it's")).toBe("it''s");
  });

  it("escapes multiple single quotes", () => {
    expect(escapeLiteral("I'd say it's fine")).toBe("I''d say it''s fine");
  });

  it("handles an empty string", () => {
    expect(escapeLiteral("")).toBe("");
  });

  it("leaves non-quote special characters unchanged", () => {
    expect(escapeLiteral("abc123!@#$%^&*()")).toBe("abc123!@#$%^&*()");
  });

  it("escapes a column ID with an embedded quote", () => {
    const colId = "O'Brien";
    const result = escapeLiteral(colId);
    // Single quote must be doubled for safe SQL literal embedding.
    expect(result).toBe("O''Brien");
    // The result must not contain any lone (un-doubled) single quote.
    expect(result.replace(/''/g, "")).not.toContain("'");
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
