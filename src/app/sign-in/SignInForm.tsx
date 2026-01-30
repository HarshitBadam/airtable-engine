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

import styles from "./SignInForm.module.css";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [linkHovered, setLinkHovered] = useState(false);
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
        <AuthProviderButton provider="google" onClick={handleGoogleSignIn} />
        <AuthProviderButton provider="apple" />
      </div>

      <p className={styles.footer}>
        New to Airtable?{" "}
        <Link 
          href="/sign-up" 
          style={{
            color: "#166ee1",
            textDecoration: linkHovered ? "none" : "underline",
            fontWeight: 500,
          }}
          onMouseEnter={() => setLinkHovered(true)}
          onMouseLeave={() => setLinkHovered(false)}
        >
          Create an account
        </Link>{" "}
        instead
      </p>
    </AuthShell>
  );
}
