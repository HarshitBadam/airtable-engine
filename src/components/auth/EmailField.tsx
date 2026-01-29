"use client";

/**
 * EmailField - Email input with label
 * Follows spec: w-500px, label 15px, input 40px height with elevation shadow
 */

import { useState } from "react";

interface EmailFieldProps {
  value: string;
  onChange: (value: string) => void;
}

// Shadows from spec
const SHADOW_BASE =
  "0px 0px 1px rgba(0,0,0,0.32), 0px 0px 2px rgba(0,0,0,0.08), 0px 1px 3px rgba(0,0,0,0.08)";
const SHADOW_FOCUS = "inset 0 0 0 1px #166ee1, 0 0 0 1px #166ee1";

export function EmailField({ value, onChange }: EmailFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative mb-[24px] w-[500px] p-[2px]">
      {/* Label */}
      <label
        htmlFor="email"
        className="block text-[15px] font-normal leading-[18.75px] text-[#1D1F25]"
      >
        Email
      </label>

      {/* Spacer */}
      <div className="mt-[8px]" />

      {/* Input */}
      <div className="w-full">
        <input
          id="email"
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Email address"
          autoComplete="email"
          className="h-[40px] w-full rounded-[6px] border-none bg-white px-[8px] py-[4px] text-[15px] text-[#1D1F25] outline-none placeholder:text-[#9299A4]"
          style={{
            fontFamily: "var(--at-font-body)",
            boxShadow: isFocused ? SHADOW_FOCUS : SHADOW_BASE,
            appearance: "none",
            WebkitAppearance: "none",
          }}
        />
      </div>
    </div>
  );
}
