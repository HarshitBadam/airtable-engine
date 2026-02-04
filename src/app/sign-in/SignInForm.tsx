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

import styles from "./SignInForm.module.css";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const emailValid = useMemo(() => isValidEmail(email), [email]);

  const handleGoogleSignIn = () => void signIn("google", { callbackUrl: "/" });
  const handleContinue = () => void signIn("google", { callbackUrl: "/" });

  return (
    <AuthShell variant="sign-in">
      <div className={styles.logo}>
        <AirtableLogo width={42} />
      </div>

      <h1 className={styles.title}>Sign in to Airtable</h1>

      <EmailField value={email} onChange={setEmail} />
      <PrimaryContinueButton disabled={!emailValid} onClick={handleContinue}>
        Continue
      </PrimaryContinueButton>

      <OrDivider />

      <div className={styles.providerButtonsWrapper}>
        <AuthProviderButton provider="sso" />
        <div className={styles.providerButtonSpacingWrapper}>
          <AuthProviderButton provider="google" onClick={handleGoogleSignIn} />
        </div>
        <div className={styles.providerButtonSpacingWrapperLast}>
          <AuthProviderButton provider="apple" />
        </div>
      </div>

      <p className={styles.footer}>
        New to Airtable?{" "}
        <Link href="/sign-up" className={authStyles.authLink}>
          Create an account
        </Link>{" "}
        instead
      </p>

      <p className={styles.cookieFooter}>
        Manage your cookie preferences{" "}
        <a
          href="#"
          className={`${authStyles.authLink} ${styles.cookieHereLink}`}
          onClick={(e) => e.preventDefault()}
        >
          here
        </a>
      </p>
    </AuthShell>
  );
}
