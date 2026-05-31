"use client";

import { useEffect } from "react";

interface BrandingArgs {
  baseName: string;
  tableName: string;
  baseColor: string;
  baseTextColor: string;
}

const FAVICON_SIZE = 64;
const FAVICON_RADIUS = 14;
const FAVICON_FONT = "500 46px -apple-system, system-ui, 'Segoe UI', sans-serif";

function paintFaviconCanvas(
  canvas: HTMLCanvasElement,
  baseName: string,
  baseColor: string,
  baseTextColor: string,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const size = FAVICON_SIZE;
  const radius = FAVICON_RADIUS;

  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = baseColor;
  ctx.fill();

  ctx.fillStyle = baseTextColor;
  ctx.font = FAVICON_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(baseName.slice(0, 2), size / 2, size / 2 + 4);

  return canvas.toDataURL("image/png");
}

/**
 * Sets `document.title` and renders a base-coloured favicon with the base
 * initials. The favicon canvas is recreated whenever the base identity or
 * colour changes; the rest of the time this is a no-op.
 */
export function useDocumentBranding({
  baseName,
  tableName,
  baseColor,
  baseTextColor,
}: BrandingArgs) {
  useEffect(() => {
    if (baseName && baseName !== "Loading...") {
      document.title = `${baseName}: ${tableName} - Airtable`;
    } else {
      document.title = `${tableName} - Airtable`;
    }
  }, [baseName, tableName]);

  useEffect(() => {
    if (!baseName || baseName === "Loading...") return;

    const canvas = document.createElement("canvas");
    canvas.width = FAVICON_SIZE;
    canvas.height = FAVICON_SIZE;

    const dataUrl = paintFaviconCanvas(canvas, baseName, baseColor, baseTextColor);
    if (!dataUrl) return;

    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/png";
    link.href = dataUrl;
  }, [baseName, baseColor, baseTextColor]);
}
