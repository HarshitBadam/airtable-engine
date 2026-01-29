"use client";

/**
 * AuthShell - Layout wrapper for auth pages
 * Pixel-perfect match to Airtable's layout
 *
 * Layout (from DevTools at various viewport widths):
 * - >= 1152px: Two fluid columns (50% each), form left, promo right
 * - < 1152px: Single column, form centered
 * - Columns are fluid but content inside is fixed width (500px form, 395px promo)
 */

import { useEffect, useState } from "react";
import { PromoCard } from "./PromoCard";

interface AuthShellProps {
  children: React.ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  const [browser, setBrowser] = useState<"safari" | "chrome" | "">("");

  useEffect(() => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setBrowser(isSafari ? "safari" : "chrome");
  }, []);

  return (
    <div
      className={`min-h-screen bg-white ${browser ? `is-${browser}` : ""}`}
      style={{ fontFamily: "var(--at-font-body)" }}
    >
      {/* Full-page grid container */}
      <div
        className="auth-layout"
        style={{
          display: "grid",
          minHeight: "100vh",
          gridTemplateColumns: "1fr", // Single column by default
        }}
      >
        {/* Left: Form column - vertically centered with min 20px top margin */}
        <div
          className="form-column"
          style={{
            display: "flex",
            alignItems: "center",      // Center vertically
            justifyContent: "center",  // Center horizontally
            minHeight: "100vh",
            padding: "20px 0",         // Min 20px top/bottom margin
            boxSizing: "border-box",
          }}
        >
          <div className="flex flex-col">{children}</div>
        </div>

        {/* Right: Promo column - content CENTERED with top margin */}
        <div
          className="promo-column"
          style={{
            display: "none",
            alignItems: "center",     // Center vertically
            justifyContent: "center", // Center horizontally
            paddingTop: 48,           // Push down slightly to match Airtable
          }}
        >
          <PromoCard />
        </div>
      </div>

      {/* Media queries for responsive layout */}
      <style>{`
        /* Phone screens (< 832px) - narrower width */
        @media (max-width: 831px) {
          .sign-in-title {
            font-size: 24px !important;
            line-height: 32px !important;
            height: 32px !important;
            margin-top: 47px !important;
            margin-bottom: 47px !important;
            width: 360px !important;
          }
          .form-column button,
          .form-column input,
          .form-column label,
          .form-column p,
          .form-column h1,
          .form-column .w-\\[500px\\] {
            width: 360px !important;
          }
        }
        /* Tablet screens (832px - 1151px) - smaller title */
        @media (min-width: 832px) and (max-width: 1151px) {
          .sign-in-title {
            font-size: 24px !important;
            line-height: 32px !important;
            height: 32px !important;
            margin-top: 47px !important;
            margin-bottom: 47px !important;
          }
        }
        /* Large screens (>= 1152px) - two columns, promo visible */
        @media (min-width: 1152px) {
          .auth-layout {
            grid-template-columns: 1fr 1fr !important;
          }
          .promo-column {
            display: flex !important;
          }
        }
        
        /* Browser-specific styles - Safari (desktop) */
        .is-safari .logo-wrapper {
          margin-top: 20px;
        }
        .is-safari .footer-text {
          margin-top: 90px;
        }
        
        /* Browser-specific styles - Safari (phone < 832px) */
        @media (max-width: 831px) {
          .is-safari .logo-wrapper {
            margin-top: 0px;
          }
          .is-safari .footer-text {
            margin-top: 90px;
          }
        }
        
        /* Browser-specific styles - Chrome */
        .is-chrome .logo-wrapper {
          margin-top: 20px;
        }
        .is-chrome .footer-text {
          margin-top: 80px;
        }
      `}</style>
    </div>
  );
}
