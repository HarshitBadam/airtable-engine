"use client";

import styles from "./auth.module.css";

interface PrimaryContinueButtonProps {
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "sign-in" | "sign-up";
  wide?: boolean;
  fullWidth?: boolean;
}

export function PrimaryContinueButton({
  disabled = false,
  onClick,
  children,
  variant = "sign-in",
  wide = false,
  fullWidth = false,
}: PrimaryContinueButtonProps) {
  const buttonClass = [
    styles.primaryButton,
    variant === "sign-up" && styles.primaryButtonSignUp,
    wide && styles.primaryButtonWide,
    fullWidth && styles.primaryButtonFullWidth,
  ]
    .filter(Boolean)
    .join(" ");

  const textClass =
    variant === "sign-up" ? styles.primaryButtonTextSignUp : styles.primaryButtonText;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={buttonClass}
    >
      <span className={textClass}>{children}</span>
    </button>
  );
}
