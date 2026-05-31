export interface NumberFormatConfig {
  decimalPlaces: number;
  thousandsSep: string;
  showThousands: boolean;
  largeNumAbbrev: string | null;
  allowNegative: boolean;
}

export const DEFAULT_NUMBER_CONFIG: NumberFormatConfig = {
  decimalPlaces: 1,
  thousandsSep: "Local",
  showThousands: true,
  largeNumAbbrev: null,
  allowNegative: true,
};

const SUFFIX_MAP: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
  t: 1_000_000_000_000,
  thousand: 1_000,
  million: 1_000_000,
  billion: 1_000_000_000,
  trillion: 1_000_000_000_000,
};

/**
 * Parse a raw user input string into a number.
 *
 * Handles:
 *  - Plain numbers: "123", "1.5", "-42", "+7"
 *  - Scientific notation: "1e4" → 10000, "2.5E-3" → 0.0025
 *  - K/M/B/T suffixes: "100K" → 100000, "2.5M" → 2500000, "1.5B" → 1500000000
 *  - Commas as thousands separators in input: "1,000,000" → 1000000
 *  - Spaces as thousands separators in input: "1 000 000" → 1000000
 *  - Period-comma European format: "1.000.000,50" → 1000000.5
 *
 * Returns null if the input can't be interpreted as a number.
 */
export function parseNumberInput(
  raw: string,
  allowNegative = true,
): number | null {
  let s = raw.trim();
  if (s === "") return null;

  let sign = 1;
  if (s.startsWith("-")) {
    sign = -1;
    s = s.slice(1).trim();
  } else if (s.startsWith("+")) {
    s = s.slice(1).trim();
  }

  if (s === "") return null;

  let multiplier = 1;
  const suffixMatch = /([a-zA-Z]+)\s*$/.exec(s);
  if (suffixMatch) {
    const suffixKey = suffixMatch[1]?.toLowerCase();
    if (suffixKey && SUFFIX_MAP[suffixKey] !== undefined) {
      multiplier = SUFFIX_MAP[suffixKey]!;
      const fullMatch = suffixMatch[0] ?? "";
      s = s.slice(0, -fullMatch.length).trim();
    }
  }

  if (s === "") return null;

  // Detect European format: "1.000.000,50" — multiple periods used as thousands,
  // comma used as decimal. Heuristic: if the string has a comma AND multiple periods
  // (or a period followed by 3 digits followed by another period/comma), treat as European.
  const hasComma = s.includes(",");
  const periodCount = (s.match(/\./g) ?? []).length;

  let normalized: string;

  if (hasComma && periodCount > 1) {
    // European: "1.000.000,50" → "1000000.50"
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma && periodCount === 0) {
    // Could be "1,000,000" (English thousands) or "1000,50" (European decimal)
    // Heuristic: if the part after the LAST comma has exactly 3 digits, treat commas as thousands
    const parts = s.split(",");
    const lastPart = parts[parts.length - 1]!;
    if (lastPart.length === 3 && parts.length > 1) {
      // English thousands: "1,000,000" → "1000000"
      normalized = s.replace(/,/g, "");
    } else {
      // European decimal: "1000,50" → "1000.50"
      normalized = s.replace(",", ".");
    }
  } else if (hasComma && periodCount === 1) {
    // "1,000,000.50" or "1.000,50"
    const commaIdx = s.lastIndexOf(",");
    const periodIdx = s.lastIndexOf(".");
    if (periodIdx > commaIdx) {
      // English: "1,000,000.50" → "1000000.50"
      normalized = s.replace(/,/g, "");
    } else {
      // European: "1.000,50" → "1000.50"
      normalized = s.replace(/\./g, "").replace(",", ".");
    }
  } else {
    // No comma — just strip spaces (thousands separator) and keep periods as decimal
    normalized = s.replace(/[\s\u00A0]/g, "");
  }

  normalized = normalized.replace(/[\s\u00A0]/g, "");

  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;

  const result = sign * num * multiplier;

  if (!allowNegative && result < 0) return null;

  return result;
}

function getSeparators(thousandsSep: string): {
  thousandChar: string;
  decimalChar: string;
} {
  switch (thousandsSep) {
    case "Period, comma":
      return { thousandChar: ".", decimalChar: "," };
    case "Space, comma":
      return { thousandChar: "\u00A0", decimalChar: "," };
    case "Space, period":
      return { thousandChar: "\u00A0", decimalChar: "." };
    default: // "Local", "Comma, period"
      return { thousandChar: ",", decimalChar: "." };
  }
}

/**
 * Format a numeric value for cell display based on the column's NumberFormatConfig.
 *
 * Examples (with default config tweaks):
 *   formatNumber(3456.789, { decimalPlaces: 2, ... }) → "3,456.79"
 *   formatNumber(3456, { largeNumAbbrev: "Thousand", decimalPlaces: 1, ... }) → "3.5K"
 *   formatNumber(-42, { allowNegative: true, decimalPlaces: 0, ... }) → "-42"
 */
export function formatNumber(
  value: number,
  config: NumberFormatConfig = DEFAULT_NUMBER_CONFIG,
): string {
  const { decimalPlaces, thousandsSep, showThousands, largeNumAbbrev, allowNegative } = config;
  const { thousandChar, decimalChar } = getSeparators(thousandsSep);

  let num = allowNegative ? value : Math.abs(value);
  const isNegative = num < 0;
  num = Math.abs(num);

  let suffix = "";
  if (largeNumAbbrev === "Thousand") {
    num = num / 1_000;
    suffix = "K";
  } else if (largeNumAbbrev === "Million") {
    num = num / 1_000_000;
    suffix = "M";
  } else if (largeNumAbbrev === "Billion") {
    num = num / 1_000_000_000;
    suffix = "B";
  }

  const fixed = num.toFixed(decimalPlaces);
  const dotIdx = fixed.indexOf(".");
  const intPart = dotIdx >= 0 ? fixed.slice(0, dotIdx) : fixed;
  const decPart = dotIdx >= 0 ? fixed.slice(dotIdx + 1) : "";

  let intFormatted = intPart;
  if (showThousands && !largeNumAbbrev) {
    intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandChar);
  }

  const sign = isNegative ? "-" : "";
  if (decPart.length > 0) {
    return `${sign}${intFormatted}${decimalChar}${decPart}${suffix}`;
  }
  return `${sign}${intFormatted}${suffix}`;
}

/**
 * Given a raw cell value (from JSONB), return either a formatted number string
 * or the raw string. Used by the grid to display values.
 *
 * If the column is not NUMBER, or no config is provided, returns the raw string.
 */
export function formatCellValue(
  rawValue: unknown,
  columnType: string,
  config?: NumberFormatConfig | null,
): string {
  if (rawValue == null) return "";
  if (typeof rawValue === "object") return "";
  const str =
    typeof rawValue === "string"
      ? rawValue
      : typeof rawValue === "number" || typeof rawValue === "boolean"
        ? String(rawValue)
        : "";
  if (columnType !== "NUMBER") return str;

  const num = Number(str);
  if (!Number.isFinite(num)) return str;

  return formatNumber(num, config ?? DEFAULT_NUMBER_CONFIG);
}
