"use client";

/**
 * SignInForm - Main sign-in form component
 * Implements the Airtable sign-in UI per docs/sign-in-specs.md
 */

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

export function SignInForm() {
  const [email, setEmail] = useState("");

  // Email validation - disabled until valid email format
  const isEmailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  const handleGoogleSignIn = () => {
    void signIn("google", { callbackUrl: "/" });
  };

  // TODO: Implement SSO sign-in when provider is configured
  const handleSSOSignIn = () => {
    // Placeholder - SSO not configured
  };

  // TODO: Implement Apple sign-in when provider is configured
  const handleAppleSignIn = () => {
    // Placeholder - Apple not configured
  };

  const handleContinue = () => {
    // For now, redirect to Google OAuth since email/password is not implemented
    // TODO: Implement email continuation flow if needed
    void signIn("google", { callbackUrl: "/" });
  };

  return (
    <AuthShell>
      {/* Logo - with browser-specific top margin */}
      <div className="logo-wrapper">
        <AirtableLogo width={42} />
      </div>

      {/* H1 - "Sign in to Airtable" */}
      <h1
        className="sign-in-title my-[48px] h-[40px] w-[500px] text-[32px] font-medium leading-[40px] text-[#1D1F25]"
        style={{ fontFamily: "var(--at-font-heading)" }}
      >
        Sign in to Airtable
      </h1>

      {/* Email field */}
      <EmailField value={email} onChange={setEmail} />

      {/* Continue button */}
      <PrimaryContinueButton disabled={!isEmailValid} onClick={handleContinue}>
        Continue
      </PrimaryContinueButton>

      {/* Divider */}
      <OrDivider />

      {/* Auth provider buttons - stacked with spacing (16px gap per spec) */}
      <div className="flex w-[500px] flex-col gap-[16px]">
        <AuthProviderButton provider="sso" onClick={handleSSOSignIn} />
        <AuthProviderButton provider="google" onClick={handleGoogleSignIn} />
        <AuthProviderButton provider="apple" onClick={handleAppleSignIn} />
      </div>

      {/* Footer text */}
      <p
        className="footer-text w-[500px] text-[13px] leading-[20px] text-[#616670]"
        style={{ fontFamily: "var(--at-font-body)" }}
      >
        New to Airtable?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-[#166ee1] underline underline-offset-2"
        >
          Create an account
        </Link>{" "}
        instead
      </p>
    </AuthShell>
  );
}
