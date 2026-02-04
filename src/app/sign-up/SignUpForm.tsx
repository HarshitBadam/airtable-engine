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
import authStyles from "~/components/auth/auth.module.css";

import styles from "./SignUpForm.module.css";

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
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

      <div className={styles.termsText}>
        <p className={styles.termsTextParagraph}>
          By creating an account, you agree to the{" "}
          <Link
            href="https://www.airtable.com/company/tos"
            target="_blank"
            rel="noopener noreferrer"
            className={authStyles.authLink}
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="https://www.airtable.com/company/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className={authStyles.authLink}
          >
            Privacy Policy
          </Link>
          .
        </p>
        <p className={styles.cookiesText}>
          Manage your cookie preferences{" "}
          <a
            href="#"
            className={`${authStyles.authLink} ${styles.cookieHereLink}`}
            onClick={(e) => e.preventDefault()}
          >
            here
          </a>
        </p>
      </div>

      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          className={styles.checkboxInput}
        />
        <span className={styles.checkboxBox}>
          <svg className={styles.checkboxIcon} width="16" height="16" viewBox="0 0 16 16" fill="white" style={{ shapeRendering: "geometricPrecision" }}>
            <path fillRule="nonzero" d="M13.5 4C13.3674 4.00002 13.2402 4.05271 13.1465 4.14648L6.49999 10.793L3.3535 7.64648C3.25974 7.55274 3.13258 7.50008 2.99999 7.50008C2.8674 7.50008 2.74023 7.55274 2.64647 7.64648C2.55272 7.74025 2.50006 7.86741 2.50006 8C2.50006 8.13259 2.55272 8.25975 2.64647 8.35352L6.14647 11.8535C6.24024 11.9472 6.3674 11.9999 6.49999 11.9999C6.63257 11.9999 6.75973 11.9472 6.8535 11.8535L13.8535 4.85352C13.9472 4.75975 13.9999 4.63259 13.9999 4.5C13.9999 4.36741 13.9472 4.24025 13.8535 4.14648C13.7597 4.05271 13.6326 4.00002 13.5 4Z" />
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
        <Link href="/sign-in" className={`${authStyles.authLink} ${styles.signInLink}`}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
