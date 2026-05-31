import styles from "./auth.module.css";
import { AirtableLogoMark } from "~/components/home/icons/BrandIcons";

interface IconProps {
  className?: string;
  size?: number;
}

export function AirtableLogoIcon({ width = 42 }: { width?: number }) {
  const height = Math.round((170 / 200) * width);
  return (
    <AirtableLogoMark
      className={styles.svgIcon}
      width={width}
      height={height}
      shadowColor="rgba(0, 0, 0, 0.25)"
    />
  );
}

export function GoogleIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AppleIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14.105 9.462c-.022-2.348 1.925-3.487 2.013-3.541-1.102-1.6-2.813-1.82-3.414-1.84-1.44-.152-2.838.865-3.57.865-.746 0-1.871-.85-3.088-.824-1.565.023-3.03.93-3.832 2.337-1.656 2.852-.422 7.054 1.167 9.362.794 1.133 1.724 2.4 2.94 2.354 1.19-.049 1.635-.758 3.07-.758 1.42 0 1.84.758 3.077.73 1.276-.021 2.078-1.139 2.847-2.28.918-1.3 1.287-2.578 1.302-2.644-.03-.01-2.483-.943-2.512-3.761zM11.766 2.477c.635-.793 1.07-1.878.95-2.977-.92.04-2.065.638-2.725 1.417-.584.683-1.107 1.8-.972 2.852 1.033.077 2.095-.527 2.747-1.292z"
        fill="#000000"
      />
    </svg>
  );
}
