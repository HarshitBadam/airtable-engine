"use client";

import { GoogleIcon, AppleIcon } from "./Icons";
import styles from "./auth.module.css";

type Provider = "sso" | "google" | "apple";

interface AuthProviderButtonProps {
  provider: Provider;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "sign-in" | "sign-up";
  wide?: boolean;
  fullWidth?: boolean;
}

export function AuthProviderButton({
  provider,
  onClick,
  disabled = false,
  variant = "sign-in",
  wide = false,
  fullWidth = false,
}: AuthProviderButtonProps) {
  const icon =
    provider === "google" ? (
      <GoogleIcon size={16} />
    ) : provider === "apple" ? (
      <AppleIcon size={16} />
    ) : null;

  const buttonClass = [
    styles.providerButton,
    wide && styles.providerButtonWide,
    fullWidth && styles.providerButtonFullWidth,
  ]
    .filter(Boolean)
    .join(" ");

  const contentClass = [
    styles.providerButtonContent,
    provider === "sso" && styles.providerButtonContentSSO,
  ]
    .filter(Boolean)
    .join(" ");

  const iconClass = [
    styles.providerButtonIcon,
    provider === "apple" && styles.providerButtonIconApple,
  ]
    .filter(Boolean)
    .join(" ");

  const getLabel = () => {
    if (provider === "sso") {
      return variant === "sign-in" ? (
        <>
          Sign in with{" "}
          <span className={styles.providerButtonLabelBold}>Single Sign On</span>
        </>
      ) : (
        <>
          Continue with{" "}
          <span className={styles.providerButtonLabelBold}>Single Sign On</span>
        </>
      );
    }

    if (provider === "google") {
      return (
        <>
          Continue with{" "}
          <span className={styles.providerButtonLabelBold}>Google</span>
        </>
      );
    }

    return variant === "sign-in" ? (
      <>
        Continue with{" "}
        <span className={styles.providerButtonLabelBold}>Apple ID</span>
      </>
    ) : (
      <>
        Continue with{" "}
        <span className={styles.providerButtonLabelBold}>Apple</span>
      </>
    );
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClass}
    >
      <span className={contentClass}>
        {icon && <span className={iconClass}>{icon}</span>}
        <span className={styles.providerButtonLabel}>{getLabel()}</span>
      </span>
    </button>
  );
}
