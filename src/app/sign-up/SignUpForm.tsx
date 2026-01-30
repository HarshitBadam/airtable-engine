"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  AuthShell,
  AirtableLogo,
  EmailField,
  PrimaryContinueButton,
  OrDivider,
  AuthProviderButton,
} from "~/components/auth";
import { isValidEmail } from "~/shared/validation";

import styles from "./SignUpForm.module.css";

const linkStyle = (hovered: boolean) => ({
  color: "#166ee1",
  textDecoration: hovered ? "none" : "underline",
  fontWeight: 500,
});

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [tosHovered, setTosHovered] = useState(false);
  const [privacyHovered, setPrivacyHovered] = useState(false);
  const [signInHovered, setSignInHovered] = useState(false);
  const emailValid = useMemo(() => isValidEmail(email), [email]);

  const handleGoogleSignIn = () => void signIn("google", { callbackUrl: "/" });
  const handleContinue = () => void signIn("google", { callbackUrl: "/" });

  return (
    <AuthShell variant="sign-up">
      <div className={styles.logo}>
        <AirtableLogo width={40} />
      </div>

      <h1 className={styles.title}>Welcome to Airtable</h1>

      <EmailField
        value={email}
        onChange={setEmail}
        label="Work email"
        placeholder="name@company.com"
        labelBold
        wide
      />
      <PrimaryContinueButton
        disabled={!emailValid}
        onClick={handleContinue}
        variant="sign-up"
        fullWidth
      >
        Continue with email
      </PrimaryContinueButton>

      <OrDivider size="small" wide />

      <div className={styles.providerButtonsWrapper}>
        <AuthProviderButton provider="sso" variant="sign-up" fullWidth />
        <AuthProviderButton provider="google" variant="sign-up" fullWidth onClick={handleGoogleSignIn} />
        <AuthProviderButton provider="apple" variant="sign-up" fullWidth />
      </div>

      <p className={styles.termsText}>
        By creating an account, you agree to the{" "}
        <Link 
          href="https://www.airtable.com/company/tos" 
          target="_blank" 
          rel="noopener noreferrer"
          style={linkStyle(tosHovered)}
          onMouseEnter={() => setTosHovered(true)}
          onMouseLeave={() => setTosHovered(false)}
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link 
          href="https://www.airtable.com/company/privacy" 
          target="_blank" 
          rel="noopener noreferrer"
          style={linkStyle(privacyHovered)}
          onMouseEnter={() => setPrivacyHovered(true)}
          onMouseLeave={() => setPrivacyHovered(false)}
        >
          Privacy Policy
        </Link>
        .
      </p>

      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          className={styles.checkboxInput}
        />
        <span className={styles.checkboxBox}>
          <svg className={styles.checkboxIcon} width="12" height="12" viewBox="0 0 16 16" fill="white">
            <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
          </svg>
        </span>
        <span className={styles.checkboxText}>
          By checking this box, you agree to receive marketing and sales communications about
          Airtable products, services, and events. You understand that you can manage your
          preferences at any time by following the instructions in the communications received.
        </span>
      </label>

      <p className={styles.footer}>
        Already have an account?{"\u00A0\u00A0"}
        <Link 
          href="/sign-in" 
          style={linkStyle(signInHovered)}
          onMouseEnter={() => setSignInHovered(true)}
          onMouseLeave={() => setSignInHovered(false)}
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
