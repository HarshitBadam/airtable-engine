"use client";

/**
 * PromoCard - Right side promotional card
 * Follows spec: w-395px, h-580px, radius 12px, bg-image from Airtable CDN
 * Visibility controlled by parent (hidden atPromo:block)
 * Hover: scale 1.05 with smooth transition
 */

import { useState } from "react";

export function PromoCard() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="h-[580px] w-[395px] cursor-pointer rounded-[12px] bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage:
          "url('https://static.airtable.com/images/sign_in_page/omni_signin_large@2x.png')",
        transition: "transform 0.2s ease-in-out",
        transform: isHovered ? "scale(1.03)" : "scale(1)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="img"
      aria-label="Meet Omni, your AI collaborator for building custom apps"
    />
  );
}
