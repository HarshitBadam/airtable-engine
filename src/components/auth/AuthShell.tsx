"use client";

import { PromoCard } from "./PromoCard";
import styles from "./AuthShell.module.css";

interface AuthShellProps {
  children: React.ReactNode;
  variant?: "sign-in" | "sign-up";
}

export function AuthShell({ children, variant = "sign-in" }: AuthShellProps) {
  if (variant === "sign-up") {
    return (
      <div className={styles.signUpPage}>
        <div className={styles.signUpLayout}>
          <div className={styles.signUpFormContent}>{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.formColumn}>
          <div className={styles.formContent}>{children}</div>
        </div>
        <div className={styles.promoColumn}>
          <PromoCard />
        </div>
      </div>
    </div>
  );
}
