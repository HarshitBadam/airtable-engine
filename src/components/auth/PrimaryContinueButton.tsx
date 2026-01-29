"use client";

/**
 * PrimaryContinueButton - Primary action button for auth forms
 * Follows spec: w-500px, h-40px, disabled opacity-50, enabled bg-#1B61C9
 */

interface PrimaryContinueButtonProps {
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

// Shadow from spec
const SHADOW_BASE =
  "0px 0px 1px rgba(0,0,0,0.32), 0px 0px 2px rgba(0,0,0,0.08), 0px 1px 3px rgba(0,0,0,0.08)";

export function PrimaryContinueButton({
  disabled = false,
  onClick,
  children,
}: PrimaryContinueButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        fontFamily: "var(--at-font-body)",
        backgroundColor: "#1B61C9",
        border: "1px solid rgba(1, 20, 53, 0.12)",
        boxShadow: SHADOW_BASE,
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
        appearance: "none",
        WebkitAppearance: "none",
        width: 500,
        height: 40,
        minWidth: 200,
        borderRadius: 6,
        padding: "0 14px",
        fontSize: 15,
        fontWeight: 500,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ transform: "translateY(-1px)" }}>{children}</span>
    </button>
  );
}
