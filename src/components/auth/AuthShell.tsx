"use client";

import { PromoCard } from "./PromoCard";
import styles from "./AuthShell.module.css";

interface AuthShellProps {
  children: React.ReactNode;
  variant?: "sign-in" | "sign-up";
}

export function AuthShell({ children, variant = "sign-in" }: AuthShellProps) {
  const formContentClass =
    variant === "sign-up" ? styles.signUpFormContent : styles.formContent;

  const layoutStyle = variant === "sign-in" 
    ? undefined 
    : { display: 'flex', justifyContent: 'center', alignItems: 'center' } as const;

  return (
    <div className={styles.page}>
      <div className={styles.layout} style={layoutStyle}>
        <div className={variant === "sign-in" ? styles.formColumn : undefined}>
          <div className={formContentClass}>{children}</div>
        </div>
        {variant === "sign-in" && (
          <div className={styles.promoColumn}>
            <PromoCard />
          </div>
        )}
      </div>
    </div>
  );
}
