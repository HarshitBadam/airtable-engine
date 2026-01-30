import styles from "./auth.module.css";

interface OrDividerProps {
  size?: "default" | "small";
  wide?: boolean;
}

export function OrDivider({ size = "default", wide = false }: OrDividerProps) {
  const wrapperClass = `${styles.divider} ${wide ? styles.dividerWide : ""}`;
  const textClass = `${styles.dividerText} ${size === "small" ? styles.dividerTextSmall : ""}`;

  return (
    <div className={wrapperClass}>
      <span className={textClass}>or</span>
    </div>
  );
}
