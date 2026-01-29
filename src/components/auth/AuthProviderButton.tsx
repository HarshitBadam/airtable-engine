"use client";

/**
 * AuthProviderButton - OAuth provider buttons (SSO / Google / Apple)
 * Follows spec: w-500px, h-40px, radius 6px, elevation shadow with hover state
 */

import { useState } from "react";
import { GoogleIcon, AppleIcon } from "./Icons";

type Provider = "sso" | "google" | "apple";

interface AuthProviderButtonProps {
  provider: Provider;
  onClick?: () => void;
}

// Shadows from spec
const SHADOW_BASE =
  "0px 0px 1px rgba(0,0,0,0.32), 0px 0px 2px rgba(0,0,0,0.08), 0px 1px 3px rgba(0,0,0,0.08)";
const SHADOW_HOVER =
  "0px 0px 1px rgba(0,0,0,0.32), 0px 0px 3px rgba(0,0,0,0.11), 0px 1px 4px rgba(0,0,0,0.12)";

export function AuthProviderButton({
  provider,
  onClick,
}: AuthProviderButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const icon =
    provider === "google" ? (
      <GoogleIcon size={16} />
    ) : provider === "apple" ? (
      <AppleIcon size={16} />
    ) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="rounded-[6px] bg-white text-[#1D1F25]"
      style={{
        fontFamily: "var(--at-font-body)",
        boxShadow: isHovered ? SHADOW_HOVER : SHADOW_BASE,
        appearance: "none",
        WebkitAppearance: "none",
        width: 500,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 12px",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9.75,
          fontSize: 15,
          fontWeight: 400,
          letterSpacing: "0.002em",
          transform: provider === "sso" ? "translate(4px, -1px)" : "translate(0px, -1px)",
        }}
      >
        {icon && (
          <span style={{ 
            flexShrink: 0, 
            display: "flex", 
            alignItems: "center",
            transform: provider === "apple" ? "translateY(-2px)" : undefined,
          }}>
            {icon}
          </span>
        )}
        <span style={{ whiteSpace: "nowrap" }}>
          {provider === "sso" ? (
            <>
              Sign in with <span style={{ fontWeight: 600 }}>Single Sign On</span>
            </>
          ) : provider === "google" ? (
            <>
              Continue with <span style={{ fontWeight: 600 }}>Google</span>
            </>
          ) : (
            <>
              Continue with <span style={{ fontWeight: 600 }}>Apple ID</span>
            </>
          )}
        </span>
      </span>
    </button>
  );
}
