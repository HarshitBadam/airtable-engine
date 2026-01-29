"use client";

/**
 * SignUpForm - Main sign-up form component
 * Pixel-perfect replica of Airtable's sign-up page
 */

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AirtableLogo } from "~/components/auth";
import { GoogleIcon, AppleIcon } from "~/components/auth/Icons";

// Shadows from spec
const SHADOW_BASE =
  "0px 0px 1px rgba(0,0,0,0.32), 0px 0px 2px rgba(0,0,0,0.08), 0px 1px 3px rgba(0,0,0,0.08)";
const SHADOW_HOVER =
  "0px 0px 1px rgba(0,0,0,0.32), 0px 0px 3px rgba(0,0,0,0.11), 0px 1px 4px rgba(0,0,0,0.12)";
const SHADOW_FOCUS = "inset 0 0 0 1px #166ee1, 0 0 0 1px #166ee1";

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Email validation - disabled until valid email format
  const isEmailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  const handleGoogleSignIn = () => {
    void signIn("google", { callbackUrl: "/" });
  };

  const handleSSOSignIn = () => {
    // Placeholder - SSO not configured
  };

  const handleAppleSignIn = () => {
    // Placeholder - Apple not configured
  };

  const handleContinue = () => {
    void signIn("google", { callbackUrl: "/" });
  };

  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: "var(--at-font-body)" }}
    >
      {/* Container - centered, scrollable when content overflows */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          paddingTop: 5,
          paddingBottom: 20,
          paddingLeft: 20,
          paddingRight: 20,
          boxSizing: "border-box",
        }}
      >
        {/* Form content - fixed 512px width */}
        <div className="signup-form-content" style={{ width: 512, marginTop: 11 }}>
          {/* Logo */}
          <div className="signup-logo" style={{ marginBottom: 48, marginTop: -4 }}>
            <AirtableLogo width={40} />
          </div>

          {/* Welcome title */}
          <h1
            style={{
              fontFamily: "var(--at-font-heading)",
              width: 512,
              height: 88,
              fontSize: 31,
              fontWeight: 500,
              lineHeight: "40px",
              color: "#1D1F25",
              marginTop: 0,
              marginBottom: 0,
              marginLeft: 0,
              marginRight: 0,
              paddingTop: 3,
              paddingBottom: 0,
              boxSizing: "border-box",
            }}
          >
            Welcome to Airtable
          </h1>

          {/* Work email label */}
          <label
            htmlFor="email"
            style={{
              display: "block",
              fontSize: 15,
              fontWeight: 500,
              lineHeight: "18.75px",
              color: "#1D1F25",
              marginTop: 3,
              marginBottom: 8,
            }}
          >
            Work email
          </label>

          {/* Email input */}
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="name@company.com"
            autoComplete="email"
            style={{
              width: "100%",
              height: 40,
              borderRadius: 6,
              border: "none",
              backgroundColor: "white",
              padding: "4px 8px",
              fontSize: 15,
              color: "#1D1F25",
              outline: "none",
              boxShadow: isFocused ? SHADOW_FOCUS : SHADOW_BASE,
              boxSizing: "border-box",
              marginBottom: 24,
            }}
          />

          {/* Continue with email button */}
          <button
            type="button"
            disabled={!isEmailValid}
            onClick={handleContinue}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 6,
              backgroundColor: "#166ee1", // rgb(22, 110, 225)
              border: "none",
              boxShadow: SHADOW_BASE,
              opacity: !isEmailValid ? 0.5 : 1,
              cursor: !isEmailValid ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: 500,
              color: "white",
              marginBottom: 24,
            }}
          >
            <span style={{ transform: "translateY(-2px)" }}>Continue with email</span>
          </button>

          {/* Or divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 16,
              marginBottom: 24,
            }}
          >
            <span style={{ fontSize: 13, lineHeight: "16.25px", color: "#616670" }}>or</span>
          </div>

          {/* SSO Button */}
          <button
            type="button"
            onClick={handleSSOSignIn}
            onMouseEnter={() => setHoveredButton("sso")}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 6,
              backgroundColor: "white",
              border: "none",
              boxShadow: hoveredButton === "sso" ? SHADOW_HOVER : SHADOW_BASE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 15,
              lineHeight: "22px",
              padding: "2px 12px 3px",
              color: "#1D1F25",
              marginBottom: 16,
            }}
          >
            <span style={{ transform: "translateY(-1px)" }}>Continue with <span style={{ fontWeight: 600 }}>Single Sign On</span></span>
          </button>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            onMouseEnter={() => setHoveredButton("google")}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 6,
              backgroundColor: "white",
              border: "none",
              boxShadow: hoveredButton === "google" ? SHADOW_HOVER : SHADOW_BASE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 15,
              lineHeight: "22px",
              padding: "2px 12px 3px",
              color: "#1D1F25",
              marginBottom: 16,
            }}
          >
            <span style={{ transform: "translateY(-1px)", display: "flex", alignItems: "center", gap: 8 }}>
              <GoogleIcon size={16} />
              <span>Continue with <span style={{ fontWeight: 600 }}>Google</span></span>
            </span>
          </button>

          {/* Apple Button - wrapped in 512x50 container for spacing */}
          <div style={{ width: 512, height: 50 }}>
            <button
              type="button"
              onClick={handleAppleSignIn}
              onMouseEnter={() => setHoveredButton("apple")}
              onMouseLeave={() => setHoveredButton(null)}
              style={{
                width: "100%",
                height: 40,
                borderRadius: 6,
                backgroundColor: "white",
                border: "none",
                boxShadow: hoveredButton === "apple" ? SHADOW_HOVER : SHADOW_BASE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 15,
                lineHeight: "22px",
                padding: "2px 12px 3px",
                color: "#1D1F25",
              }}
            >
              <span style={{ transform: "translateY(-1px)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ transform: "translateY(-2px)" }}><AppleIcon size={16} /></span>
                <span>Continue with <span style={{ fontWeight: 600 }}>Apple</span></span>
              </span>
            </button>
          </div>

          {/* Terms text - indented to align with checkbox text below */}
          <p
            style={{
              fontSize: 13,
              lineHeight: "19px",
              color: "#616670",
              margin: 0,
              marginTop: 32,
              marginBottom: 16,
              paddingLeft: 24, // checkbox (16px) + margin (8px) = 24px
            }}
          >
            By creating an account, you agree to the{" "}
            <Link
              href="https://www.airtable.com/company/tos"
              style={{ color: "#166ee1", textDecoration: "underline", fontWeight: 500 }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="https://www.airtable.com/company/privacy"
              style={{ color: "#166ee1", textDecoration: "underline", fontWeight: 500 }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </Link>
            .
          </p>

          {/* Marketing checkbox - checkbox at left edge, text aligns with terms above */}
          <label
            className="signup-checkbox"
            style={{
              display: "flex",
              alignItems: "flex-start",
              cursor: "pointer",
              marginBottom: 8,
            }}
          >
            <div
              onClick={() => setMarketingOptIn(!marketingOptIn)}
              style={{
                width: 16,
                height: 16,
                marginTop: 4,
                marginRight: 8, // 16 + 8 = 24px, matches paddingLeft above
                flexShrink: 0,
                borderRadius: 3,
                border: marketingOptIn ? "none" : "2px solid #9299A4",
                backgroundColor: marketingOptIn ? "#166ee1" : "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              {marketingOptIn && (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="white">
                  <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
                </svg>
              )}
            </div>
            <span
              style={{
                fontSize: 13,
                lineHeight: "19px",
                color: "#616670",
              }}
            >
              By checking this box, you agree to receive marketing and sales communications
              about Airtable products, services, and events. You understand that you can
              manage your preferences at any time by following the instructions in the
              communications received.
            </span>
          </label>

          {/* Footer */}
          <p
            className="signup-footer"
            style={{
              fontSize: 13,
              lineHeight: "19px",
              color: "#616670",
              margin: 0,
            }}
          >
            Already have an account?{"\u00A0\u00A0"}
            <Link
              href="/sign-in"
              style={{ color: "#166ee1", textDecoration: "underline", fontWeight: 500 }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Responsive horizontal breakpoints */}
      <style>{`
        /* Tablet/small desktop (< 832px) */
        @media (max-width: 831px) {
          .signup-form-content {
            transform: translateY(-1.5px);
          }
          .signup-logo {
            margin-bottom: 41px !important; /* reduced from 48 */
            transform: translate(0px, 0px); /* moved 1px right, 1px down from previous */
          }
          .signup-form-content h1 {
            font-size: 24px !important;
            height: 68px !important; /* reduced from 73 */
          }
          .signup-checkbox {
            margin-bottom: 18px !important; /* increased from 8 */
          }
          .signup-footer {
            margin-top: 10px !important;
          }
        }
        
        /* Phone screens (< 640px) */
        @media (max-width: 639px) {
          .signup-form-content {
            width: calc(100vw - 40px) !important;
            max-width: 512px;
            transform: translateY(5px);
          }
          .signup-form-content h1 {
            font-size: 24px !important;
            line-height: 31.2px !important;
            height: 63px !important;
            padding-bottom: 32px !important;
            width: auto !important;
          }
          .signup-form-content input,
          .signup-form-content button,
          .signup-form-content > div {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
