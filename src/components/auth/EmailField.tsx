"use client";

import styles from "./auth.module.css";

interface EmailFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  labelBold?: boolean;
  wide?: boolean;
}

export function EmailField({
  value,
  onChange,
  label = "Email",
  placeholder = "Email address",
  labelBold = false,
  wide = false,
}: EmailFieldProps) {
  const wrapperClass = `${styles.emailFieldWrapper} ${wide ? styles.emailFieldWrapperWide : ""}`;
  const labelClass = `${styles.emailLabel} ${!labelBold ? styles.emailLabelNormal : ""}`;

  return (
    <div className={wrapperClass}>
      <label htmlFor="email" className={labelClass}>
        {label}
      </label>
      <div className={styles.emailSpacer} />
      <div className={styles.emailInputWrapper}>
        <input
          id="email"
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="email"
          className={styles.emailInput}
        />
      </div>
    </div>
  );
}
