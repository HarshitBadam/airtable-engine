"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { signOut, useSession } from "next-auth/react";
import { skipToken } from "@tanstack/react-query";
import styles from "./GridWorkspace.module.css";
import { api } from "~/trpc/react";
import { getBaseColor, getBaseBorderColor, getBaseTextColor, getBaseToolbarColor } from "~/components/bases/useBases";
import {
  UserIcon,
  UsersIcon,
  AirtablePlusFillIcon,
  BellIcon,
  TranslateIcon,
  PaletteIcon,
  EnvelopeSimpleIcon,
  UpsellStarIcon,
  LinkIcon,
  WrenchIcon,
  TrashIcon,
  SignOutIcon,
  ChevronDownIcon,
} from "~/components/home/Icons";

// ============================================
// ICONS (inline SVGs for Airtable-like UI)
// ============================================

// Airtable Logo Monochrome (for rail)
const AirtableLogoMonochrome = () => (
  <svg
    className={styles.logoIcon}
    width="24"
    height="20.3984"
    viewBox="0 0 200 170"
    fill="currentColor"
    aria-hidden="true"
    style={{ shapeRendering: "geometricPrecision" }}
  >
    <g>
      <path d="M90.0389,12.3675 L24.0799,39.6605 C20.4119,41.1785 20.4499,46.3885 24.1409,47.8515 L90.3759,74.1175 C96.1959,76.4255 102.6769,76.4255 108.4959,74.1175 L174.7319,47.8515 C178.4219,46.3885 178.4609,41.1785 174.7919,39.6605 L108.8339,12.3675 C102.8159,9.8775 96.0559,9.8775 90.0389,12.3675" />
      <path d="M105.3122,88.4608 L105.3122,154.0768 C105.3122,157.1978 108.4592,159.3348 111.3602,158.1848 L185.1662,129.5368 C186.8512,128.8688 187.9562,127.2408 187.9562,125.4288 L187.9562,59.8128 C187.9562,56.6918 184.8092,54.5548 181.9082,55.7048 L108.1022,84.3528 C106.4182,85.0208 105.3122,86.6488 105.3122,88.4608" />
      <path d="M88.0781,91.8464 L66.1741,102.4224 L63.9501,103.4974 L17.7121,125.6524 C14.7811,127.0664 11.0401,124.9304 11.0401,121.6744 L11.0401,60.0884 C11.0401,58.9104 11.6441,57.8934 12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464" />
      <path d="M88.0781,91.8464 L66.1741,102.4224 L12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464" />
    </g>
  </svg>
);

// Back arrow icon (shown on logo hover)
const IconBackArrow = () => (
  <svg
    className={styles.backArrowIcon}
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M5.64775 2.22725C5.86742 2.44692 5.86742 2.80308 5.64775 3.02275L3.233 5.4375H10.125C10.4357 5.4375 10.6875 5.68934 10.6875 6C10.6875 6.31066 10.4357 6.5625 10.125 6.5625H3.233L5.64775 8.97725C5.86742 9.19692 5.86742 9.55308 5.64775 9.77275C5.42808 9.99242 5.07192 9.99242 4.85225 9.77275L1.47725 6.39775C1.37176 6.29226 1.3125 6.14918 1.3125 6C1.3125 5.85082 1.37176 5.70774 1.47725 5.60225L4.85225 2.22725C5.07192 2.00758 5.42808 2.00758 5.64775 2.22725Z"
      fill="currentColor"
    />
  </svg>
);

// Omni icon for rail (second icon)
const IconOmni = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 1974 2048"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path transform="translate(1613,1514)" d="m0 0h18l10 4 21 16 9 6 13 10 12 11 13 13 9 13 6 14 4 18-1 13-5 10-8 11-7 10-12 16-9 11-21 21-10 7-10 5-15 4-16 2-14-6-10-6-16-10-10-8-12-11-17-17-9-11-6-9-6-12-1-4v-18l3-13 13-22 10-15 9-10 15-15 8-7 8-8 11-7 16-5z" fill="#26272C"/>
    <path transform="translate(963,1629)" d="m0 0h28l30 2 23 5 14 7 7 7 7 12 5 18 4 22 1 9v22l-1 3-2 33-5 13-6 10-11 12-11 7-11 4-14 2-18 1h-36l-22-2-13-3-12-6-10-9-6-7-6-12-3-14-3-24v-24l3-44 4-12 7-10 8-8 12-7 18-5z" fill="#AAACAD"/>
    <path transform="translate(713,1776)" d="m0 0h24l33 7 19 5 16 6 26 13 9 8 9 16 2 7v17l-5 27-5 19-4 15-9 25-6 15-9 8-19 10-11 5-8-1-11-3-28-6-11-1-9-4-30-10-15-9-8-8-7-12-5-17v-24l5-21 7-22 5-17 8-16 9-16 9-8 16-7z" fill="#26272C"/>
    <path transform="translate(347,1514)" d="m0 0h15l14 3 2-2h5l18 18 8 7 14 15 10 13 13 17 9 15 5 13 1 10-1 5 1 5-1 12-4 8-34 34-14 11-12 10-11 7-23 11-5 2h-12l-16-5-15-8-12-11-7-7-9-11-12-15-18-24-8-18-1-6 3-25 4-11 8-11 13-12 11-9 17-14 13-9 10-8 15-8z" fill="#26272C"/>
    <path transform="translate(539,261)" d="m0 0h15l18 8 10 7 10 10 26 39 7 11 9 17 6 18v17l-6 15-4 6-9 10-14 11-17 12-19 12-15 11-14 7-6 2h-12l-11-2-7-3-5 1h-7l-5-3-2-5-4-2-10-13-7-12-13-19-7-11-6-10-11-25-1-3v-13l2-6 2-12 7-12 11-12 9-8 15-11 18-11 19-10 6-4 16-5z" fill="#26272C"/>
    <path transform="translate(1654,882)" d="m0 0h20l14 5 11 7 6 7 6 12 6 18 8 38 3 20 1 22-3 16-8 16-7 8-5 4-12 6-21 7-26 5-23 3-20 1-16-2-13-5-13-11-9-14-6-14-5-19-5-30-2-18v-24l2-12 6-12 9-9 14-9 11-5 17-4 21-3z" fill="#AAACAD"/>
    <path transform="translate(1774,1095)" d="m0 0h21l47 5 18 2 13 4 10 4 9 7 9 10 9 14 3 16v13l-2 15-4 14v26l-8 28-6 10-10 11-8 6-15 9-14 1-8-3h-28l-4-2-11-2-8-2-10-1-11-3-4-2-15-2-8-7-9-11-9-17-3-11v-18l5-20v-23l5-22 5-14 7-13 5-6 13-10 12-5z" fill="#26272C"/>
    <path transform="translate(947,142)" d="m0 0h82l16 4 10 6 10 9 7 11 4 15 4 27 1 8v21l-2 5v34l-5 13-6 10-11 12-12 7-7 2h-20l-5 2-8 1h-35l-27-3-17-4-10-5-12-12-5-8-3-17-1-5-1-15-3-12 1-14 2-11v-33l4-14 7-11 11-11 11-7 9-3z" fill="#26272C"/>
    <path transform="translate(299,882)" d="m0 0h31l37 6 25 6 16 6 11 7 9 10 6 11 3 8 1 8v16l-6 55-4 17-5 13-7 11-9 8-17 9-9 3-6 1h-17l-27-3-29-5-17-4-14-7-10-9-10-14-5-11-1-5v-23l7-49 6-23 7-18 13-13 13-8z" fill="#AAACAD"/>
    <path transform="translate(188,1093)" d="m0 0 15 4 23 11 8 6 6 10 5 19 8 50 2 32-3 19-6 10-10 10-15 9-16 6-16 4-13 1-10-1-16 4-6 2h-19l-7-2h-8l-9-3-7-7-5-4-8-10-5-10-5-14-7-35-1-7-1-24-1-4v-16l4-12 10-19 8-7 14-7 16-4 24-4 24-3z" fill="#26272C"/>
    <path transform="translate(1244,1775)" d="m0 0h9l10 2 15 9 11 8 8 11 4 8 11 33 7 30 4 22 2 9-1 8-6 10-5 6-8 11-10 7-20 9-35 12-20 4-12 4h-17l-8-4-22-12-5-5-7-10-8-16-6-15-9-39-3-10v-9l-1-5v-8l5-13 9-19 8-9 10-6 10-4 39-9 20-6z" fill="#26272C"/>
    <path transform="translate(1755,622)" d="m0 0h19l13 4h7l6 3 9 8 7 10 12 22 9 21 13 41 1 5v18l-3 5-2 12-6 8-14 10-22 12-23 11-35 14-7 2h-15l-17-6-11-6-8-8-10-15-9-17-8-19-10-25-5-12-1-5v-14l4-14 2-12 9-10 10-8 15-9 24-11 23-7 12-4z" fill="#26272C"/>
    <path transform="translate(1137,345)" d="m0 0h16l17 4 41 12 19 7 16 8 10 7 7 8 7 14 1 3v20l-7 33-6 20-7 19-9 19-9 12-10 9-16 8-3 1h-11l-23-5-33-9-29-10-15-8-9-8-7-11-6-13-1-5v-14l5-25 10-35 7-20 7-14 9-12 8-7 11-5z" fill="#AAACAD"/>
    <path transform="translate(1334,1514)" d="m0 0h18l16 3 10 5 11 9 10 11 13 18 13 21 11 21 7 18 3 13-1 11-5 12-6 8-9 10-9 8-14 10-14 9-18 10-16 8-21 8-4 1h-7l-13-4-11-6-10-9-10-13-18-27-19-29-7-14-1-6v-9l3-19 5-12 6-8 15-12 17-12 26-17 20-13z" fill="#AAACAD"/>
    <path transform="translate(409,1238)" d="m0 0h13l13 5 11 8 10 10 10 15 11 21 11 28 9 28 2 13-2 11-7 12-11 12-10 8-20 12-25 12-25 9-21 6h-12l-16-8-10-7-8-8-8-13-15-32-11-28-7-21-1-5v-10l4-13 7-12 7-8 14-9 29-14 28-13 16-6z" fill="#AAACAD"/>
    <path transform="translate(834,344)" d="m0 0 10 1 8 5 10 9 8 8 8 13 7 15 11 33 7 30 1 5v19l-5 13-9 13-9 7-18 10-23 9-23 6-30 7h-16l-16-6-13-8-7-6-7-11-7-16-12-42-5-23-1-8v-10l2-11 9-16 8-10 11-7 20-9 24-8 45-10z" fill="#AAACAD"/>
    <path transform="translate(1469,537)" d="m0 0h8l24 4 10 5 13 11 19 19 7 8 11 13 11 15 9 16 4 9 1 4v9l-3 15-6 12-9 12-27 27-8 7-11 10-17 13-14 7-3 1h-9l-18-4-12-5-10-7-10-9-12-13-9-11-14-17-10-14-8-16-2-8v-20l3-12 5-10 8-10 11-9 14-12 12-11 14-11 13-10z" fill="#AAACAD"/>
    <path transform="translate(1431,261)" d="m0 0h14l16 8 9 6 9 8 14 8 13 8 14 12 10 9 7 11 6 13 2 8-1 13-5 11 3 1-3 8-12 16-8 16-13 16-7 11-3 7-6 9-15 10-12 3h-8l-4 1-9 1-19-10-23-11-17-10-11-9-14-12-11-10-7-10-4-12-1-11-1-3v-11l4-9 1-2h2l2-5 8-18 10-17 10-19 13-13 8-7 9-8 8-4 8-1h7z" fill="#26272C"/>
    <path transform="translate(204,621)" d="m0 0 14 1 19 5 25 12 29 14 17 9 6 5 7 11 5 10 2 9v17l-3 8-3 15-8 20-8 14-8 17-8 16-7 10-13 8-16 6h-15l-28-7-18-8-16-8-33-17-10-9-7-12-4-11-1-6v-11l3-16 5-15 9-20 21-42 9-12 14-8 12-4z" fill="#26272C"/>
    <path transform="translate(615,1513)" d="m0 0h8l15 4 24 11 20 11 21 14 13 10 10 9 6 10 7 18 2 8v7l-3 10-14 29-10 17-13 19-10 14-8 9-21 11-11 4h-10l-17-5-17-9-23-16-17-11-14-11-12-11-5-7-4-12-3-18v-10l4-11 8-15 12-17 19-28 14-15 7-7 11-7z" fill="#AAACAD"/>
    <path transform="translate(1561,1236)" d="m0 0 5 1 10 5 29 9 21 9 19 10 12 9 8 7 10 13 6 13 2 7v10l-5 21-8 20-8 17-10 19-12 23-5 6-32 12h-14l-17-5-38-18-18-8-13-9-10-8-8-10-7-15-3-12v-8l4-15 9-21 16-33 11-20 7-9 8-7 12-6 17-6z" fill="#AAACAD"/>
    <path transform="translate(482,537)" d="m0 0h9l15 4 16 8 10 7 10 8 16 13 14 12 10 10 9 12 8 16 2 7v13l-5 17-10 16-11 13-9 11-9 10-9 11-12 12-10 7-15 8-6 2h-12l-13-5-15-8-11-8-14-12-12-11-10-9-14-14-9-13-5-11-2-10v-9l4-16 6-14 10-13 19-19 7-8 12-13 12-11 15-9z" fill="#AAACAD"/>
  </svg>
);

// Help icon (question mark in circle)
const IconHelp = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    style={{ shapeRendering: "geometricPrecision" }}
  >
    <path
      fillRule="nonzero"
      d="M8.07349 4.50134C7.75062 4.49155 7.43049 4.55078 7.13904 4.67151C6.36183 4.99344 5.75017 5.76895 5.75 6.74988C5.74997 6.88249 5.80262 7.00968 5.89636 7.10347C5.99011 7.19726 6.11727 7.24997 6.24988 7.25C6.31554 7.25002 6.38056 7.2371 6.44123 7.21199C6.5019 7.18687 6.55703 7.15006 6.60347 7.10364C6.64991 7.05722 6.68675 7.00211 6.71189 6.94145C6.73704 6.8808 6.74998 6.81578 6.75 6.75012C6.75013 6.17215 7.08092 5.77793 7.52173 5.59534C7.96254 5.41275 8.47515 5.45759 8.88391 5.86621C9.24251 6.22468 9.34907 6.75995 9.15503 7.22839C8.96099 7.69684 8.50716 8.00009 8.00012 8C7.93445 7.99999 7.86942 8.01292 7.80875 8.03804C7.74808 8.06316 7.69295 8.09999 7.6465 8.14642C7.60006 8.19285 7.56322 8.24797 7.53809 8.30864C7.51295 8.36931 7.50001 8.43433 7.5 8.5V9C7.5 9.13261 7.55268 9.25979 7.64645 9.35355C7.74021 9.44732 7.86739 9.5 8 9.5C8.13261 9.5 8.25979 9.44732 8.35355 9.35355C8.44732 9.25979 8.5 9.13261 8.5 9V8.93738C9.1999 8.77686 9.79665 8.2924 10.0789 7.61108C10.4266 6.77156 10.2336 5.80137 9.59094 5.15894C9.15735 4.7255 8.61159 4.51766 8.07349 4.50134Z M8 12C8.41419 12 8.75 11.6642 8.75 11.25C8.75 10.8358 8.41419 10.5 8 10.5C7.58581 10.5 7.25 10.8358 7.25 11.25C7.25 11.6642 7.58581 12 8 12Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z"
    />
  </svg>
);

// Bell icon
const IconBell = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    style={{ shapeRendering: "geometricPrecision" }}
  >
    <path
      fillRule="nonzero"
      d="M6 11.5C5.86739 11.5 5.74021 11.5527 5.64645 11.6464C5.55268 11.7402 5.5 11.8674 5.5 12V12.5C5.49987 13.8749 6.62514 15.0001 8 15C8.66281 15 9.29903 14.7365 9.7677 14.2678C10.2364 13.7991 10.5 13.1628 10.5 12.5V12C10.5 11.8674 10.4473 11.7402 10.3536 11.6464C10.2598 11.5527 10.1326 11.5 10 11.5C9.86739 11.5 9.74021 11.5527 9.64645 11.6464C9.55268 11.7402 9.5 11.8674 9.5 12V12.5C9.50001 12.898 9.34212 13.2793 9.06067 13.5607C8.77926 13.8421 8.398 14 8 14C7.16564 14.0001 6.49992 13.3344 6.5 12.5V12C6.5 11.8674 6.44732 11.7402 6.35355 11.6464C6.25978 11.5527 6.13261 11.5 6 11.5Z M8.03394 1.50012C5.26871 1.48474 3.00893 3.73483 3.01245 6.5V7.00014C3.01245 9.16781 2.56115 10.3731 2.19849 10.9995V10.9995C2.11088 11.1513 2.06437 11.324 2.06421 11.4992C2.06387 12.0445 2.51528 12.498 3.06055 12.5L3.06238 12.5002H12.9374L12.9392 12.5C13.1144 12.4994 13.2863 12.4529 13.4377 12.3649C13.9096 12.0911 14.0746 11.4723 13.8016 10.9999V10.9999C13.4389 10.3735 12.9874 9.16781 12.9874 7.00015V6.5563C12.9874 3.80889 10.7849 1.52098 8.03503 1.50015L8.03394 1.50012ZM8.02734 2.5V2.5C10.2272 2.51694 11.9874 4.34136 11.9874 6.55628V7.00012C11.9874 9.30695 12.4736 10.7013 12.9358 11.5C12.9358 11.5 12.9383 11.4986 12.9358 11.5L3.06434 11.5001V11.5001C3.52659 10.7015 4.01246 9.30699 4.01246 7.00013V6.50013V6.50013C4.00929 4.27789 5.80529 2.48824 8.02734 2.5Z"
    />
  </svg>
);

const IconGrid = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={styles.viewIcon}>
    <path d="M1 2.5A1.5 1.5 0 012.5 1h11A1.5 1.5 0 0115 2.5v11a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 13.5v-11zM2.5 2a.5.5 0 00-.5.5V6h4V2H2.5zM6 7H2v3h4V7zm1 3h3V7H7v3zm4 0h3V7h-3v3zm3-4V2.5a.5.5 0 00-.5-.5H11v4h3zM10 2H7v4h3V2zM7 11v3h3v-3H7zm4 3v-3h3v2.5a.5.5 0 01-.5.5H11zM6 14v-3H2v2.5a.5.5 0 00.5.5H6z"/>
  </svg>
);

const IconChevronLeft = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 010 .708L5.707 8l5.647 5.646a.5.5 0 01-.708.708l-6-6a.5.5 0 010-.708l6-6a.5.5 0 01.708 0z"/>
  </svg>
);

const IconChevronRight = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 01.708 0l6 6a.5.5 0 010 .708l-6 6a.5.5 0 01-.708-.708L10.293 8 4.646 2.354a.5.5 0 010-.708z"/>
  </svg>
);

const IconPlus = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
    <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/>
  </svg>
);

// Magnifying Glass icon for search
const IconMagnifyingGlass = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path fillRule="nonzero" d="M7.25 1.5C4.08028 1.5 1.5 4.08028 1.5 7.25C1.5 10.4197 4.08028 13 7.25 13C8.65529 13 9.94315 12.4911 10.9432 11.6503L13.6465 14.3534C13.7402 14.4471 13.8674 14.4998 14 14.4998C14.1326 14.4998 14.2598 14.4471 14.3535 14.3534C14.4473 14.2596 14.4999 14.1325 14.4999 13.9999C14.4999 13.8673 14.4473 13.7401 14.3535 13.6464L11.6504 10.9431C12.4912 9.94305 13 8.65523 13 7.25C13 4.08028 10.4197 1.5 7.25 1.5ZM7.25 2.5C9.87928 2.5 12 4.62072 12 7.25C12 8.56227 11.4715 9.74761 10.6154 10.6061C10.6132 10.607 10.611 10.6079 10.6089 10.6088C10.608 10.611 10.6071 10.6132 10.6062 10.6154C9.74772 11.4715 8.5623 12 7.25 12C4.62072 12 2.5 9.87928 2.5 7.25C2.5 4.62072 4.62072 2.5 7.25 2.5Z" />
  </svg>
);

// Dots Six Vertical icon for drag handle
const IconDotsSixVertical = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path fillRule="nonzero" d="M5.75 4.5C6.16419 4.5 6.5 4.16419 6.5 3.75C6.5 3.33581 6.16419 3 5.75 3C5.33581 3 5 3.33581 5 3.75C5 4.16419 5.33581 4.5 5.75 4.5Z M10.25 4.5C10.6642 4.5 11 4.16419 11 3.75C11 3.33581 10.6642 3 10.25 3C9.83581 3 9.5 3.33581 9.5 3.75C9.5 4.16419 9.83581 4.5 10.25 4.5Z M5.75 8.75C6.16419 8.75 6.5 8.41419 6.5 8C6.5 7.58581 6.16419 7.25 5.75 7.25C5.33581 7.25 5 7.58581 5 8C5 8.41419 5.33581 8.75 5.75 8.75Z M10.25 8.75C10.6642 8.75 11 8.41419 11 8C11 7.58581 10.6642 7.25 10.25 7.25C9.83581 7.25 9.5 7.58581 9.5 8C9.5 8.41419 9.83581 8.75 10.25 8.75Z M5.75 13C6.16419 13 6.5 12.6642 6.5 12.25C6.5 11.8358 6.16419 11.5 5.75 11.5C5.33581 11.5 5 11.8358 5 12.25C5 12.6642 5.33581 13 5.75 13Z M10.25 13C10.6642 13 11 12.6642 11 12.25C11 11.8358 10.6642 11.5 10.25 11.5C9.83581 11.5 9.5 11.8358 9.5 12.25C9.5 12.6642 9.83581 13 10.25 13Z" />
  </svg>
);

// Check icon for active/current table
const IconCheck = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
    <path
      fillRule="nonzero"
      d="M13.5 4C13.3674 4.00002 13.2402 4.05271 13.1465 4.14648L6.49999 10.793L3.3535 7.64648C3.25974 7.55274 3.13258 7.50008 2.99999 7.50008C2.8674 7.50008 2.74023 7.55274 2.64647 7.64648C2.55272 7.74025 2.50006 7.86741 2.50006 8C2.50006 8.13259 2.55272 8.25975 2.64647 8.35352L6.14647 11.8535C6.24024 11.9472 6.3674 11.9999 6.49999 11.9999C6.63257 11.9999 6.75973 11.9472 6.8535 11.8535L13.8535 4.85352C13.9472 4.75975 13.9999 4.63259 13.9999 4.5C13.9999 4.36741 13.9472 4.24025 13.8535 4.14648C13.7597 4.05271 13.6326 4.00002 13.5 4Z"
    />
  </svg>
);

// Eye Slash icon for hide action on hover
const IconEyeSlash = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path fillRule="nonzero" d="M8.00013 2.99999C7.53899 2.99917 7.07864 3.03701 6.62379 3.11315C6.55902 3.12398 6.49703 3.14747 6.44134 3.18226C6.38565 3.21706 6.33736 3.26248 6.29923 3.31594C6.2611 3.3694 6.23387 3.42984 6.2191 3.49382C6.20433 3.5578 6.2023 3.62407 6.21314 3.68883C6.23505 3.81961 6.30801 3.93632 6.41597 4.01331C6.52393 4.0903 6.65805 4.12125 6.78883 4.09935C7.18869 4.03242 7.59357 3.99923 7.99915 3.99999C7.99882 3.99999 7.99948 3.99999 7.99915 3.99999C12.083 3.99999 14.0065 7.16727 14.4415 7.99926C14.2327 8.39403 13.6815 9.3219 12.7042 10.196C12.6553 10.2398 12.6154 10.2928 12.587 10.352C12.5585 10.4112 12.542 10.4754 12.5383 10.5409C12.5347 10.6065 12.544 10.6721 12.5657 10.7341C12.5874 10.7961 12.6211 10.8531 12.6649 10.9021C12.7533 11.0009 12.8774 11.0606 13.0097 11.0679C13.1421 11.0753 13.272 11.0298 13.3709 10.9414C14.8157 9.64896 15.4569 8.20311 15.4569 8.20311C15.4853 8.13917 15.5 8.06997 15.5 7.99999C15.5 7.93001 15.4853 7.86081 15.4569 7.79686C15.4569 7.79686 13.2994 3.00052 8.00013 2.99999Z M8.56177 5.05248C8.4315 5.02783 8.29677 5.05593 8.18721 5.1306C8.07765 5.20527 8.00223 5.3204 7.97755 5.45067C7.96532 5.51519 7.96592 5.58148 7.97932 5.64576C7.99271 5.71004 8.01864 5.77106 8.05562 5.82532C8.09259 5.87958 8.13989 5.92603 8.19482 5.96201C8.24975 5.99799 8.31122 6.0228 8.37574 6.03502C9.25118 6.20086 9.90696 6.92166 9.98963 7.80883C9.99573 7.87421 10.0146 7.93775 10.0453 7.99582C10.076 8.05389 10.1177 8.10536 10.1683 8.14727C10.2188 8.18919 10.2771 8.22074 10.3399 8.24013C10.4026 8.25951 10.4686 8.26635 10.5339 8.26024C10.666 8.24793 10.7877 8.18368 10.8723 8.08163C10.957 7.97958 10.9976 7.84808 10.9854 7.71605C10.8617 6.38949 9.8708 5.30045 8.56177 5.05248Z M3.02381 2.0006C2.89137 1.99428 2.76183 2.04082 2.6637 2.12999C2.56557 2.21919 2.5069 2.34371 2.50058 2.47617C2.49426 2.60862 2.54082 2.73816 2.63001 2.83629L5.64234 6.14989C4.99783 6.97182 4.81667 8.0854 5.20167 9.08153C5.64782 10.2359 6.7614 10.9994 7.99891 10.9997C8.57697 11.0018 9.13723 10.8317 9.61744 10.5226L12.63 13.8363C12.7192 13.9344 12.8437 13.9931 12.9762 13.9994C13.1086 14.0057 13.2382 13.9592 13.3363 13.87C13.4344 13.7808 13.4931 13.6563 13.4994 13.5238C13.5058 13.3914 13.4592 13.2618 13.37 13.1637L6.6908 5.81652C6.69016 5.81554 6.68951 5.81456 6.68885 5.81359C6.6884 5.81338 6.68796 5.81318 6.68751 5.81298L3.37 2.16369C3.2808 2.06557 3.15627 2.0069 3.02381 2.0006ZM4.78126 3.81261C4.65529 3.7712 4.51803 3.78151 4.39966 3.8413C1.67465 5.21716 0.542853 7.79748 0.542853 7.79748C0.514536 7.86137 0.499927 7.93049 0.49997 8.00038C0.500012 8.07027 0.514704 8.13938 0.543098 8.20324C0.543098 8.20324 2.69954 12.9988 7.99805 13C9.24842 13.0098 10.4832 12.7217 11.6 12.1592C11.6586 12.1296 11.7109 12.0888 11.7537 12.0391C11.7966 11.9893 11.8293 11.9317 11.8498 11.8693C11.8704 11.8069 11.8785 11.7411 11.8736 11.6757C11.8688 11.6102 11.8511 11.5463 11.8215 11.4877C11.792 11.429 11.7512 11.3768 11.7015 11.3339C11.6517 11.291 11.594 11.2584 11.5317 11.2378C11.4693 11.2172 11.4035 11.2091 11.338 11.214C11.2726 11.2189 11.2087 11.2366 11.15 11.2661C10.1746 11.7574 9.09616 12.009 8.00403 12.0001C8.00269 12.0001 8.00135 12.0001 8.00001 12.0001C3.9214 12.0001 1.99934 8.84205 1.56104 8.00512C1.80002 7.53467 2.78966 5.77445 4.85035 4.734C4.90897 4.7044 4.96118 4.66355 5.00401 4.61377C5.04684 4.56399 5.07944 4.50626 5.09996 4.44389C5.12048 4.38151 5.12851 4.3157 5.12359 4.25021C5.11867 4.18473 5.1009 4.12086 5.0713 4.06225C5.01154 3.94387 4.90721 3.85407 4.78126 3.81261ZM6.3307 6.90709L8.92811 9.76427C8.64391 9.91434 8.32855 10.0011 8.00196 9.99987C8.00131 9.99987 8.00066 9.99987 8.00001 9.99987C7.17209 9.99993 6.43288 9.49318 6.13441 8.72094C5.89804 8.10936 5.98275 7.43768 6.3307 6.90709Z" />
  </svg>
);

const IconHide = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={styles.toolbarIcon}>
    <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 00-2.79.588l.77.771A5.944 5.944 0 018 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
    <path d="M11.297 9.176a3.5 3.5 0 00-4.474-4.474l.823.823a2.5 2.5 0 012.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 01-4.474-4.474l.823.823a2.5 2.5 0 002.829 2.829z"/>
    <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 001.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 018 13.5C3 13.5 0 8 0 8s.939-1.72 2.641-3.238l.708.709z"/>
    <path fillRule="evenodd" d="M13.646 14.354l-12-12 .708-.708 12 12-.708.708z"/>
  </svg>
);

const IconFilter = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={styles.toolbarIcon}>
    <path d="M6 10.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zm-2-3a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm-2-3a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11a.5.5 0 01-.5-.5z"/>
  </svg>
);

const IconSort = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={styles.toolbarIcon}>
    <path d="M3.5 2.5a.5.5 0 00-1 0v8.793l-1.146-1.147a.5.5 0 00-.708.708l2 2a.5.5 0 00.708 0l2-2a.5.5 0 00-.708-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zM7.5 6a.5.5 0 000 1h5a.5.5 0 000-1h-5zm0 3a.5.5 0 000 1h3a.5.5 0 000-1h-3zm0 3a.5.5 0 000 1h1a.5.5 0 000-1h-1z"/>
  </svg>
);

const IconGroup = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={styles.toolbarIcon}>
    <path d="M14 1a1 1 0 011 1v12a1 1 0 01-1 1H2a1 1 0 01-1-1V2a1 1 0 011-1h12zM2 0a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V2a2 2 0 00-2-2H2z"/>
    <path d="M3 4a1 1 0 011-1h8a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 0v2h8V4H4zM3 9a1 1 0 011-1h8a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V9zm1 0v2h8V9H4z"/>
  </svg>
);

const IconSearch = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
    <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/>
  </svg>
);

const IconText = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={styles.columnIcon}>
    <path d="M2.5 3h11a.5.5 0 010 1h-11a.5.5 0 010-1zm0 3h7a.5.5 0 010 1h-7a.5.5 0 010-1zm0 3h9a.5.5 0 010 1h-9a.5.5 0 010-1zm0 3h5a.5.5 0 010 1h-5a.5.5 0 010-1z"/>
  </svg>
);

const IconNumber = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={styles.columnIcon}>
    <path d="M2.5 4.5h2v7h-1v-6h-1v-1zm4.5.5h1.5c.83 0 1.5.67 1.5 1.5v1c0 .83-.67 1.5-1.5 1.5H8v2h2v1H7V5.5C7 5.22 7.22 5 7.5 5h1c.28 0 .5.22.5.5v1c0 .28-.22.5-.5.5H8V5zm5 0h1.5c.83 0 1.5.67 1.5 1.5v4c0 .83-.67 1.5-1.5 1.5H12V5.5c0-.28.22-.5.5-.5h1c.28 0 .5.22.5.5v4c0 .28-.22.5-.5.5H13v1h-1V5z"/>
  </svg>
);

const IconTable = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={styles.tableTabIcon}>
    <path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm15 2h-4v3h4V4zm0 4h-4v3h4V8zm0 4h-4v3h3a1 1 0 001-1v-2zm-5 3v-3H6v3h4zm-5 0v-3H1v2a1 1 0 001 1h3zm-4-4h4V8H1v3zm0-4h4V4H1v3zm5-3v3h4V4H6zm4 4H6v3h4V8z"/>
  </svg>
);

// Base Icon Logo (white version for colored background)
const IconBaseLogo = ({ style }: { style?: React.CSSProperties }) => (
  <svg
    className={styles.baseIconSvg}
    viewBox="0 0 200 170"
    fill="currentColor"
    aria-hidden="true"
    style={style}
  >
    <g>
      <path d="M90.0389,12.3675 L24.0799,39.6605 C20.4119,41.1785 20.4499,46.3885 24.1409,47.8515 L90.3759,74.1175 C96.1959,76.4255 102.6769,76.4255 108.4959,74.1175 L174.7319,47.8515 C178.4219,46.3885 178.4609,41.1785 174.7919,39.6605 L108.8339,12.3675 C102.8159,9.8775 96.0559,9.8775 90.0389,12.3675" />
      <path d="M105.3122,88.4608 L105.3122,154.0768 C105.3122,157.1978 108.4592,159.3348 111.3602,158.1848 L185.1662,129.5368 C186.8512,128.8688 187.9562,127.2408 187.9562,125.4288 L187.9562,59.8128 C187.9562,56.6918 184.8092,54.5548 181.9082,55.7048 L108.1022,84.3528 C106.4182,85.0208 105.3122,86.6488 105.3122,88.4608" />
      <path d="M88.0781,91.8464 L66.1741,102.4224 L63.9501,103.4974 L17.7121,125.6524 C14.7811,127.0664 11.0401,124.9304 11.0401,121.6744 L11.0401,60.0884 C11.0401,58.9104 11.6441,57.8934 12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464" />
      <path d="M88.0781,91.8464 L66.1741,102.4224 L12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464" />
    </g>
  </svg>
);

// Chevron Down icon for dropdown
const IconChevronDown = () => (
  <svg
    className={styles.baseDropdownIcon}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="nonzero"
      d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z"
    />
  </svg>
);

// Sidebar Play icon for Launch button
const IconSidebarPlay = () => (
  <svg
    className={styles.topBarLaunchIcon}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M13.5 2.5c.546 0 1 .454 1 1v4a.5.5 0 0 1-1 0v-4H6v9h2.5a.5.5 0 0 1 0 1h-6c-.546 0-1-.454-1-1v-9c0-.546.454-1 1-1h11Zm-11 1v9H5v-9H2.5Z M11.124 8.67a.5.5 0 0 1 .653-.086l3 2a.5.5 0 0 1 0 .832l-3 2A.5.5 0 0 1 11 13V9a.5.5 0 0 1 .124-.33Z"
    />
  </svg>
);

// Clock Counter Clockwise icon for History button
const IconClockCounterClockwise = () => (
  <svg
    className={styles.topBarHistoryIcon}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="nonzero"
      d="M8.13367 2.0017C6.52708 1.96745 4.93757 2.57928 3.75879 3.75902L1.63452 5.87719C1.54063 5.97081 1.48777 6.09789 1.48756 6.23048C1.48736 6.36307 1.53982 6.49031 1.63342 6.58422C1.67978 6.63073 1.73485 6.66765 1.79547 6.69287C1.8561 6.7181 1.92111 6.73114 1.98677 6.73124C2.05244 6.73134 2.11748 6.71851 2.17819 6.69347C2.23889 6.66843 2.29407 6.63168 2.34058 6.58532L4.46558 4.46654C4.46537 4.46675 4.46578 4.46634 4.46558 4.46654C5.89626 3.03469 8.04552 2.60602 9.91565 3.38024C11.7858 4.15445 13.0029 5.97586 13.0029 7.99999C13.0029 10.0241 11.7858 11.8455 9.91565 12.6197C8.04552 13.394 5.89687 12.9659 4.46619 11.534C4.41977 11.4876 4.36466 11.4507 4.30401 11.4256C4.24335 11.4004 4.17833 11.3875 4.11266 11.3875C4.047 11.3874 3.98197 11.4003 3.92129 11.4255C3.86062 11.4506 3.80548 11.4874 3.75903 11.5338C3.71258 11.5802 3.67573 11.6353 3.65057 11.696C3.62542 11.7566 3.61246 11.8217 3.61244 11.8873C3.61242 11.953 3.62533 12.018 3.65044 12.0787C3.67555 12.1394 3.71237 12.1945 3.75879 12.241C5.47337 13.9569 8.05683 14.4715 10.2981 13.5437C12.5394 12.6158 14.0029 10.4257 14.0029 7.99998C14.0029 5.57424 12.5394 3.38414 10.2981 2.45628C9.5977 2.16633 8.86394 2.01727 8.13367 2.0017Z M1.98755 3.23119C1.85494 3.23119 1.72776 3.28387 1.634 3.37764C1.54023 3.47141 1.48755 3.59858 1.48755 3.73119L1.48756 6.23048C1.48736 6.36307 1.53982 6.49031 1.63342 6.58422C1.72719 6.67799 1.85416 6.73123 1.98677 6.73124L4.48755 6.73119C4.55321 6.73119 4.61823 6.71826 4.67889 6.69313C4.73955 6.668 4.79467 6.63117 4.8411 6.58474C4.88753 6.53832 4.92436 6.4832 4.94949 6.42253C4.97462 6.36187 4.98755 6.29685 4.98755 6.23119C4.98755 6.09858 4.93487 5.97141 4.8411 5.87764C4.74733 5.78387 4.62016 5.73119 4.48755 5.73119H2.48755V3.73119C2.48755 3.59858 2.43487 3.47141 2.3411 3.37764C2.24733 3.28387 2.12016 3.23119 1.98755 3.23119Z M8 4.49999C7.86739 4.49999 7.74021 4.55267 7.64645 4.64644C7.55268 4.7402 7.5 4.86738 7.5 4.99999V7.99999C7.50721 8.02138 7.51585 8.04226 7.52588 8.06249C7.53865 8.12323 7.56262 8.18106 7.59656 8.23302C7.62459 8.28835 7.66267 8.33799 7.70886 8.37938C7.72139 8.3982 7.73517 8.41614 7.75012 8.4331L10.3501 9.9331C10.407 9.96591 10.4698 9.98721 10.5349 9.99576C10.6 10.0043 10.6661 9.99995 10.7295 9.98294C10.793 9.96593 10.8524 9.93659 10.9045 9.89659C10.9566 9.8566 11.0003 9.80675 11.0331 9.74987C11.0659 9.69299 11.0872 9.63021 11.0957 9.5651C11.1043 9.5 11.0999 9.43385 11.0829 9.37043C11.0659 9.30701 11.0366 9.24756 10.9966 9.19547C10.9566 9.14339 10.9067 9.0997 10.8499 9.06688L8.5 7.71117V4.99999C8.5 4.86738 8.44732 4.7402 8.35355 4.64644C8.25979 4.55267 8.13261 4.49999 8 4.49999Z"
    />
  </svg>
);

// ============================================
// MAIN COMPONENT
// ============================================

interface GridWorkspaceProps {
  baseId: string;
  tableId: string;
}

// Type for UI-only table management
interface TableItem {
  id: string;
  name: string;
}

export function GridWorkspace({ baseId, tableId }: GridWorkspaceProps) {
  // === LOCAL STATE ===
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isTableDropdownOpen, setIsTableDropdownOpen] = useState(false);
  const [isAddOrImportDropdownOpen, setIsAddOrImportDropdownOpen] = useState(false);
  const [isTableTitleDropdownOpen, setIsTableTitleDropdownOpen] = useState(false);
  const [tableTitleDropdownPosition, setTableTitleDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [addOrImportDropdownPosition, setAddOrImportDropdownPosition] = useState<{
    top?: number;
    left?: number;
    right?: number;
    openLeft?: boolean;
  } | null>(null);
  const [addOrImportOpenedFromTableDropdown, setAddOrImportOpenedFromTableDropdown] = useState(false);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [tableDropdownAlignRight, setTableDropdownAlignRight] = useState(false);
  
  // UI-only table management state
  const [tables, setTables] = useState<TableItem[]>([
    { id: '1', name: 'Table 1' }
  ]);
  const [activeTableId, setActiveTableId] = useState('1');
  const [tableCounter, setTableCounter] = useState(1);
  
  // Table rename popup state
  const [isRenamePopupOpen, setIsRenamePopupOpen] = useState(false);
  const [renamePopupPosition, setRenamePopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [renameTableName, setRenameTableName] = useState('');
  const [renameRecordName, setRenameRecordName] = useState('Record');
  
  // Clear data modal state
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  
  // Delete table popup state
  const [isDeleteTablePopupOpen, setIsDeleteTablePopupOpen] = useState(false);
  const [deleteTablePopupPosition, setDeleteTablePopupPosition] = useState<{ top: number; left: number } | null>(null);

  // View dropdown menu state (Grid view chevron dropdown)
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);

  // Add a new table and open rename popup
  const handleAddTable = () => {
    const newId = String(tableCounter + 1);
    const newName = `Table ${tableCounter + 1}`;
    setTables(prev => [...prev, { id: newId, name: newName }]);
    setActiveTableId(newId);
    setTableCounter(prev => prev + 1);
    
    // Open rename popup after a short delay to allow DOM to update
    setTimeout(() => {
      const newTabButton = document.querySelector(`[data-table-id="${newId}"]`);
      if (newTabButton) {
        const tabRect = newTabButton.getBoundingClientRect();
        const transformOffset = 71; // CSS transform: translateX(-72px)
        const minLeftMargin = 8; // Minimum distance from left edge of viewport
        
        // Calculate left position, ensuring popup stays at least 12px from left edge
        // Since transform shifts -70px, we need left >= 82 to maintain 12px margin
        const minLeft = minLeftMargin + transformOffset;
        const left = Math.max(tabRect.left, minLeft);
        
        setRenamePopupPosition({
          top: tabRect.bottom + 8,
          left: left,
        });
        setRenameTableName(newName);
        setRenameRecordName('Record');
        setIsRenamePopupOpen(true);
      }
    }, 50);
  };
  
  // Handle opening rename popup from dropdown menu
  const handleOpenRenamePopup = () => {
    const activeTable = tables.find(t => t.id === activeTableId);
    if (activeTable && tableTitleDropdownButtonRef.current) {
      const parentTab = tableTitleDropdownButtonRef.current.closest(`.${styles.tableTab}`);
      if (parentTab) {
        const tabRect = parentTab.getBoundingClientRect();
        const transformOffset = 72; // CSS transform: translateX(-72px)
        const minLeftMargin = 8; // Minimum distance from left edge of viewport
        
        // Calculate left position, ensuring popup stays at least 12px from left edge
        // Since transform shifts -70px, we need left >= 82 to maintain 12px margin
        const minLeft = minLeftMargin + transformOffset;
        const left = Math.max(tabRect.left, minLeft);
        
        setRenamePopupPosition({
          top: tabRect.bottom + 8,
          left: left,
        });
        setRenameTableName(activeTable.name);
        setRenameRecordName('Record');
        setIsRenamePopupOpen(true);
        setIsTableTitleDropdownOpen(false);
      }
    }
  };
  
  // Handle save rename
  const handleSaveRename = () => {
    if (renameTableName.trim()) {
      setTables(prev => prev.map(t => 
        t.id === activeTableId ? { ...t, name: renameTableName.trim() } : t
      ));
    }
    setIsRenamePopupOpen(false);
    setRenamePopupPosition(null);
  };
  
  // Handle cancel rename
  const handleCancelRename = () => {
    setIsRenamePopupOpen(false);
    setRenamePopupPosition(null);
  };
  
  // Handle opening clear data modal
  const handleOpenClearDataModal = () => {
    setIsTableTitleDropdownOpen(false);
    setIsClearDataModalOpen(true);
  };
  
  // Handle closing clear data modal
  const handleCloseClearDataModal = () => {
    setIsClearDataModalOpen(false);
  };
  
  // Handle confirming clear data
  const handleClearData = () => {
    // TODO: Implement actual data clearing logic
    // For now, just close the modal
    setIsClearDataModalOpen(false);
  };
  
  // Handle opening delete table popup
  const handleOpenDeleteTablePopup = (event: React.MouseEvent<HTMLLIElement>) => {
    // Only allow if more than 1 table exists
    if (tables.length <= 1) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    setDeleteTablePopupPosition({
      top: rect.bottom + 8 - 439,
      left: rect.left - 12,
    });
    setIsTableTitleDropdownOpen(false);
    setIsDeleteTablePopupOpen(true);
  };
  
  // Handle closing delete table popup
  const handleCloseDeleteTablePopup = () => {
    setIsDeleteTablePopupOpen(false);
    setDeleteTablePopupPosition(null);
  };
  
  // Handle confirming delete table
  const handleDeleteTable = () => {
    if (tables.length <= 1) return;
    
    // Remove the active table
    const newTables = tables.filter(t => t.id !== activeTableId);
    setTables(newTables);
    
    // Set active to the first remaining table
    if (newTables.length > 0) {
      setActiveTableId(newTables[0]!.id);
    }
    
    setIsDeleteTablePopupOpen(false);
    setDeleteTablePopupPosition(null);
  };

  // Get user session
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "user@example.com";
  const userInitial = userName.charAt(0).toUpperCase();

  // Fetch base data
  const { data: base } = api.base.getById.useQuery(
    { id: baseId },
    { staleTime: 60_000 }
  );
  
  // Get base colors based on ID
  const baseColor = getBaseColor(baseId);
  const baseBorderColor = getBaseBorderColor(baseId);
  const baseTextColor = getBaseTextColor(baseId);
  const baseName = base?.name ?? "Loading...";

  // Fetch views for this table (skip if tableId is the "default" sentinel)
  const isValidTable = tableId !== "default";
  const utils = api.useUtils();
  const viewsQ = api.view.list.useQuery(
    isValidTable ? { tableId } : skipToken,
    { staleTime: 60_000 },
  );
  const views = viewsQ.data ?? [];

  // Active view tracking
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  useEffect(() => {
    if (views.length === 0) return;
    const activeExists = activeViewId && views.some(v => v.id === activeViewId);
    if (!activeExists) {
      setActiveViewId(views[0]!.id);
    }
  }, [views, activeViewId]);

  const activeView = views.find(v => v.id === activeViewId);
  const activeViewName = activeView?.name ?? 'Grid view';
  const canDeleteView = views.length > 1;

  // Compute default name for next grid view
  const computeNextViewName = () => {
    const existingNames = new Set(views.map(v => v.name));
    let num = 2;
    while (existingNames.has(`Grid ${num}`)) num++;
    return `Grid ${num}`;
  };

  // Create view mutation
  const createViewMut = api.view.create.useMutation({
    onSuccess: (newView) => {
      void utils.view.list.invalidate({ tableId });
      setActiveViewId(newView.id);
      setIsCreateViewBoxOpen(false);
    },
  });

  // Delete view mutation
  const deleteViewMut = api.view.delete.useMutation({
    onSuccess: () => {
      void utils.view.list.invalidate({ tableId });
      setIsViewDropdownOpen(false);
      setContextMenuViewId(null);
    },
  });

  // Rename view mutation
  const renameViewMut = api.view.update.useMutation({
    onSuccess: () => {
      void utils.view.list.invalidate({ tableId });
    },
  });

  // Refs
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const tableDropdownRef = useRef<HTMLDivElement>(null);
  const tableDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const addOrImportDropdownRef = useRef<HTMLUListElement>(null);
  const addOrImportButtonRef = useRef<HTMLButtonElement>(null);
  const addTableSectionRef = useRef<HTMLDivElement>(null);
  const tableTitleDropdownRef = useRef<HTMLUListElement>(null);
  const tableTitleDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const renamePopupRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const deleteTablePopupRef = useRef<HTMLDivElement>(null);
  const viewDropdownRef = useRef<HTMLUListElement>(null);
  const viewDropdownButtonRef = useRef<HTMLDivElement>(null);

  // Scroll state for proportional indicator reveal
  const [scrollProgress, setScrollProgress] = useState(0); // 0 to 1
  const [hasOverflow, setHasOverflow] = useState(false); // Whether tabs overflow at all

  // Views sidebar state
  const [isViewsSidebarOpen, setIsViewsSidebarOpen] = useState(false);
  const [isViewsSidebarPinned, setIsViewsSidebarPinned] = useState(false);
  const [viewSearchQuery, setViewSearchQuery] = useState('');
  const [favoritedViews, setFavoritedViews] = useState<Set<string>>(new Set());
  const [isCreateNewDropdownOpen, setIsCreateNewDropdownOpen] = useState(false);
  const [isCreateViewBoxOpen, setIsCreateViewBoxOpen] = useState(false);
  const [createViewName, setCreateViewName] = useState('Grid 2');
  const viewsSidebarCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewsSidebarRef = useRef<HTMLDivElement>(null);
  const createNewDropdownRef = useRef<HTMLUListElement>(null);
  const createNewButtonRef = useRef<HTMLButtonElement>(null);
  const createViewBoxRef = useRef<HTMLDivElement>(null);
  const createViewInputRef = useRef<HTMLInputElement>(null);
  const [contextMenuViewId, setContextMenuViewId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const viewItemContextMenuRef = useRef<HTMLUListElement>(null);

  // Rename view state
  const [isRenamingView, setIsRenamingView] = useState(false);
  const [renameViewValue, setRenameViewValue] = useState('');
  const renameViewInputRef = useRef<HTMLInputElement>(null);

  // Check scroll progress for proportional reveal
  const checkScrollProgress = () => {
    const el = tabsScrollRef.current;
    if (!el) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    
    // Check if there's any overflow
    setHasOverflow(maxScroll > 1);
    
    if (maxScroll <= 0) {
      setScrollProgress(0);
    } else {
      // Clamp between 0 and 1
      setScrollProgress(Math.min(1, Math.max(0, scrollLeft / maxScroll)));
    }
  };

  // Scroll to start (left) or end (right)
  const scrollToEnd = (direction: 'left' | 'right') => {
    const el = tabsScrollRef.current;
    if (!el) return;
    
    el.scrollTo({
      left: direction === 'left' ? 0 : el.scrollWidth,
      behavior: 'smooth'
    });
  };

  // Set up scroll listener and check on mount/tables change
  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;

    checkScrollProgress();
    el.addEventListener('scroll', checkScrollProgress);
    
    // Also check on resize
    const resizeObserver = new ResizeObserver(checkScrollProgress);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScrollProgress);
      resizeObserver.disconnect();
    };
  }, [tables]);

  // === ACCOUNT DROPDOWN CLICK OUTSIDE ===
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
    }
    if (isAccountDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isAccountDropdownOpen]);

  // === TABLE DROPDOWN CLICK OUTSIDE ===
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking inside the table dropdown
      if (tableDropdownRef.current && tableDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking the table dropdown button
      if (tableDropdownButtonRef.current && tableDropdownButtonRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking inside the Add or Import dropdown
      if (addOrImportDropdownRef.current && addOrImportDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      setIsTableDropdownOpen(false);
      setTableSearchQuery('');
    }
    if (isTableDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isTableDropdownOpen]);

  // === ADD OR IMPORT DROPDOWN CLICK OUTSIDE ===
  useEffect(() => {
    if (!isAddOrImportDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking inside the Add or Import dropdown
      if (addOrImportDropdownRef.current && addOrImportDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking the Add or Import button
      if (addOrImportButtonRef.current && addOrImportButtonRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking inside the table dropdown
      if (tableDropdownRef.current && tableDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      setIsAddOrImportDropdownOpen(false);
      setAddOrImportOpenedFromTableDropdown(false);
    }
    
    // Add a small delay before attaching the listener to prevent
    // the current click from immediately closing the dropdown
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAddOrImportDropdownOpen]);

  // === TABLE TITLE DROPDOWN CLICK OUTSIDE ===
  useEffect(() => {
    if (!isTableTitleDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking inside the table title dropdown
      if (tableTitleDropdownRef.current && tableTitleDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking the table title dropdown button
      if (tableTitleDropdownButtonRef.current && tableTitleDropdownButtonRef.current.contains(event.target as Node)) {
        return;
      }
      setIsTableTitleDropdownOpen(false);
    }
    
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTableTitleDropdownOpen]);

  // === VIEW DROPDOWN CLICK OUTSIDE ===
  useEffect(() => {
    if (!isViewDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking inside the view dropdown
      if (viewDropdownRef.current && viewDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking the view dropdown button
      if (viewDropdownButtonRef.current && viewDropdownButtonRef.current.contains(event.target as Node)) {
        return;
      }
      setIsViewDropdownOpen(false);
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isViewDropdownOpen]);

  // === RENAME POPUP CLICK OUTSIDE ===
  useEffect(() => {
    if (!isRenamePopupOpen) return;

    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking inside the rename popup
      if (renamePopupRef.current && renamePopupRef.current.contains(event.target as Node)) {
        return;
      }
      handleCancelRename();
    }
    
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isRenamePopupOpen]);

  // === DELETE TABLE POPUP CLICK OUTSIDE ===
  useEffect(() => {
    if (!isDeleteTablePopupOpen) return;

    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking inside the delete table popup
      if (deleteTablePopupRef.current && deleteTablePopupRef.current.contains(event.target as Node)) {
        return;
      }
      handleCloseDeleteTablePopup();
    }
    
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDeleteTablePopupOpen]);

  // === CREATE NEW DROPDOWN CLICK OUTSIDE ===
  useEffect(() => {
    if (!isCreateNewDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      // Don't close if clicking inside the Create New dropdown
      if (createNewDropdownRef.current && createNewDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      // Don't close if clicking the Create New button itself (toggle handles it)
      if (createNewButtonRef.current && createNewButtonRef.current.contains(event.target as Node)) {
        return;
      }
      setIsCreateNewDropdownOpen(false);
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCreateNewDropdownOpen]);

  // === CREATE VIEW BOX CLICK OUTSIDE ===
  useEffect(() => {
    if (!isCreateViewBoxOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (createViewBoxRef.current && createViewBoxRef.current.contains(event.target as Node)) {
        return;
      }
      setIsCreateViewBoxOpen(false);
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCreateViewBoxOpen]);

  // === VIEW ITEM CONTEXT MENU CLICK OUTSIDE ===
  useEffect(() => {
    if (!contextMenuViewId) return;

    function handleClickOutside(event: MouseEvent) {
      if (viewItemContextMenuRef.current && viewItemContextMenuRef.current.contains(event.target as Node)) {
        return;
      }
      setContextMenuViewId(null);
      setContextMenuPosition(null);
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenuViewId]);

  // === AUTO-FOCUS CREATE VIEW INPUT ===
  useEffect(() => {
    if (isCreateViewBoxOpen && createViewInputRef.current) {
      createViewInputRef.current.focus();
      createViewInputRef.current.select();
    }
  }, [isCreateViewBoxOpen]);

  // === AUTO-FOCUS RENAME INPUT ===
  useEffect(() => {
    if (isRenamePopupOpen && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenamePopupOpen]);

  // === AUTO-FOCUS RENAME VIEW INPUT ===
  useEffect(() => {
    if (isRenamingView && renameViewInputRef.current) {
      renameViewInputRef.current.focus();
      renameViewInputRef.current.select();
    }
  }, [isRenamingView]);

  // === ADD OR IMPORT DROPDOWN POSITIONING ===
  useEffect(() => {
    if (!isAddOrImportDropdownOpen) {
      setAddOrImportDropdownPosition(null);
      return;
    }

    const dropdownWidth = 280;
    const dropdownHeight = 495.5;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rightGap = 6;
    const bottomGap = 24;

    if (addOrImportOpenedFromTableDropdown && addTableSectionRef.current) {
      // === OPENED FROM TABLE DROPDOWN → "+ Add table" ===
      const addTableRect = addTableSectionRef.current.getBoundingClientRect();
      
      // Calculate top position - aligned with the "+ Add table" button
      let top = addTableRect.top;
      
      // Check if dropdown would exceed bottom bounds (24px minimum gap)
      const maxTop = viewportHeight - dropdownHeight - bottomGap;
      if (top > maxTop) {
        top = maxTop;
      }
      
      // Calculate horizontal position - try right side first
      let left = addTableRect.right + 4; // 4px gap from the table dropdown
      let openLeft = false;
      
      // Check if there's enough space on the right
      if (left + dropdownWidth > viewportWidth - rightGap) {
        // Not enough space on right - open on left side
        openLeft = true;
        left = addTableRect.left - dropdownWidth - 10; // 10px gap, aligned to left border
      }
      
      setAddOrImportDropdownPosition({ top, left, openLeft });
    } else if (addOrImportButtonRef.current) {
      // === OPENED FROM "+ Add or Import" BUTTON ===
      const buttonRect = addOrImportButtonRef.current.getBoundingClientRect();
      
      // Position below the button (10px gap)
      const top = buttonRect.bottom + 10;
      
      // Default: left-align with the button
      let left = buttonRect.left;
      
      // Check if dropdown would overflow the right edge
      if (left + dropdownWidth > viewportWidth - rightGap) {
        // Not enough space - shift so it's 6px from right edge
        left = viewportWidth - dropdownWidth - rightGap;
      }
      
      setAddOrImportDropdownPosition({ top, left, openLeft: false });
    }
  }, [isAddOrImportDropdownOpen, addOrImportOpenedFromTableDropdown]);

  // === TABLE DROPDOWN POSITIONING ===
  useEffect(() => {
    if (isTableDropdownOpen && tableDropdownButtonRef.current) {
      const buttonRect = tableDropdownButtonRef.current.getBoundingClientRect();
      const dropdownWidth = 456; // Width of the dropdown
      const viewportWidth = window.innerWidth;
      
      // Check if there's enough space on the right for left-aligned dropdown
      const spaceOnRight = viewportWidth - buttonRect.left;
      
      // If not enough space on right, align to the right
      setTableDropdownAlignRight(spaceOnRight < dropdownWidth);
    }
  }, [isTableDropdownOpen]);

  // === CLOSE TABLE TITLE DROPDOWN ON TABLE CHANGE ===
  useEffect(() => {
    setIsTableTitleDropdownOpen(false);
    setTableTitleDropdownPosition(null);
  }, [activeTableId]);

  // Filter tables based on search query
  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(tableSearchQuery.toLowerCase())
  );

  // Handle table selection from dropdown
  const handleTableSelect = (tableId: string) => {
    setActiveTableId(tableId);
    setIsTableDropdownOpen(false);
    setTableSearchQuery('');
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  // Views sidebar handlers
  const clearSidebarCollapseTimer = () => {
    if (viewsSidebarCollapseTimerRef.current) {
      clearTimeout(viewsSidebarCollapseTimerRef.current);
      viewsSidebarCollapseTimerRef.current = null;
    }
  };

  const startSidebarCollapseTimer = () => {
    // Only auto-collapse if the sidebar was opened by hover (not pinned)
    if (isViewsSidebarPinned) return;
    // Don't collapse if any popup menus are open
    if (isCreateNewDropdownOpen || isCreateViewBoxOpen || contextMenuViewId) return;
    clearSidebarCollapseTimer();
    viewsSidebarCollapseTimerRef.current = setTimeout(() => {
      setIsViewsSidebarOpen(false);
    }, 500);
  };

  // Click toggles pinned state
  const handleToggleViewsSidebar = () => {
    clearSidebarCollapseTimer();
    setIsViewsSidebarOpen(prev => {
      const next = !prev;
      setIsViewsSidebarPinned(next);
      return next;
    });
  };

  // Hover opens (unpinned) when sidebar is closed
  const handleListButtonMouseEnter = () => {
    if (!isViewsSidebarOpen) {
      clearSidebarCollapseTimer();
      setIsViewsSidebarOpen(true);
      // Don't pin — this was a hover-open
      setIsViewsSidebarPinned(false);
    } else {
      // Cursor moved back to button, cancel any pending collapse
      clearSidebarCollapseTimer();
    }
  };

  const handleListButtonMouseLeave = () => {
    startSidebarCollapseTimer();
  };

  const handleSidebarMouseEnter = () => {
    clearSidebarCollapseTimer();
  };

  const handleSidebarMouseLeave = () => {
    startSidebarCollapseTimer();
  };

  const handleToggleViewFavorite = (viewId: string) => {
    setFavoritedViews(prev => {
      const next = new Set(prev);
      if (next.has(viewId)) {
        next.delete(viewId);
      } else {
        next.add(viewId);
      }
      return next;
    });
  };

  // === RENAME VIEW HELPERS ===
  const startRenamingView = () => {
    setRenameViewValue(activeViewName);
    setIsRenamingView(true);
    setIsViewDropdownOpen(false);
    setIsCreateNewDropdownOpen(false);
    setContextMenuViewId(null);
    setContextMenuPosition(null);
  };

  const commitRenameView = () => {
    const trimmed = renameViewValue.trim();
    if (trimmed && trimmed !== activeViewName && activeViewId) {
      renameViewMut.mutate({ viewId: activeViewId, name: trimmed });
    }
    setIsRenamingView(false);
  };

  const cancelRenameView = () => {
    setIsRenamingView(false);
  };

  // === RENDER ===
  return (
    <div className={styles.workspace}>
      {/* =============================================
          RAIL (Narrow vertical sidebar - 56px wide)
          ============================================= */}
      <nav className={styles.rail}>
        {/* Rail Top - Logo and second icon */}
        <div className={styles.railTop}>
          <button className={styles.railLogo}>
            <AirtableLogoMonochrome />
            <IconBackArrow />
            <span className={styles.railTooltip}>Back to home</span>
          </button>
          <button className={styles.railSecondIcon} title="Omni">
            <IconOmni />
          </button>
        </div>

        {/* Rail Bottom - Help, Bell, Avatar */}
        <div className={styles.railBottom}>
          <button className={styles.railHelpButton}>
            <IconHelp />
            <span className={styles.railTooltip}>Help</span>
          </button>
          <button className={styles.railBellButton}>
            <IconBell />
            <span className={styles.railTooltip}>Notifications</span>
          </button>
          <div className={styles.railAccountWrapper} ref={accountDropdownRef}>
            <button 
              className={styles.railAvatar} 
              aria-expanded={isAccountDropdownOpen}
              onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
            >
              {userInitial}
              {!isAccountDropdownOpen && <span className={styles.railTooltip}>Account</span>}
            </button>
            {isAccountDropdownOpen && (
              <div className={styles.railAccountDropdown}>
                <div className={styles.railAccountDropdownContent}>
                  {/* Header with name and email */}
                  <div className={styles.railAccountDropdownHeader}>
                    <div>
                      <p className={styles.railAccountDropdownName}>{userName}</p>
                      <span className={styles.railAccountDropdownEmail}>{userEmail}</span>
                    </div>
                  </div>

                  {/* Account */}
                <button type="button" className={styles.railAccountDropdownItem}>
                  <span className={styles.railAccountDropdownItemIcon}>
                    <UserIcon size={16} />
                  </span>
                  <span className={styles.railAccountDropdownItemText}>Account</span>
                </button>

                {/* Manage groups with Business badge */}
                <button type="button" className={styles.railAccountDropdownItem}>
                  <span className={styles.railAccountDropdownItemIcon}>
                    <UsersIcon size={16} />
                  </span>
                  <span className={styles.railAccountDropdownItemText}>Manage groups</span>
                  <span className={styles.railAccountDropdownBadgeBusiness}>
                    <span className={styles.railAccountDropdownBadgeBusinessIcon}>
                      <AirtablePlusFillIcon size={12} color="rgb(15, 104, 162)" />
                    </span>
                    Business
                  </span>
                </button>

                {/* Notification preferences with arrow */}
                <button type="button" className={styles.railAccountDropdownItem}>
                  <span className={styles.railAccountDropdownItemIcon}>
                    <BellIcon size={16} />
                  </span>
                  <span className={styles.railAccountDropdownItemText}>Notification preferences</span>
                  <span className={styles.railAccountDropdownItemArrow}>
                    <ChevronDownIcon size={16} />
                  </span>
                </button>

                {/* Language preferences with arrow */}
                <button type="button" className={styles.railAccountDropdownItem}>
                  <span className={styles.railAccountDropdownItemIcon}>
                    <TranslateIcon size={16} />
                  </span>
                  <span className={styles.railAccountDropdownItemText}>Language preferences</span>
                  <span className={styles.railAccountDropdownItemArrow}>
                    <ChevronDownIcon size={16} />
                  </span>
                </button>

                {/* Appearance with Beta badge and arrow */}
                <button type="button" className={styles.railAccountDropdownItem}>
                  <span className={styles.railAccountDropdownItemIcon}>
                    <PaletteIcon size={16} />
                  </span>
                  <span className={styles.railAccountDropdownItemText}>Appearance</span>
                  <span className={styles.railAccountDropdownBadgeBeta}>Beta</span>
                  <span className={styles.railAccountDropdownItemArrow}>
                    <ChevronDownIcon size={16} />
                  </span>
                </button>

                {/* Divider - extra 1px spacing after Appearance */}
                <div className={styles.railAccountDropdownDividerAfterAppearance} />

                {/* Contact sales */}
                <button type="button" className={styles.railAccountDropdownItem}>
                  <span className={styles.railAccountDropdownItemIcon}>
                    <EnvelopeSimpleIcon size={16} />
                  </span>
                  <span className={styles.railAccountDropdownItemText}>Contact sales</span>
                </button>

                {/* Upgrade */}
                <button type="button" className={styles.railAccountDropdownItem}>
                  <span className={styles.railAccountDropdownItemIcon}>
                    <UpsellStarIcon size={16} />
                  </span>
                  <span className={styles.railAccountDropdownItemText}>Upgrade</span>
                </button>

                {/* Tell a friend */}
                <button type="button" className={styles.railAccountDropdownItem}>
                  <span className={styles.railAccountDropdownItemIcon}>
                    <EnvelopeSimpleIcon size={16} />
                  </span>
                  <span className={styles.railAccountDropdownItemText}>Tell a friend</span>
                </button>

                {/* Divider */}
                <div className={styles.railAccountDropdownDivider} />

                {/* Integrations */}
                <button type="button" className={styles.railAccountDropdownItem}>
                  <span className={styles.railAccountDropdownItemIcon}>
                    <LinkIcon size={16} />
                  </span>
                  <span className={styles.railAccountDropdownItemText}>Integrations</span>
                </button>

                {/* Builder hub */}
                <button type="button" className={styles.railAccountDropdownItem}>
                  <span className={styles.railAccountDropdownItemIcon}>
                    <WrenchIcon size={16} />
                  </span>
                  <span className={styles.railAccountDropdownItemText}>Builder hub</span>
                </button>

                {/* Divider */}
                <div className={styles.railAccountDropdownDivider} />

                {/* Trash */}
                <button type="button" className={styles.railAccountDropdownItem}>
                  <span className={styles.railAccountDropdownItemIcon}>
                    <TrashIcon size={16} />
                  </span>
                  <span className={styles.railAccountDropdownItemText}>Trash</span>
                </button>

                  {/* Log out - functional */}
                  <button type="button" className={styles.railAccountDropdownItem} onClick={handleLogout}>
                    <span className={styles.railAccountDropdownItemIcon}>
                      <SignOutIcon size={16} />
                    </span>
                    <span className={styles.railAccountDropdownItemText}>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* =============================================
          MAIN CONTENT AREA (right of rail)
          ============================================= */}
      <div className={styles.mainArea}>
        {/* === TOP BAR (base name) === */}
        <div className={styles.topBar}>
          <div className={styles.topBarInner}>
            {/* Left Section: Base Icon, Name, Dropdown */}
            <div className={styles.topBarLeft}>
              <div className={styles.topBarLeftContent}>
                <div 
                  className={styles.baseIcon}
                  style={{ 
                    backgroundColor: baseColor, 
                    borderColor: baseBorderColor 
                  }}
                >
                  <IconBaseLogo style={{ color: baseTextColor }} />
                </div>
                <span className={styles.baseName}>{baseName}</span>
                <IconChevronDown />
              </div>
            </div>

            {/* Center Section: Navigation Items */}
            <ul className={styles.topBarCenter} style={{ '--base-color': baseColor } as React.CSSProperties}>
              <li className={`${styles.topBarNavItem} ${styles.topBarNavItemActive}`}>Data</li>
              <li className={styles.topBarNavItem}>Automations</li>
              <li className={styles.topBarNavItem}>Interfaces</li>
              <li className={styles.topBarNavItem}>Forms</li>
            </ul>

            {/* Right Section: Share, Launch, History buttons */}
            <div className={styles.topBarRight}>
              <button className={styles.topBarHistoryButton}>
                <IconClockCounterClockwise />
              </button>
              <button className={styles.topBarLaunchButton}>
                <IconSidebarPlay />
                <span className={styles.topBarLaunchText}>Launch</span>
              </button>
              <button 
                className={styles.topBarShareButton}
                style={{ backgroundColor: baseColor }}
              >
                Share
              </button>
            </div>
          </div>
        </div>

        {/* === CONTENT AREA === */}
        <div className={styles.contentArea}>
          {/* === TABLE TOOLBAR (colored bar) === */}
          <div 
            className={styles.tableToolbar}
            style={{ backgroundColor: getBaseToolbarColor(baseId) }}
          >
            <div className={styles.tableToolbarInner}>
              {/* Left scroll indicator - only render when there's left overflow (scrollProgress > 0) */}
              {hasOverflow && scrollProgress > 0 && (
                <div 
                  className={styles.scrollIndicatorLeft}
                  style={{ width: `${Math.min(scrollProgress * 3, 1) * 40}px` }}
                >
                  {/* Clip wrapper for button */}
                  <div className={styles.scrollIndicatorClip}>
                    <button 
                      className={styles.scrollIndicatorButton}
                      style={{ backgroundColor: getBaseToolbarColor(baseId) }}
                      onClick={() => scrollToEnd('left')}
                      aria-label="Scroll to first table"
                    >
                      <svg className={styles.scrollIndicatorIcon} viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="nonzero" d="M8 1.5C6.71442 1.5 5.45772 1.88122 4.3888 2.59545C3.31988 3.30968 2.48676 4.32484 1.99479 5.51256C1.50282 6.70028 1.37409 8.00721 1.6249 9.26809C1.8757 10.529 2.49477 11.6872 3.40381 12.5962C4.31285 13.5052 5.47104 14.1243 6.73192 14.3751C7.99279 14.6259 9.29973 14.4972 10.4874 14.0052C11.6752 13.5132 12.6903 12.6801 13.4046 11.6112C14.1188 10.5423 14.5 9.28558 14.5 8C14.4967 6.27711 13.8108 4.62573 12.5925 3.40746C11.3743 2.18918 9.7229 1.5033 8 1.5V1.5ZM9.3375 9.88125C9.43527 9.97078 9.49349 10.0955 9.49935 10.2279C9.50521 10.3603 9.45823 10.4897 9.36875 10.5875C9.32217 10.639 9.26525 10.6801 9.20171 10.7081C9.13817 10.7361 9.06944 10.7504 9 10.75C8.87528 10.7488 8.75528 10.7021 8.6625 10.6187L6.1625 8.36875C6.11135 8.32191 6.0705 8.26493 6.04255 8.20145C6.01461 8.13797 6.00018 8.06936 6.00018 8C6.00018 7.93064 6.01461 7.86203 6.04255 7.79855C6.0705 7.73507 6.11135 7.67809 6.1625 7.63125L8.6625 5.38125C8.71063 5.33525 8.76745 5.29932 8.82965 5.27558C8.89184 5.25183 8.95815 5.24075 9.02468 5.24297C9.09122 5.24519 9.15664 5.26068 9.21711 5.28852C9.27758 5.31637 9.33188 5.356 9.37683 5.40511C9.42177 5.45422 9.45646 5.51181 9.47885 5.5745C9.50125 5.6372 9.51089 5.70373 9.50723 5.7702C9.50357 5.83667 9.48667 5.90174 9.45752 5.96159C9.42838 6.02145 9.38757 6.07488 9.3375 6.11875L7.25 8L9.3375 9.88125Z" />
                      </svg>
                    </button>
                  </div>
                  {/* Shadow extends over tables (to the right) */}
                  <div className={styles.scrollIndicatorShadowRight} />
                </div>
              )}

              {/* Scrollable container for table tabs only */}
              <div className={styles.tableTabsScrollable} ref={tabsScrollRef}>
                {/* Table Tabs */}
                {tables.map((table) => (
                  <div 
                    key={table.id}
                    className={styles.tableTabWrapper}
                  >
                    <div 
                      className={`${styles.tableTab} ${table.id === activeTableId ? styles.tableTabActive : ''}`}
                      data-table-id={table.id}
                      onClick={() => setActiveTableId(table.id)}
                    >
                      <span className={styles.tableTabName}>{table.name}</span>
                      <button 
                        type="button"
                        ref={table.id === activeTableId ? tableTitleDropdownButtonRef : null}
                        className={styles.tableTabDropdown}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const newIsOpen = !isTableTitleDropdownOpen;
                          setIsTableTitleDropdownOpen(newIsOpen);
                          
                          if (newIsOpen) {
                            // Calculate position when opening
                            const button = e.currentTarget;
                            const parentTab = button.closest(`.${styles.tableTab}`);
                            if (parentTab) {
                              const tabRect = parentTab.getBoundingClientRect();
                              setTableTitleDropdownPosition({
                                top: tabRect.bottom + 8,
                                left: tabRect.left,
                              });
                            }
                          } else {
                            setTableTitleDropdownPosition(null);
                          }
                        }}
                      >
                        <svg 
                          className={styles.tableTabDropdownIcon}
                          viewBox="0 0 16 16" 
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path 
                            fillRule="nonzero" 
                            d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" 
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Table Title Dropdown Menu */}
                    {table.id === activeTableId && isTableTitleDropdownOpen && tableTitleDropdownPosition && (
                      <ul 
                        ref={tableTitleDropdownRef} 
                        className={styles.tableTitleDropdown}
                        style={{
                          top: tableTitleDropdownPosition.top,
                          left: tableTitleDropdownPosition.left,
                        }}
                      >
                        {/* Import data - with arrow */}
                        <li className={styles.tableTitleDropdownItem}>
                          <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="nonzero" d="M8 5C7.8674 5.00003 7.74024 5.05272 7.64648 5.14648L5.52771 7.26514C5.48127 7.31157 5.44444 7.36669 5.41931 7.42736C5.39418 7.48802 5.38124 7.55305 5.38124 7.61871C5.38124 7.68438 5.39418 7.7494 5.41931 7.81007C5.44444 7.87074 5.48127 7.92586 5.52771 7.97229C5.57414 8.01873 5.62926 8.05556 5.68993 8.08069C5.7506 8.10582 5.81562 8.11876 5.88129 8.11876C5.94695 8.11876 6.01198 8.10582 6.07264 8.08069C6.13331 8.05556 6.18843 8.01873 6.23486 7.97229L7.5 6.70703V10.5C7.5 10.6326 7.55268 10.7598 7.64645 10.8536C7.74021 10.9473 7.86739 11 8 11C8.13261 11 8.25979 10.9473 8.35355 10.8536C8.44732 10.7598 8.5 10.6326 8.5 10.5V6.70703L9.76514 7.97229C9.81157 8.01873 9.86669 8.05556 9.92736 8.08069C9.98802 8.10582 10.053 8.11876 10.1187 8.11876C10.1844 8.11876 10.2494 8.10582 10.3101 8.08069C10.3707 8.05556 10.4259 8.01873 10.4723 7.97229C10.5187 7.92586 10.5556 7.87074 10.5807 7.81007C10.6058 7.7494 10.6188 7.68438 10.6188 7.61871C10.6188 7.55305 10.6058 7.48802 10.5807 7.42736C10.5556 7.36669 10.5187 7.31157 10.4723 7.26514L8.35352 5.14648C8.34867 5.14437 8.34378 5.14234 8.33887 5.14038C8.24777 5.05235 8.12666 5.00218 8 5Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
                          </svg>
                          <span className={styles.tableTitleDropdownItemText}>Import data</span>
                          <svg className={styles.tableTitleDropdownItemArrow} viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
                          </svg>
                        </li>

                        {/* Divider */}
                        <li className={styles.tableTitleDropdownDivider} />

                        {/* Rename table */}
                        <li 
                          className={styles.tableTitleDropdownItem}
                          onClick={handleOpenRenamePopup}
                        >
                          <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="nonzero" d="M10.5 1.71045C10.2406 1.71045 9.9813 1.80867 9.7876 2.00525L2.29017 9.50269L2.28931 9.50354C2.10332 9.69048 1.9991 9.94419 2.00001 10.2079V12.9999C2.00007 13.5462 2.45358 13.9998 2.99988 13.9999H5.79212C6.05578 14.0008 6.30942 13.8966 6.49635 13.7107L6.49732 13.7097L13.9948 6.21228C14.3878 5.82489 14.3878 5.17499 13.9948 4.7876L11.2124 2.00525C11.0187 1.80867 10.7594 1.71045 10.5 1.71045ZM10.4999 2.70715C10.4955 2.70269 10.5043 2.70269 10.4999 2.70715L10.5027 2.70972L13.2902 5.49719L13.2927 5.49976C13.2972 5.49534 13.2972 5.50418 13.2927 5.49976L13.2902 5.50269L12 6.79297L9.20704 4L10.4973 2.70972L10.4999 2.70715ZM8.50001 4.70703L11.293 7.5L5.79297 12.9999H3.00013L3.00001 10.207L8.50001 4.70703Z" />
                          </svg>
                          <span className={styles.tableTitleDropdownItemText}>Rename table</span>
                        </li>

                        {/* Hide table */}
                        <li className={styles.tableTitleDropdownItem}>
                          <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="nonzero" d="M8.00013 2.99999C7.53899 2.99917 7.07864 3.03701 6.62379 3.11315C6.55902 3.12398 6.49703 3.14747 6.44134 3.18226C6.38565 3.21706 6.33736 3.26248 6.29923 3.31594C6.2611 3.3694 6.23387 3.42984 6.2191 3.49382C6.20433 3.5578 6.2023 3.62407 6.21314 3.68883C6.23505 3.81961 6.30801 3.93632 6.41597 4.01331C6.52393 4.0903 6.65805 4.12125 6.78883 4.09935C7.18869 4.03242 7.59357 3.99923 7.99915 3.99999C7.99882 3.99999 7.99948 3.99999 7.99915 3.99999C12.083 3.99999 14.0065 7.16727 14.4415 7.99926C14.2327 8.39403 13.6815 9.3219 12.7042 10.196C12.6553 10.2398 12.6154 10.2928 12.587 10.352C12.5585 10.4112 12.542 10.4754 12.5383 10.5409C12.5347 10.6065 12.544 10.6721 12.5657 10.7341C12.5874 10.7961 12.6211 10.8531 12.6649 10.9021C12.7533 11.0009 12.8774 11.0606 13.0097 11.0679C13.1421 11.0753 13.272 11.0298 13.3709 10.9414C14.8157 9.64896 15.4569 8.20311 15.4569 8.20311C15.4853 8.13917 15.5 8.06997 15.5 7.99999C15.5 7.93001 15.4853 7.86081 15.4569 7.79686C15.4569 7.79686 13.2994 3.00052 8.00013 2.99999Z M8.56177 5.05248C8.4315 5.02783 8.29677 5.05593 8.18721 5.1306C8.07765 5.20527 8.00223 5.3204 7.97755 5.45067C7.96532 5.51519 7.96592 5.58148 7.97932 5.64576C7.99271 5.71004 8.01864 5.77106 8.05562 5.82532C8.09259 5.87958 8.13989 5.92603 8.19482 5.96201C8.24975 5.99799 8.31122 6.0228 8.37574 6.03502C9.25118 6.20086 9.90696 6.92166 9.98963 7.80883C9.99573 7.87421 10.0146 7.93775 10.0453 7.99582C10.076 8.05389 10.1177 8.10536 10.1683 8.14727C10.2188 8.18919 10.2771 8.22074 10.3399 8.24013C10.4026 8.25951 10.4686 8.26635 10.5339 8.26024C10.666 8.24793 10.7877 8.18368 10.8723 8.08163C10.957 7.97958 10.9976 7.84808 10.9854 7.71605C10.8617 6.38949 9.8708 5.30045 8.56177 5.05248Z M3.02381 2.0006C2.89137 1.99428 2.76183 2.04082 2.6637 2.12999C2.56557 2.21919 2.5069 2.34371 2.50058 2.47617C2.49426 2.60862 2.54082 2.73816 2.63001 2.83629L5.64234 6.14989C4.99783 6.97182 4.81667 8.0854 5.20167 9.08153C5.64782 10.2359 6.7614 10.9994 7.99891 10.9997C8.57697 11.0018 9.13723 10.8317 9.61744 10.5226L12.63 13.8363C12.7192 13.9344 12.8437 13.9931 12.9762 13.9994C13.1086 14.0057 13.2382 13.9592 13.3363 13.87C13.4344 13.7808 13.4931 13.6563 13.4994 13.5238C13.5058 13.3914 13.4592 13.2618 13.37 13.1637L6.6908 5.81652C6.69016 5.81554 6.68951 5.81456 6.68885 5.81359C6.6884 5.81338 6.68796 5.81318 6.68751 5.81298L3.37 2.16369C3.2808 2.06557 3.15627 2.0069 3.02381 2.0006ZM4.78126 3.81261C4.65529 3.7712 4.51803 3.78151 4.39966 3.8413C1.67465 5.21716 0.542853 7.79748 0.542853 7.79748C0.514536 7.86137 0.499927 7.93049 0.49997 8.00038C0.500012 8.07027 0.514704 8.13938 0.543098 8.20324C0.543098 8.20324 2.69954 12.9988 7.99805 13C9.24842 13.0098 10.4832 12.7217 11.6 12.1592C11.6586 12.1296 11.7109 12.0888 11.7537 12.0391C11.7966 11.9893 11.8293 11.9317 11.8498 11.8693C11.8704 11.8069 11.8785 11.7411 11.8736 11.6757C11.8688 11.6102 11.8511 11.5463 11.8215 11.4877C11.792 11.429 11.7512 11.3768 11.7015 11.3339C11.6517 11.291 11.594 11.2584 11.5317 11.2378C11.4693 11.2172 11.4035 11.2091 11.338 11.214C11.2726 11.2189 11.2087 11.2366 11.15 11.2661C10.1746 11.7574 9.09616 12.009 8.00403 12.0001C8.00269 12.0001 8.00135 12.0001 8.00001 12.0001C3.9214 12.0001 1.99934 8.84205 1.56104 8.00512C1.80002 7.53467 2.78966 5.77445 4.85035 4.734C4.90897 4.7044 4.96118 4.66355 5.00401 4.61377C5.04684 4.56399 5.07944 4.50626 5.09996 4.44389C5.12048 4.38151 5.12851 4.3157 5.12359 4.25021C5.11867 4.18473 5.1009 4.12086 5.0713 4.06225C5.01154 3.94387 4.90721 3.85407 4.78126 3.81261ZM6.3307 6.90709L8.92811 9.76427C8.64391 9.91434 8.32855 10.0011 8.00196 9.99987C8.00131 9.99987 8.00066 9.99987 8.00001 9.99987C7.17209 9.99993 6.43288 9.49318 6.13441 8.72094C5.89804 8.10936 5.98275 7.43768 6.3307 6.90709Z" />
                          </svg>
                          <span className={styles.tableTitleDropdownItemText}>Hide table</span>
                        </li>

                        {/* Manage fields - with Team badge */}
                        <li className={styles.tableTitleDropdownItem}>
                          <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="nonzero" d="M6.5 3.25C6.36739 3.25 6.24021 3.30268 6.14645 3.39645C6.05268 3.49021 6 3.61739 6 3.75V6.75C6 6.88261 6.05268 7.00979 6.14645 7.10355C6.24021 7.19732 6.36739 7.25 6.5 7.25C6.63261 7.25 6.75979 7.19732 6.85355 7.10355C6.94732 7.00979 7 6.88261 7 6.75V5.75H13.5C13.6326 5.75 13.7598 5.69732 13.8536 5.60355C13.9473 5.50979 14 5.38261 14 5.25C14 5.11739 13.9473 4.99021 13.8536 4.89645C13.7598 4.80268 13.6326 4.75 13.5 4.75H7V3.75C7 3.61739 6.94732 3.49021 6.85355 3.39645C6.75979 3.30268 6.63261 3.25 6.5 3.25Z M2.5 4.75C2.36739 4.75 2.24021 4.80268 2.14645 4.89645C2.05268 4.99021 2 5.11739 2 5.25C2 5.38261 2.05268 5.50979 2.14645 5.60355C2.24021 5.69732 2.36739 5.75 2.5 5.75H4.5C4.63261 5.75 4.75979 5.69732 4.85355 5.60355C4.94732 5.50979 5 5.38261 5 5.25C5 5.11739 4.94732 4.99021 4.85355 4.89645C4.75979 4.80268 4.63261 4.75 4.5 4.75H2.5Z M10.5 8.75C10.3674 8.75 10.2402 8.80268 10.1464 8.89645C10.0527 8.99021 10 9.11739 10 9.25V12.25C10 12.3826 10.0527 12.5098 10.1464 12.6036C10.2402 12.6973 10.3674 12.75 10.5 12.75C10.6326 12.75 10.7598 12.6973 10.8536 12.6036C10.9473 12.5098 11 12.3826 11 12.25V11.25H13.5C13.6326 11.25 13.7598 11.1973 13.8536 11.1036C13.9473 11.0098 14 10.8826 14 10.75C14 10.6174 13.9473 10.4902 13.8536 10.3964C13.7598 10.3027 13.6326 10.25 13.5 10.25H11V9.25C11 9.11739 10.9473 8.99021 10.8536 8.89645C10.7598 8.80268 10.6326 8.75 10.5 8.75Z M2.5 10.25C2.36739 10.25 2.24021 10.3027 2.14645 10.3964C2.05268 10.4902 2 10.6174 2 10.75C2 10.8826 2.05268 11.0098 2.14645 11.1036C2.24021 11.1973 2.36739 11.25 2.5 11.25H8.5C8.63261 11.25 8.75979 11.1973 8.85355 11.1036C8.94732 11.0098 9 10.8826 9 10.75C9 10.6174 8.94732 10.4902 8.85355 10.3964C8.75979 10.3027 8.63261 10.25 8.5 10.25H2.5Z" />
                          </svg>
                          <span className={styles.tableTitleDropdownItemText}>Manage fields</span>
                          <span className={styles.tableTitleDropdownTeamBadge}>
                            <svg className={styles.tableTitleDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor">
                              <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                            </svg>
                            Team
                          </span>
                        </li>

                        {/* Duplicate table */}
                        <li className={styles.tableTitleDropdownItem}>
                          <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="nonzero" d="M2.5 5C2.3674 5.00001 2.24023 5.0527 2.14646 5.14646C2.0527 5.24023 2.00001 5.3674 2 5.5V13.5C2.00001 13.6326 2.0527 13.7598 2.14646 13.8535C2.24023 13.9473 2.3674 14 2.5 14H10.5C10.6326 14 10.7598 13.9473 10.8535 13.8535C10.9473 13.7598 11 13.6326 11 13.5V5.5C11 5.3674 10.9473 5.24023 10.8535 5.14646C10.7598 5.0527 10.6326 5.00001 10.5 5H2.5ZM3 6H10V13H3V6Z M5.5 2C5.3674 2.00001 5.24023 2.0527 5.14646 2.14646C5.0527 2.24023 5.00001 2.3674 5 2.5V5.5C5 5.63261 5.05268 5.75979 5.14645 5.85355C5.24021 5.94732 5.36739 6 5.5 6C5.63261 6 5.75979 5.94732 5.85355 5.85355C5.94732 5.75979 6 5.63261 6 5.5V3H13V10H10.5C10.3674 10 10.2402 10.0527 10.1464 10.1464C10.0527 10.2402 10 10.3674 10 10.5C10 10.6326 10.0527 10.7598 10.1464 10.8536C10.2402 10.9473 10.3674 11 10.5 11H13.5C13.6326 11 13.7598 10.9473 13.8535 10.8535C13.9473 10.7598 14 10.6326 14 10.5V2.5C14 2.3674 13.9473 2.24023 13.8535 2.14646C13.7598 2.0527 13.6326 2.00001 13.5 2H5.5Z" />
                          </svg>
                          <span className={styles.tableTitleDropdownItemText}>Duplicate table</span>
                        </li>

                        {/* Divider */}
                        <li className={styles.tableTitleDropdownDivider} />

                        {/* Configure date dependencies - with Team badge */}
                        <li className={styles.tableTitleDropdownItem}>
                          <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="nonzero" d="M0 3.5C0 2.67157 0.671573 2 1.5 2H11.5C12.3284 2 13 2.67157 13 3.5V5.5C13 6.32843 12.3284 7 11.5 7H4.5V10C4.5 10.5523 4.94771 11 5.5 11H7.5V10.5C7.5 9.67157 8.17157 9 9 9H14.5C15.3284 9 16 9.67157 16 10.5V12.5C16 13.3284 15.3284 14 14.5 14H9C8.17157 14 7.5 13.3284 7.5 12.5V12H5.5C4.39543 12 3.5 11.1046 3.5 10V7H1.5C0.671573 7 0 6.32843 0 5.5V3.5ZM8.5 12.5C8.5 12.7761 8.72386 13 9 13H14.5C14.7761 13 15 12.7761 15 12.5V10.5C15 10.2239 14.7761 10 14.5 10H9C8.72386 10 8.5 10.2239 8.5 10.5V12.5ZM1.5 3C1.22386 3 1 3.22386 1 3.5V5.5C1 5.77614 1.22386 6 1.5 6H11.5C11.7761 6 12 5.77614 12 5.5V3.5C12 3.22386 11.7761 3 11.5 3H1.5Z" />
                          </svg>
                          <span className={styles.tableTitleDropdownItemText}>Configure date dependencies</span>
                          <span className={styles.tableTitleDropdownTeamBadge}>
                            <svg className={styles.tableTitleDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor">
                              <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                            </svg>
                            Team
                          </span>
                        </li>

                        {/* Divider */}
                        <li className={styles.tableTitleDropdownDivider} />

                        {/* Edit table description */}
                        <li className={styles.tableTitleDropdownItem}>
                          <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="nonzero" d="M7.875 6C8.28919 6 8.625 5.66419 8.625 5.25C8.625 4.83581 8.28919 4.5 7.875 4.5C7.46081 4.5 7.125 4.83581 7.125 5.25C7.125 5.66419 7.46081 6 7.875 6Z M7.5 7C7.36739 7 7.24021 7.05268 7.14645 7.14645C7.05268 7.24021 7 7.36739 7 7.5C7 7.63261 7.05268 7.75979 7.14645 7.85355C7.24021 7.94732 7.36739 8 7.5 8V11C7.50001 11.1326 7.5527 11.2598 7.64646 11.3535C7.74023 11.4473 7.8674 11.5 8 11.5H8.5C8.63261 11.5 8.75979 11.4473 8.85355 11.3536C8.94732 11.2598 9 11.1326 9 11C9 10.8674 8.94732 10.7402 8.85355 10.6464C8.75979 10.5527 8.63261 10.5 8.5 10.5V7.5C8.49999 7.3674 8.4473 7.24023 8.35354 7.14646C8.25977 7.0527 8.1326 7.00001 8 7H7.5Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
                          </svg>
                          <span className={styles.tableTitleDropdownItemText}>Edit table description</span>
                        </li>

                        {/* Edit table permissions - with Team badge */}
                        <li className={styles.tableTitleDropdownItem}>
                          <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="nonzero" d="M8 10.25C8.41419 10.25 8.75 9.91419 8.75 9.5C8.75 9.08581 8.41419 8.75 8 8.75C7.58581 8.75 7.25 9.08581 7.25 9.5C7.25 9.91419 7.58581 10.25 8 10.25Z M8 0.5C6.48714 0.5 5.25 1.73714 5.25 3.25V5H3C2.45364 5 2 5.45364 2 6V13C2 13.5464 2.45364 14 3 14H13C13.5464 14 14 13.5464 14 13V6C14 5.45364 13.5464 5 13 5H10.75V3.25C10.75 1.73714 9.51286 0.5 8 0.5ZM8 1.5C8.97242 1.5 9.75 2.27758 9.75 3.25V5H6.25V3.25C6.25 2.27758 7.02758 1.5 8 1.5ZM3 6H13V13H3V6Z" />
                          </svg>
                          <span className={styles.tableTitleDropdownItemText}>Edit table permissions</span>
                          <span className={styles.tableTitleDropdownTeamBadge}>
                            <svg className={styles.tableTitleDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor">
                              <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                            </svg>
                            Team
                          </span>
                        </li>

                        {/* Divider */}
                        <li className={styles.tableTitleDropdownDivider} />

                        {/* Clear data */}
                        <li 
                          className={styles.tableTitleDropdownItem}
                          onClick={handleOpenClearDataModal}
                        >
                          <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="nonzero" d="M3.49999 3C3.36738 3.00002 3.24022 3.05271 3.14647 3.14648C3.05272 3.24025 3.00006 3.36741 3.00006 3.5C3.00006 3.63259 3.05272 3.75975 3.14647 3.85352L12.1465 12.8535C12.2402 12.9473 12.3674 12.9999 12.5 12.9999C12.6326 12.9999 12.7597 12.9473 12.8535 12.8535C12.9472 12.7598 12.9999 12.6326 12.9999 12.5C12.9999 12.3674 12.9472 12.2402 12.8535 12.1465L3.8535 3.14648C3.75975 3.05271 3.63259 3.00002 3.49999 3Z M12.5 3C12.3674 3.00002 12.2402 3.05271 12.1465 3.14648L3.14647 12.1465C3.05272 12.2402 3.00006 12.3674 3.00006 12.5C3.00006 12.6326 3.05272 12.7598 3.14647 12.8535C3.24023 12.9473 3.3674 12.9999 3.49999 12.9999C3.63258 12.9999 3.75974 12.9473 3.8535 12.8535L12.8535 3.85352C12.9472 3.75975 12.9999 3.63259 12.9999 3.5C12.9999 3.36741 12.9472 3.24025 12.8535 3.14648C12.7597 3.05271 12.6326 3.00002 12.5 3Z" />
                          </svg>
                          <span className={styles.tableTitleDropdownItemText}>Clear data</span>
                        </li>

                        {/* Delete table - disabled when only 1 table */}
                        <li 
                          className={`${styles.tableTitleDropdownItem} ${tables.length <= 1 ? styles.tableTitleDropdownItemDisabled : ''}`}
                          onClick={tables.length > 1 ? handleOpenDeleteTablePopup : undefined}
                        >
                          <svg className={styles.tableTitleDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="nonzero" d="M6.5 6C6.36739 6 6.24021 6.05268 6.14645 6.14645C6.05268 6.24021 6 6.36739 6 6.5V10.5C6 10.6326 6.05268 10.7598 6.14645 10.8536C6.24021 10.9473 6.36739 11 6.5 11C6.63261 11 6.75979 10.9473 6.85355 10.8536C6.94732 10.7598 7 10.6326 7 10.5V6.5C7 6.36739 6.94732 6.24021 6.85355 6.14645C6.75979 6.05268 6.63261 6 6.5 6Z M9.5 6C9.36739 6 9.24021 6.05268 9.14645 6.14645C9.05268 6.24021 9 6.36739 9 6.5V10.5C9 10.6326 9.05268 10.7598 9.14645 10.8536C9.24021 10.9473 9.36739 11 9.5 11C9.63261 11 9.75979 10.9473 9.85355 10.8536C9.94732 10.7598 10 10.6326 10 10.5V6.5C10 6.36739 9.94732 6.24021 9.85355 6.14645C9.75979 6.05268 9.63261 6 9.5 6Z M6.5 1C5.6775 1 5 1.6775 5 2.5V3H2.5C2.36739 3 2.24021 3.05268 2.14645 3.14645C2.05268 3.24021 2 3.36739 2 3.5C2 3.63261 2.05268 3.75979 2.14645 3.85355C2.24021 3.94732 2.36739 4 2.5 4H3V13C3.00007 13.5463 3.45357 13.9999 3.99988 14H12C12.5464 14 13 13.5464 13 13V4H13.5C13.6326 4 13.7598 3.94732 13.8536 3.85355C13.9473 3.75979 14 3.63261 14 3.5C14 3.36739 13.9473 3.24021 13.8536 3.14645C13.7598 3.05268 13.6326 3 13.5 3H11V2.5C10.9999 1.67757 10.3226 1.0001 9.50012 1H6.5ZM6.5 2H9.5C9.78202 2.0001 9.99996 2.21808 10 2.50012V3H6V2.5C6 2.21794 6.21794 2 6.5 2ZM4 4H12V13H4.00012L4 4Z" />
                          </svg>
                          <span className={styles.tableTitleDropdownItemText}>Delete table</span>
                        </li>
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              {/* Table Rename Popup */}
              {isRenamePopupOpen && renamePopupPosition && (
                <div
                  ref={renamePopupRef}
                  className={styles.tableRenamePopup}
                  style={{
                    top: renamePopupPosition.top,
                    left: renamePopupPosition.left,
                  }}
                >
                  {/* Input box */}
                  <input
                    ref={renameInputRef}
                    type="text"
                    className={styles.tableRenameInput}
                    value={renameTableName}
                    onChange={(e) => setRenameTableName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveRename();
                      } else if (e.key === 'Escape') {
                        handleCancelRename();
                      }
                    }}
                  />

                  {/* "What should each record be called?" row */}
                  <div className={styles.tableRenameRecordLabelRow}>
                    <span className={styles.tableRenameRecordLabelText}>What should each record be called?</span>
                    <svg className={styles.tableRenameQuestionIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M8.07349 4.50134C7.75062 4.49155 7.43049 4.55078 7.13904 4.67151C6.36183 4.99344 5.75017 5.76895 5.75 6.74988C5.74997 6.88249 5.80262 7.00968 5.89636 7.10347C5.99011 7.19726 6.11727 7.24997 6.24988 7.25C6.31554 7.25002 6.38056 7.2371 6.44123 7.21199C6.5019 7.18687 6.55703 7.15006 6.60347 7.10364C6.64991 7.05722 6.68675 7.00211 6.71189 6.94145C6.73704 6.8808 6.74998 6.81578 6.75 6.75012C6.75013 6.17215 7.08092 5.77793 7.52173 5.59534C7.96254 5.41275 8.47515 5.45759 8.88391 5.86621C9.24251 6.22468 9.34907 6.75995 9.15503 7.22839C8.96099 7.69684 8.50716 8.00009 8.00012 8C7.93445 7.99999 7.86942 8.01292 7.80875 8.03804C7.74808 8.06316 7.69295 8.09999 7.6465 8.14642C7.60006 8.19285 7.56322 8.24797 7.53809 8.30864C7.51295 8.36931 7.50001 8.43433 7.5 8.5V9C7.5 9.13261 7.55268 9.25979 7.64645 9.35355C7.74021 9.44732 7.86739 9.5 8 9.5C8.13261 9.5 8.25979 9.44732 8.35355 9.35355C8.44732 9.25979 8.5 9.13261 8.5 9V8.93738C9.1999 8.77686 9.79665 8.2924 10.0789 7.61108C10.4266 6.77156 10.2336 5.80137 9.59094 5.15894C9.15735 4.7255 8.61159 4.51766 8.07349 4.50134Z M8 12C8.41419 12 8.75 11.6642 8.75 11.25C8.75 10.8358 8.41419 10.5 8 10.5C7.58581 10.5 7.25 10.8358 7.25 11.25C7.25 11.6642 7.58581 12 8 12Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
                    </svg>
                  </div>

                  {/* Record selector box */}
                  <div className={styles.tableRenameRecordSelector}>
                    <span className={styles.tableRenameRecordText}>{renameRecordName}</span>
                    <svg className={styles.tableRenameChevronIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
                    </svg>
                  </div>

                  {/* Example row */}
                  <div className={styles.tableRenameExampleRow}>
                    <span className={styles.tableRenameExampleLabel}>Examples:</span>
                    <div className={styles.tableRenameExampleItems}>
                      <div className={styles.tableRenameExampleItem}>
                        <svg className={styles.tableRenameExampleIcon} viewBox="0 0 16 16" fill="currentColor">
                          <path fillRule="nonzero" d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z" />
                        </svg>
                        Add {renameRecordName.toLowerCase()}
                      </div>
                      <div className={styles.tableRenameExampleItem}>
                        <svg className={styles.tableRenameExampleIcon} viewBox="0 0 16 16" fill="currentColor">
                          <path fillRule="nonzero" d="M2.5 4H13.5V12H2.50012L2.5 4Z M2 3C1.8674 3.00001 1.74023 3.0527 1.64646 3.14646C1.5527 3.24023 1.50001 3.3674 1.5 3.5V12C1.50007 12.5463 1.95357 12.9999 2.49988 13C2.49984 13 2.49992 13 2.49988 13H13.5C14.0464 13 14.5 12.5464 14.5 12V3.5C14.5 3.3674 14.4473 3.24023 14.3535 3.14646C14.2598 3.0527 14.1326 3.00001 14 3H2ZM1.97827 3.00049C1.84581 3.00625 1.72107 3.06439 1.63147 3.16211C1.54186 3.25985 1.49475 3.38919 1.50049 3.52167C1.50624 3.65414 1.56437 3.77891 1.66211 3.86853L7.66211 9.36853C7.75433 9.45307 7.87489 9.49996 8 9.49996C8.12511 9.49996 8.24567 9.45307 8.33789 9.36853L14.3379 3.86853C14.4356 3.77891 14.4938 3.65414 14.4995 3.52167C14.5053 3.38919 14.4581 3.25985 14.3685 3.16211C14.2789 3.06437 14.1541 3.00624 14.0217 3.00049C13.8892 2.99475 13.7599 3.04186 13.6621 3.13147L8 8.32166L2.33789 3.13147C2.28949 3.08709 2.23281 3.05268 2.17111 3.03021C2.10941 3.00773 2.04388 2.99764 1.97827 3.00049Z" />
                        </svg>
                        Send {renameRecordName.toLowerCase()}s
                      </div>
                    </div>
                  </div>

                  {/* Buttons row */}
                  <div className={styles.tableRenameButtonsRow}>
                    <button 
                      type="button"
                      className={styles.tableRenameCancelButton}
                      onClick={handleCancelRename}
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      className={styles.tableRenameSaveButton}
                      onClick={handleSaveRename}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Right scroll indicator - only render when there's right overflow (scrollProgress < 1) */}
              {hasOverflow && scrollProgress < 1 && (
                <div 
                  className={styles.scrollIndicatorRight}
                  style={{ width: `${Math.min((1 - scrollProgress) * 3, 1) * 40}px` }}
                >
                  {/* Shadow extends over tables (to the left) */}
                  <div className={styles.scrollIndicatorShadowLeft} />
                  {/* Clip wrapper for button */}
                  <div className={styles.scrollIndicatorClip}>
                    <button 
                      className={styles.scrollIndicatorButton}
                      style={{ backgroundColor: getBaseToolbarColor(baseId) }}
                      onClick={() => scrollToEnd('right')}
                      aria-label="Scroll to last table"
                    >
                      <svg className={styles.scrollIndicatorIcon} viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="nonzero" d="M8 1.5C6.71442 1.5 5.45772 1.88122 4.3888 2.59545C3.31988 3.30968 2.48676 4.32484 1.99479 5.51256C1.50282 6.70028 1.37409 8.00721 1.6249 9.26809C1.8757 10.529 2.49477 11.6872 3.40381 12.5962C4.31285 13.5052 5.47104 14.1243 6.73192 14.3751C7.99279 14.6259 9.29973 14.4972 10.4874 14.0052C11.6752 13.5132 12.6903 12.6801 13.4046 11.6112C14.1188 10.5423 14.5 9.28558 14.5 8C14.4967 6.27711 13.8108 4.62573 12.5925 3.40746C11.3743 2.18918 9.7229 1.5033 8 1.5V1.5ZM10.0875 8.36875L7.5875 10.6187C7.49472 10.7021 7.37473 10.7488 7.25 10.75C7.18057 10.7504 7.11184 10.7361 7.0483 10.7081C6.98476 10.6801 6.92784 10.639 6.88125 10.5875C6.79177 10.4897 6.7448 10.3603 6.75066 10.2279C6.75652 10.0955 6.81473 9.97078 6.9125 9.88125L9 8L6.9125 6.11875C6.818 6.02842 6.76263 5.90466 6.75827 5.774C6.7539 5.64334 6.80089 5.51617 6.88915 5.41973C6.97742 5.32329 7.09994 5.26526 7.23048 5.25807C7.36102 5.25087 7.48918 5.29509 7.5875 5.38125L10.0875 7.63125C10.1387 7.67809 10.1795 7.73507 10.2075 7.79855C10.2354 7.86203 10.2498 7.93064 10.2498 8C10.2498 8.06936 10.2354 8.13797 10.2075 8.20145C10.1795 8.26493 10.1387 8.32191 10.0875 8.36875V8.36875Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Tabs Dropdown Button - stays fixed */}
              <div className={`${styles.tableTabsDropdownWrapper} ${!hasOverflow ? styles.tableTabsDropdownWrapperNoScroll : ''}`}>
                <button 
                  ref={tableDropdownButtonRef}
                  className={styles.tableTabsDropdownButton}
                  onClick={() => {
                    setIsTableDropdownOpen(!isTableDropdownOpen);
                    setTableSearchQuery('');
                  }}
                  aria-expanded={isTableDropdownOpen}
                >
                  <svg 
                    className={styles.tableTabsDropdownButtonIcon}
                    viewBox="0 0 16 16" 
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path 
                      fillRule="nonzero" 
                      d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" 
                    />
                  </svg>
                </button>

                {/* Table Dropdown Menu */}
                {isTableDropdownOpen && (
                  <div ref={tableDropdownRef} className={`${styles.tableDropdown} ${tableDropdownAlignRight ? styles.tableDropdownAlignRight : ''}`}>
                    {/* Search Section */}
                    <div className={styles.tableDropdownSearch}>
                      <div className={styles.tableDropdownSearchIcon}>
                        <IconMagnifyingGlass />
                      </div>
                      <input
                        type="text"
                        className={styles.tableDropdownSearchInput}
                        placeholder="Find a table"
                        value={tableSearchQuery}
                        onChange={(e) => setTableSearchQuery(e.target.value)}
                        autoFocus
                      />
                    </div>

                    {/* Table Entries (Scrollable) */}
                    <div className={styles.tableDropdownEntries}>
                      {filteredTables.map((table) => (
                        <div 
                          key={table.id}
                          className={`${styles.tableDropdownEntry} ${hoveredTableId === table.id ? styles.tableDropdownEntryHover : ''}`}
                          onMouseEnter={() => setHoveredTableId(table.id)}
                          onMouseLeave={() => setHoveredTableId(null)}
                          onClick={() => handleTableSelect(table.id)}
                        >
                          {activeTableId === table.id && (
                            <div className={styles.tableDropdownEntryCheck}>
                              <IconCheck />
                            </div>
                          )}
                          <span className={`${styles.tableDropdownEntryText} ${hoveredTableId === table.id ? styles.tableDropdownEntryTextHover : ''}`}>
                            {table.name}
                          </span>
                          {hoveredTableId === table.id && (
                            <>
                              <button className={styles.tableDropdownEntryEyeSlash} onClick={(e) => e.stopPropagation()}>
                                <IconEyeSlash />
                              </button>
                              <div className={styles.tableDropdownEntryDrag}>
                                <IconDotsSixVertical />
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add Table Section */}
                    <div 
                      ref={addTableSectionRef}
                      className={styles.tableDropdownAddSection} 
                      onClick={() => {
                        setAddOrImportOpenedFromTableDropdown(true);
                        setIsAddOrImportDropdownOpen(true);
                      }}
                    >
                      <svg className={styles.tableDropdownAddIcon} viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/>
                      </svg>
                      <span className={styles.tableDropdownAddText}>Add table</span>
                      <svg className={styles.tableDropdownAddChevron} viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Add or Import Button - stays fixed, collapses to just + when > 3 tables */}
              <div className={styles.addOrImportWrapper}>
                <button 
                  ref={addOrImportButtonRef}
                  className={`${styles.addOrImportButton} ${tables.length > 3 ? styles.addOrImportButtonCollapsed : ''} ${!hasOverflow ? styles.addOrImportButtonNoScroll : ''}`} 
                  onClick={() => {
                    setAddOrImportOpenedFromTableDropdown(false);
                    setIsAddOrImportDropdownOpen(!isAddOrImportDropdownOpen);
                  }}
                >
                  <svg 
                    className={styles.addOrImportButtonIcon}
                    viewBox="0 0 16 16" 
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/>
                  </svg>
                  <span className={styles.addOrImportButtonText}>Add or import</span>
                </button>

                {/* Add or Import Dropdown Menu */}
                {isAddOrImportDropdownOpen && addOrImportDropdownPosition && (
                  <ul 
                    ref={addOrImportDropdownRef} 
                    className={styles.addOrImportDropdown}
                    style={{
                      top: addOrImportDropdownPosition.top,
                      left: addOrImportDropdownPosition.left,
                    }}
                  >
                    {/* Section: Add a blank table */}
                    <li className={styles.addOrImportSectionHeader}>Add a blank table</li>
                    
                    {/* Add from scratch */}
                    <li 
                      className={styles.addOrImportMenuItem}
                      onClick={() => {
                        handleAddTable();
                        setIsAddOrImportDropdownOpen(false);
                      }}
                    >
                      <span className={styles.addOrImportMenuItemText}>Start from scratch</span>
                    </li>

                    {/* Divider */}
                    <li className={styles.addOrImportDivider} />

                    {/* Section: Build with Omni */}
                    <li className={styles.addOrImportSectionHeaderOmni}>Build with Omni</li>

                    {/* New table */}
                    <li className={styles.addOrImportMenuItem}>
                      <span className={styles.addOrImportMenuItemText}>New table</span>
                    </li>

                    {/* New table with web data (with Beta badge) */}
                    <li className={styles.addOrImportMenuItem}>
                      <div className={styles.addOrImportMenuItemWithBadge}>
                        <span className={styles.addOrImportMenuItemText}>New table with web data</span>
                        <span className={styles.addOrImportBetaBadge}>Beta</span>
                      </div>
                    </li>

                    {/* Divider */}
                    <li className={styles.addOrImportDivider} />

                    {/* Section: Add from other sources */}
                    <li className={styles.addOrImportSectionHeaderSources}>Add from other sources</li>

                    {/* Item 1: Airtable base */}
                    <li className={styles.addOrImportMenuItem}>
                      <svg
                        className={styles.addOrImportItemIconAirtable}
                        viewBox="0 0 200 170"
                        aria-hidden="true"
                      >
                        <g>
                          <path fill="rgb(255, 186, 5)" d="M90.0389,12.3675 L24.0799,39.6605 C20.4119,41.1785 20.4499,46.3885 24.1409,47.8515 L90.3759,74.1175 C96.1959,76.4255 102.6769,76.4255 108.4959,74.1175 L174.7319,47.8515 C178.4219,46.3885 178.4609,41.1785 174.7919,39.6605 L108.8339,12.3675 C102.8159,9.8775 96.0559,9.8775 90.0389,12.3675" />
                          <path fill="rgb(57, 202, 255)" d="M105.3122,88.4608 L105.3122,154.0768 C105.3122,157.1978 108.4592,159.3348 111.3602,158.1848 L185.1662,129.5368 C186.8512,128.8688 187.9562,127.2408 187.9562,125.4288 L187.9562,59.8128 C187.9562,56.6918 184.8092,54.5548 181.9082,55.7048 L108.1022,84.3528 C106.4182,85.0208 105.3122,86.6488 105.3122,88.4608" />
                          <path fill="rgb(220, 4, 59)" d="M88.0781,91.8464 L66.1741,102.4224 L63.9501,103.4974 L17.7121,125.6524 C14.7811,127.0664 11.0401,124.9304 11.0401,121.6744 L11.0401,60.0884 C11.0401,58.9104 11.6441,57.8934 12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464" />
                          <path fill="rgba(29, 31, 37, 0.25)" d="M88.0781,91.8464 L66.1741,102.4224 L12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464" />
                        </g>
                      </svg>
                      <span className={styles.addOrImportItemText}>Airtable base</span>
                      <span className={styles.addOrImportTeamBadge}>
                        <svg
                          className={styles.addOrImportBadgeIcon}
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                        </svg>
                        Team
                      </span>
                    </li>

                    {/* Item 2: CSV file */}
                    <li className={styles.addOrImportMenuItem}>
                      <svg
                        className={styles.addOrImportItemIconCsv}
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path fillRule="nonzero" d="M9.5 1.5C9.36739 1.5 9.24021 1.55268 9.14645 1.64645C9.05268 1.74021 9 1.86739 9 2V5.5C9.00001 5.6326 9.0527 5.75977 9.14646 5.85354C9.24023 5.9473 9.3674 5.99999 9.5 6H13C13.1326 6 13.2598 5.94732 13.3536 5.85355C13.4473 5.75979 13.5 5.63261 13.5 5.5C13.5 5.36739 13.4473 5.24021 13.3536 5.14645C13.2598 5.05268 13.1326 5 13 5H10V2C10 1.86739 9.94732 1.74021 9.85355 1.64645C9.75979 1.55268 9.63261 1.5 9.5 1.5Z M3.5 1.5C2.95364 1.5 2.5 1.95364 2.5 2.5V8C2.5 8.13261 2.55268 8.25979 2.64645 8.35355C2.74021 8.44732 2.86739 8.5 3 8.5C3.13261 8.5 3.25979 8.44732 3.35355 8.35355C3.44732 8.25979 3.5 8.13261 3.5 8V2.5H9.29285L12.5 5.70715V8C12.5 8.13261 12.5527 8.25979 12.6464 8.35355C12.7402 8.44732 12.8674 8.5 13 8.5C13.1326 8.5 13.2598 8.44732 13.3536 8.35355C13.4473 8.25979 13.5 8.13261 13.5 8V5.5C13.5 5.36739 13.4473 5.24021 13.3536 5.14645L9.85355 1.64645C9.75979 1.55268 9.63261 1.5 9.5 1.5H3.5Z M7.9375 9.9375C7.56366 9.9375 7.20561 10.0424 6.93237 10.2766C6.65914 10.5108 6.5 10.875 6.5 11.25C6.5 11.6622 6.78759 12.0162 7.06567 12.1741C7.34376 12.3319 7.62393 12.3941 7.87158 12.4598C8.11923 12.5256 8.33284 12.595 8.42737 12.6526C8.52189 12.7102 8.5 12.6667 8.5 12.75C8.5 12.9292 8.47991 12.9248 8.41016 12.9695C8.3405 13.0141 8.16358 13.0622 7.93835 13.0624C7.70783 13.0617 7.48374 12.9871 7.29895 12.8492C7.19266 12.77 7.05923 12.7362 6.92801 12.7552C6.79679 12.7743 6.67853 12.8448 6.59924 12.951C6.51996 13.0573 6.48615 13.1908 6.50524 13.322C6.52433 13.4532 6.59477 13.5715 6.70105 13.6508C7.05787 13.9169 7.49099 14.0613 7.93616 14.0625C7.93661 14.0625 7.93705 14.0625 7.9375 14.0625C8.2743 14.0625 8.62835 14.0171 8.94922 13.8118C9.27009 13.6064 9.5 13.1958 9.5 12.75C9.5 12.3333 9.2281 11.9695 8.94763 11.7986C8.66716 11.6277 8.38077 11.5603 8.12842 11.4933C7.87607 11.4263 7.65624 11.3595 7.55933 11.3044C7.46241 11.2494 7.5 11.3066 7.5 11.25C7.5 11.125 7.52836 11.0829 7.58325 11.0359C7.63805 10.9889 7.74867 10.9378 7.93677 10.9376C8.16725 10.9384 8.39129 11.0129 8.57605 11.1508C8.68234 11.23 8.81577 11.2638 8.94699 11.2448C9.07821 11.2257 9.19647 11.1552 9.27576 11.049C9.35504 10.9427 9.38885 10.8092 9.36976 10.678C9.35067 10.5468 9.28023 10.4285 9.17395 10.3492C8.81713 10.0831 8.38401 9.93865 7.93884 9.9375C7.93839 9.9375 7.93795 9.9375 7.9375 9.9375Z M4.125 10C3.07015 10 2.25 10.9231 2.25 12C2.25 13.0769 3.07015 14 4.125 14C4.12634 14 4.12769 14 4.12903 14C4.57646 13.9964 5.00715 13.8272 5.3374 13.5253C5.38586 13.481 5.42512 13.4275 5.45294 13.3681C5.48076 13.3086 5.49659 13.2442 5.49952 13.1786C5.50246 13.113 5.49244 13.0475 5.47005 12.9857C5.44766 12.924 5.41333 12.8673 5.36902 12.8188C5.32471 12.7704 5.27129 12.7311 5.21181 12.7033C5.15233 12.6755 5.08795 12.6597 5.02236 12.6567C4.95676 12.6538 4.89122 12.6638 4.8295 12.6862C4.76777 12.7086 4.71106 12.7429 4.6626 12.7872C4.51478 12.9224 4.32267 12.9978 4.12244 12.9998C3.6534 12.9982 3.25 12.5846 3.25 12C3.25 11.4154 3.6534 11.0018 4.12244 11.0002C4.32267 11.0022 4.51478 11.0776 4.6626 11.2128C4.71106 11.2571 4.76777 11.2914 4.8295 11.3138C4.89122 11.3362 4.95676 11.3462 5.02236 11.3433C5.08795 11.3403 5.15233 11.3245 5.21181 11.2967C5.27129 11.2689 5.32471 11.2296 5.36902 11.1812C5.41333 11.1327 5.44766 11.076 5.47005 11.0143C5.49244 10.9525 5.50246 10.887 5.49952 10.8214C5.49659 10.7558 5.48076 10.6914 5.45294 10.6319C5.42512 10.5725 5.38586 10.519 5.3374 10.4747C5.00715 10.1728 4.57646 10.0036 4.12903 10C4.12769 9.99999 4.12634 9.99999 4.125 10Z M10.9404 10.0377C10.8797 10.0127 10.8147 9.9999 10.749 10C10.6833 10.0001 10.6184 10.0132 10.5577 10.0385C10.4353 10.0894 10.3382 10.187 10.2877 10.3096C10.2372 10.4322 10.2375 10.5698 10.2885 10.6923L11.5385 13.6923C11.5764 13.7834 11.6405 13.8612 11.7227 13.9159C11.8048 13.9707 11.9013 13.9999 12 13.9999C12.0987 13.9999 12.1952 13.9707 12.2773 13.9159C12.3595 13.8612 12.4236 13.7834 12.4615 13.6923L13.7115 10.6923C13.7625 10.5698 13.7628 10.4322 13.7123 10.3096C13.6618 10.187 13.5647 10.0894 13.4423 10.0385C13.3199 9.98746 13.1822 9.98719 13.0596 10.0377C12.937 10.0882 12.8394 10.1853 12.7885 10.3077L12 12.2001L11.2115 10.3077C11.1606 10.1853 11.063 10.0882 10.9404 10.0377Z" />
                      </svg>
                      <span className={styles.addOrImportItemText}>CSV file</span>
                    </li>

                    {/* Item 3: Google Calendar */}
                    <li className={styles.addOrImportMenuItem}>
                      <svg
                        className={styles.addOrImportItemIconGoogle}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path d="M11.4211 14.5003L14.5 11.4214H11.4211V14.5003Z" fill="#EA4335"/>
                        <path d="M14.5 4.57861H11.4211V11.4207H14.5V4.57861Z" fill="#FBBC04"/>
                        <path d="M11.4211 11.4214H4.57895V14.5003H11.4211V11.4214Z" fill="#34A853"/>
                        <path d="M1.5 11.4214V13.474C1.5 14.0411 1.95928 14.5003 2.52632 14.5003H4.57895V11.4214H1.5Z" fill="#188038"/>
                        <path d="M14.5 4.57895V2.52632C14.5 1.95928 14.0407 1.5 13.4737 1.5H11.4211V4.57895H14.5Z" fill="#1967D2"/>
                        <path d="M11.4211 1.5H2.52632C1.95928 1.5 1.5 1.95928 1.5 2.52632V11.4211H4.57895V4.57895H11.4211V1.5Z" fill="#4285F4"/>
                        <path d="M5.98241 9.88658C5.72669 9.71381 5.54965 9.46151 5.453 9.12796L6.04656 8.88335C6.10044 9.08862 6.19452 9.2477 6.32879 9.36059C6.46221 9.47349 6.62471 9.52908 6.81458 9.52908C7.00873 9.52908 7.1755 9.47006 7.31491 9.35204C7.45432 9.23401 7.52445 9.08348 7.52445 8.90131C7.52445 8.71487 7.4509 8.56263 7.30379 8.4446C7.15669 8.32658 6.97195 8.26756 6.75129 8.26756H6.40833V7.68H6.71623C6.90609 7.68 7.06603 7.62868 7.19603 7.52605C7.32603 7.42342 7.39103 7.28316 7.39103 7.10441C7.39103 6.94533 7.33287 6.81875 7.21655 6.72381C7.10024 6.62888 6.95314 6.58099 6.77439 6.58099C6.59991 6.58099 6.46136 6.62717 6.35873 6.72039C6.25616 6.81386 6.17905 6.93188 6.13465 7.06335L5.54708 6.81875C5.62491 6.59809 5.76774 6.40309 5.97728 6.2346C6.18682 6.06612 6.45452 5.98145 6.77952 5.98145C7.01985 5.98145 7.23623 6.02763 7.42781 6.12085C7.61938 6.21408 7.76991 6.34322 7.87853 6.50743C7.98715 6.6725 8.04103 6.85723 8.04103 7.0625C8.04103 7.27204 7.99057 7.44908 7.88965 7.59447C7.78873 7.73987 7.66471 7.85105 7.51761 7.92888V7.96395C7.70755 8.04226 7.87255 8.17088 7.99484 8.33598C8.11886 8.50276 8.18129 8.70204 8.18129 8.93467C8.18129 9.1673 8.12228 9.37513 8.00425 9.5573C7.88623 9.73947 7.72287 9.88316 7.5159 9.9875C7.30807 10.0918 7.07458 10.1449 6.81544 10.1449C6.51524 10.1457 6.23813 10.0593 5.98241 9.88658ZM9.6284 6.94105L8.97669 7.4123L8.65083 6.91796L9.81998 6.07467H10.2681V10.0525H9.6284V6.94105Z" fill="#4285F4"/>
                      </svg>
                      <span className={styles.addOrImportItemText}>Google Calendar</span>
                      <span className={styles.addOrImportTeamBadge}>
                        <svg
                          className={styles.addOrImportBadgeIcon}
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                        </svg>
                        Team
                      </span>
                    </li>
                    {/* Item 4: Google Sheets */}
                    <li className={styles.addOrImportMenuItem}>
                      <svg
                        className={styles.addOrImportItemIconGoogleSheets}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path d="M12.333 15H3.66699C3.40178 15 3.14742 14.8946 2.95989 14.7071C2.77235 14.5196 2.66699 14.2652 2.66699 14V2C2.66699 1.73478 2.77235 1.48043 2.95989 1.29289C3.14742 1.10536 3.40178 1 3.66699 1H9.99999L13.333 4.333V14C13.333 14.2652 13.2276 14.5196 13.0401 14.7071C12.8526 14.8946 12.5982 15 12.333 15Z" fill="#43A047"/>
                        <path d="M13.333 4.333H10V1L13.333 4.333Z" fill="#C8E6C9"/>
                        <path d="M10 4.3335L13.333 7.6675V4.3335H10Z" fill="#2E7D32"/>
                        <path d="M10.333 7.66699H5V12.333H11V7.66699H10.333ZM5.667 8.33299H7V8.99999H5.667V8.33299ZM5.667 9.66699H7V10.333H5.667V9.66699ZM5.667 11H7V11.667H5.667V11ZM10.333 11.667H7.667V11H10.333V11.667ZM10.333 10.333H7.667V9.66699H10.333V10.333ZM10.333 8.99999H7.667V8.33299H10.333V8.99999Z" fill="#E8F5E9"/>
                      </svg>
                      <span className={styles.addOrImportItemText}>Google Sheets</span>
                    </li>

                    {/* Item 5: Microsoft Excel */}
                    <li className={styles.addOrImportMenuItem}>
                      <svg
                        className={styles.addOrImportItemIconExcel}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <rect x="4.5" y="2.125" width="10.5" height="12.25" rx="0.875" fill="#2FB776"/>
                        <path d="M4.5 11.3125H15V13.5C15 13.9832 14.6082 14.375 14.125 14.375H5.375C4.89175 14.375 4.5 13.9832 4.5 13.5V11.3125Z" fill="url(#paint0_linear_excel)"/>
                        <rect x="9.75" y="8.25" width="5.25" height="3.0625" fill="#229C5B"/>
                        <rect x="9.75" y="5.1875" width="5.25" height="3.0625" fill="#27AE68"/>
                        <path d="M4.5 3C4.5 2.51675 4.89175 2.125 5.375 2.125H9.75V5.1875H4.5V3Z" fill="#1D854F"/>
                        <rect x="4.5" y="5.1875" width="5.25" height="3.0625" fill="#197B43"/>
                        <rect x="4.5" y="8.25" width="5.25" height="3.0625" fill="#1B5B38"/>
                        <path d="M4.5 6.5C4.5 5.77513 5.08763 5.1875 5.8125 5.1875H8.4375C9.16237 5.1875 9.75 5.77513 9.75 6.5V11.75C9.75 12.4749 9.16237 13.0625 8.4375 13.0625H4.5V6.5Z" fill="black" fillOpacity="0.3"/>
                        <rect x="1" y="4.3125" width="7.875" height="7.875" rx="0.875" fill="url(#paint1_linear_excel)"/>
                        <path d="M6.6875 10.4375L5.45468 8.20625L6.63338 6.0625H5.67118L4.94351 7.43125L4.22788 6.0625H3.23561L4.42032 8.20625L3.1875 10.4375H4.1497L4.92547 8.9875L5.69523 10.4375H6.6875Z" fill="white"/>
                        <defs>
                          <linearGradient id="paint0_linear_excel" x1="4.5" y1="12.8437" x2="15" y2="12.8438" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#163C27"/>
                            <stop offset="1" stopColor="#2A6043"/>
                          </linearGradient>
                          <linearGradient id="paint1_linear_excel" x1="1" y1="8.25" x2="8.875" y2="8.25" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#185A30"/>
                            <stop offset="1" stopColor="#176F3D"/>
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className={styles.addOrImportItemText}>Microsoft Excel</span>
                    </li>

                    {/* Item 6: Salesforce */}
                    <li className={styles.addOrImportMenuItem}>
                      <svg
                        className={styles.addOrImportItemIconSalesforce}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path fillRule="evenodd" clipRule="evenodd" d="M6.6174 3.64849C7.13009 3.1144 7.84436 2.78275 8.63392 2.78275C9.68349 2.78275 10.5995 3.36814 11.0871 4.23718C11.5235 4.04228 11.9961 3.94183 12.4739 3.9424C14.3671 3.9424 15.9017 5.49057 15.9017 7.40066C15.9017 9.31075 14.3671 10.8589 12.4739 10.8589C12.2424 10.8589 12.0167 10.8358 11.7984 10.7918C11.3691 11.5575 10.5503 12.0751 9.61096 12.0751C9.21775 12.0751 8.84575 11.9847 8.51479 11.8227C8.07931 12.8471 7.06488 13.565 5.88279 13.565C4.65183 13.565 3.60244 12.7859 3.19983 11.6935C3.02045 11.7314 2.8376 11.7504 2.65427 11.7504C1.18836 11.7506 7.37231e-06 10.5499 7.37231e-06 9.06866C-0.00109238 8.59925 0.120866 8.13775 0.353723 7.73016C0.586581 7.32258 0.922205 6.98314 1.32714 6.7457C1.15915 6.35861 1.07271 5.94106 1.07322 5.51909C1.07322 3.81544 2.45601 2.43457 4.16175 2.43457C4.63692 2.43402 5.1058 2.54329 5.53177 2.75387C5.95775 2.96444 6.32929 3.27061 6.6174 3.64849Z" fill="#00A1E0"/>
                        <path fillRule="evenodd" clipRule="evenodd" d="M2.30333 8.20671L2.36768 8.0281C2.37794 7.9975 2.40107 8.00758 2.41046 8.01332C2.42838 8.02393 2.44125 8.0335 2.46438 8.04706C2.65394 8.16689 2.82959 8.1681 2.88438 8.1681C3.02629 8.1681 3.11429 8.09297 3.11429 7.99158V7.98637C3.11429 7.87611 2.97864 7.83437 2.82194 7.78637L2.78716 7.77524C2.57203 7.71402 2.34194 7.6255 2.34194 7.35315V7.34758C2.34194 7.08915 2.55046 6.9088 2.8489 6.9088L2.88159 6.90845C3.0569 6.90845 3.22629 6.95941 3.34907 7.03384C3.3602 7.0408 3.37099 7.05367 3.36472 7.07071L3.29864 7.24932C3.28699 7.27976 3.25516 7.25958 3.25516 7.25958C3.12706 7.19283 2.98531 7.15647 2.8409 7.15332C2.71429 7.15332 2.6329 7.22045 2.6329 7.31158V7.31732C2.6329 7.42358 2.77238 7.46897 2.93412 7.52167L2.96194 7.53037C3.17638 7.59819 3.40525 7.69211 3.40525 7.95037V7.95576C3.40525 8.23489 3.20246 8.40828 2.87638 8.40828C2.7162 8.40828 2.56299 8.38358 2.4009 8.2975C2.37029 8.27976 2.34003 8.26445 2.31012 8.24271C2.30699 8.23819 2.29325 8.2328 2.30316 8.20671H2.30333ZM7.07846 8.20671L7.14299 8.0281C7.15238 7.99889 7.17968 8.00967 7.18559 8.01332C7.20333 8.02428 7.21655 8.0335 7.23951 8.04706C7.42942 8.16689 7.60472 8.1681 7.66003 8.1681C7.80142 8.1681 7.8896 8.09297 7.8896 7.99158V7.98637C7.8896 7.87611 7.75412 7.83437 7.59742 7.78637L7.56264 7.77524C7.34716 7.71402 7.11707 7.6255 7.11707 7.35315V7.34758C7.11707 7.08915 7.32577 6.9088 7.6242 6.9088L7.65672 6.90845C7.83203 6.90845 8.00159 6.95941 8.12455 7.03384C8.13533 7.0408 8.14629 7.05367 8.1402 7.07071C8.13412 7.08654 8.07985 7.23263 8.07412 7.24932C8.06212 7.27976 8.03064 7.25958 8.03064 7.25958C7.90249 7.19281 7.76067 7.15645 7.6162 7.15332C7.48959 7.15332 7.4082 7.22045 7.4082 7.31158V7.31732C7.4082 7.42358 7.54751 7.46897 7.70942 7.52167L7.73725 7.53037C7.95168 7.59819 8.18038 7.69211 8.18038 7.95037V7.95576C8.18038 8.23489 7.97777 8.40828 7.65168 8.40828C7.49133 8.40828 7.33812 8.38358 7.1762 8.2975C7.14559 8.27976 7.11533 8.26445 7.08525 8.24271C7.08212 8.23819 7.06838 8.2328 7.07846 8.20671ZM10.6106 7.36689C10.6374 7.45663 10.6506 7.55524 10.6506 7.65941C10.6506 7.76376 10.6374 7.86202 10.6106 7.95176C10.5861 8.03829 10.5441 8.11886 10.4872 8.18845C10.4301 8.25604 10.3585 8.3099 10.2778 8.34602C10.1943 8.38428 10.0962 8.40341 9.98594 8.40341C9.87568 8.40341 9.77725 8.38428 9.69412 8.34602C9.61336 8.3099 9.54179 8.25604 9.48472 8.18845C9.42782 8.11886 9.38574 8.03837 9.36107 7.95193C9.33373 7.85686 9.32026 7.75833 9.32107 7.65941C9.32107 7.55506 9.33446 7.45663 9.36107 7.36689C9.38786 7.27645 9.42942 7.1968 9.48455 7.13037C9.54176 7.0625 9.61334 7.0082 9.69412 6.97141C9.77742 6.93245 9.87533 6.9128 9.98594 6.9128C10.0966 6.9128 10.1945 6.93245 10.2778 6.97141C10.3609 7.01019 10.4315 7.06358 10.4872 7.13037C10.5425 7.1968 10.5842 7.27645 10.6106 7.36689ZM10.3386 7.65941C10.3386 7.50167 10.3094 7.37767 10.2513 7.29071C10.1939 7.20445 10.107 7.16271 9.98594 7.16271C9.8649 7.16271 9.77864 7.20445 9.72194 7.29071C9.66507 7.37767 9.63603 7.50167 9.63603 7.65941C9.63603 7.81697 9.66507 7.94184 9.72229 8.0295C9.77864 8.1168 9.8649 8.15906 9.98594 8.15906C10.107 8.15906 10.1939 8.11663 10.2513 8.0295C10.3091 7.94184 10.3386 7.81697 10.3386 7.65941ZM12.8468 8.1168L12.9136 8.3015C12.9223 8.32411 12.9026 8.33402 12.9026 8.33402C12.7995 8.37402 12.6564 8.40254 12.5171 8.40254C12.2809 8.40254 12.1 8.33454 11.9793 8.20028C11.8593 8.06637 11.7981 7.88428 11.7981 7.65837C11.7981 7.55384 11.8132 7.45489 11.8428 7.36532C11.8724 7.27489 11.9167 7.19524 11.9752 7.1288C12.0358 7.0605 12.1107 7.00626 12.1945 6.96984C12.2814 6.93106 12.3837 6.91158 12.4978 6.91158C12.5748 6.91158 12.6433 6.91628 12.7021 6.92497C12.7649 6.93471 12.8486 6.95732 12.8839 6.97106C12.8903 6.9735 12.9082 6.98219 12.9009 7.00324C12.8752 7.07576 12.8576 7.12306 12.8338 7.18915C12.8233 7.21732 12.8021 7.20793 12.8021 7.20793C12.7126 7.17976 12.6266 7.16689 12.5145 7.16689C12.3797 7.16689 12.2785 7.21176 12.2124 7.29958C12.1456 7.38811 12.1082 7.50411 12.1077 7.65837C12.1072 7.82758 12.1496 7.95297 12.2247 8.03054C12.2997 8.10793 12.4044 8.14706 12.5362 8.14706C12.5896 8.14706 12.64 8.14358 12.6854 8.13645C12.7303 8.12932 12.7724 8.11541 12.812 8.09993C12.812 8.09993 12.8376 8.09037 12.8468 8.1168ZM14.2399 7.31558C14.2992 7.52324 14.2682 7.70254 14.2672 7.71245C14.2649 7.73611 14.2406 7.73645 14.2406 7.73645L13.319 7.73576C13.3247 7.87576 13.3583 7.97489 13.4261 8.04219C13.4927 8.10811 13.5985 8.15037 13.7416 8.15054C13.9604 8.15106 14.0538 8.10706 14.12 8.08254C14.12 8.08254 14.1452 8.0735 14.1548 8.09854L14.2148 8.26741C14.227 8.29576 14.2172 8.30567 14.207 8.31141C14.1492 8.34324 14.0092 8.40271 13.7428 8.40341C13.6136 8.40393 13.5011 8.3855 13.4084 8.3495C13.3203 8.31687 13.241 8.26431 13.1766 8.19593C13.115 8.12884 13.0693 8.04878 13.0428 7.96167C13.0143 7.86622 13.0003 7.76703 13.0012 7.66741C13.0012 7.56306 13.0146 7.46393 13.0416 7.37332C13.0686 7.28202 13.1105 7.2015 13.1663 7.13384C13.2241 7.0648 13.2967 7.00954 13.3786 6.97211C13.4632 6.93228 13.5679 6.9128 13.683 6.9128C13.7816 6.9128 13.8717 6.93402 13.9466 6.96637C14.0044 6.99106 14.0625 7.03576 14.1219 7.09976C14.1595 7.14011 14.2167 7.22845 14.2399 7.31558ZM13.3233 7.50811H13.9807C13.9739 7.42358 13.9574 7.34776 13.9195 7.29071C13.8618 7.20445 13.7821 7.15697 13.6612 7.15697C13.5402 7.15697 13.4543 7.20445 13.3974 7.29071C13.3602 7.34776 13.3362 7.42045 13.3232 7.50811H13.3233ZM6.85812 7.31558C6.91725 7.52324 6.88681 7.70254 6.88577 7.71245C6.88333 7.73611 6.85899 7.73645 6.85899 7.73645L5.93725 7.73576C5.94316 7.87576 5.97655 7.97489 6.04455 8.04219C6.11116 8.10811 6.21672 8.15037 6.35986 8.15054C6.57864 8.15106 6.67238 8.10706 6.73846 8.08254C6.73846 8.08254 6.76368 8.0735 6.77307 8.09854L6.83325 8.26741C6.84542 8.29576 6.83568 8.30567 6.82559 8.31141C6.76751 8.34324 6.62733 8.40271 6.36125 8.40341C6.23186 8.40393 6.11933 8.3855 6.02681 8.3495C5.9387 8.31683 5.85931 8.26428 5.79481 8.19593C5.73343 8.12877 5.68785 8.04873 5.66142 7.96167C5.63269 7.86626 5.61856 7.76705 5.61951 7.66741C5.61951 7.56306 5.63307 7.46393 5.65986 7.37332C5.68491 7.2859 5.72739 7.20444 5.78473 7.13384C5.84257 7.06485 5.91505 7.0096 5.9969 6.97211C6.08177 6.93228 6.18646 6.9128 6.30125 6.9128C6.39197 6.91259 6.48178 6.93081 6.56525 6.96637C6.62299 6.99106 6.68107 7.03576 6.74038 7.09976C6.77794 7.14011 6.83516 7.22845 6.85812 7.31558ZM5.94142 7.50811H6.59916C6.5922 7.42358 6.57568 7.34776 6.53794 7.29071C6.48055 7.20445 6.40055 7.15697 6.27968 7.15697C6.15864 7.15697 6.07255 7.20445 6.01603 7.29071C5.97846 7.34776 5.95464 7.42045 5.94125 7.50811H5.94142ZM4.31603 7.46411C4.31603 7.46411 4.38872 7.47054 4.46803 7.48202V7.44306C4.46803 7.32011 4.44246 7.26219 4.3922 7.22341C4.34072 7.1841 4.26386 7.16376 4.16438 7.16376C4.16438 7.16376 3.94003 7.16097 3.76264 7.25732C3.75446 7.26219 3.74768 7.26497 3.74768 7.26497C3.74768 7.26497 3.72542 7.2728 3.71742 7.25002L3.6522 7.07471C3.64212 7.0495 3.66038 7.03802 3.66038 7.03802C3.74333 6.97332 3.94438 6.93419 3.94438 6.93419C4.02599 6.91985 4.10865 6.91223 4.19151 6.91141C4.37551 6.91141 4.51794 6.95419 4.61481 7.03889C4.71186 7.12393 4.76125 7.26097 4.76125 7.44567L4.76177 8.2888C4.76177 8.2888 4.76368 8.31315 4.74055 8.31871C4.74055 8.31871 4.70664 8.32811 4.6762 8.33524C4.64542 8.34237 4.53446 8.36497 4.44386 8.38028C4.35133 8.39578 4.25767 8.40358 4.16386 8.40358C4.07429 8.40358 3.9922 8.39524 3.91986 8.37871C3.85243 8.36459 3.78859 8.3369 3.7322 8.29732C3.68082 8.26001 3.63957 8.21045 3.6122 8.15315C3.58386 8.09524 3.56959 8.02445 3.56959 7.94271C3.56959 7.86254 3.58646 7.79106 3.61899 7.73019C3.65168 7.66967 3.69655 7.61837 3.7529 7.57819C3.81111 7.53721 3.8762 7.50699 3.94507 7.48897C4.0169 7.46984 4.09325 7.45993 4.1722 7.45993C4.23012 7.45993 4.27846 7.46115 4.31603 7.46411ZM3.94925 8.11176C3.94872 8.11158 4.03185 8.17697 4.21951 8.1655C4.35133 8.1575 4.4682 8.13245 4.4682 8.13245V7.71332C4.4682 7.71332 4.35029 7.69402 4.21794 7.69211C4.03029 7.68984 3.95029 7.75889 3.95081 7.75871C3.89551 7.79802 3.86855 7.85628 3.86855 7.93697C3.86855 7.98863 3.87777 8.02898 3.89638 8.05715C3.90803 8.07576 3.91307 8.08271 3.94925 8.11176ZM11.7501 6.98915C11.7414 7.01437 11.6967 7.14063 11.6806 7.18254C11.6746 7.19854 11.6649 7.2095 11.647 7.20758C11.647 7.20758 11.5941 7.19541 11.5458 7.19541C11.5126 7.19541 11.4651 7.19958 11.4223 7.2128C11.3794 7.22599 11.3403 7.24945 11.3086 7.28115C11.2748 7.31367 11.2475 7.35941 11.2277 7.4168C11.2075 7.47454 11.1971 7.56637 11.1971 7.65854V8.34515C11.1971 8.34882 11.1964 8.35245 11.195 8.35585C11.1936 8.35925 11.1916 8.36233 11.189 8.36494C11.1864 8.36754 11.1833 8.36961 11.1799 8.37101C11.1765 8.37242 11.1729 8.37315 11.1692 8.37315H10.9273C10.9236 8.37319 10.92 8.37251 10.9165 8.37114C10.9131 8.36976 10.91 8.36773 10.9073 8.36514C10.9047 8.36256 10.9025 8.35948 10.9011 8.35608C10.8996 8.35268 10.8989 8.34902 10.8988 8.34532V6.97054C10.8988 6.95506 10.9101 6.94271 10.9256 6.94271H11.1616C11.1772 6.94271 11.1884 6.95506 11.1884 6.97054V7.08289C11.2237 7.03558 11.287 6.99384 11.3442 6.96811C11.4016 6.94202 11.4658 6.92289 11.5818 6.92984C11.6421 6.9335 11.7206 6.95002 11.7364 6.95611C11.7395 6.95734 11.7423 6.95919 11.7447 6.96153C11.747 6.96387 11.7489 6.96666 11.7502 6.96974C11.7515 6.97282 11.7521 6.97612 11.7521 6.97945C11.7521 6.98278 11.7514 6.98608 11.7501 6.98915ZM9.47707 6.3521C9.48351 6.35471 9.50107 6.36324 9.49412 6.3841L9.42333 6.57767C9.41742 6.59228 9.41359 6.60097 9.38351 6.59193C9.34372 6.57942 9.30226 6.57297 9.26055 6.5728C9.22403 6.5728 9.19099 6.5775 9.16177 6.58724C9.13253 6.5966 9.10603 6.61295 9.08455 6.63489C9.05597 6.66251 9.03387 6.69613 9.01986 6.73332C8.98594 6.83071 8.9729 6.93454 8.97116 6.94115H9.26577C9.29064 6.94115 9.29846 6.95263 9.29603 6.97089L9.26159 7.16254C9.25603 7.19037 9.23081 7.18932 9.23081 7.18932H8.92716L8.71968 8.36428C8.70184 8.46965 8.67472 8.57325 8.63864 8.67384C8.60612 8.75889 8.57255 8.82097 8.51864 8.88028C8.47262 8.93335 8.41411 8.97412 8.34838 8.99889C8.28455 9.02237 8.20699 9.03437 8.12229 9.03437C8.08194 9.03437 8.03846 9.0335 7.98716 9.02132C7.95857 9.01479 7.93041 9.00655 7.90281 8.99663C7.89151 8.99263 7.88229 8.97819 7.8889 8.95976C7.89516 8.9415 7.94977 8.79211 7.95707 8.77245C7.96646 8.7488 7.99046 8.75784 7.99046 8.75784C8.00681 8.7648 8.01829 8.76932 8.04003 8.77367C8.06212 8.77802 8.09168 8.78184 8.11412 8.78184C8.15429 8.78184 8.19081 8.77698 8.22264 8.76619C8.2609 8.75384 8.28351 8.73141 8.30681 8.7015C8.33116 8.67002 8.35099 8.62741 8.37133 8.57019C8.39168 8.51228 8.41029 8.43576 8.42629 8.34306L8.6329 7.1895H8.42942C8.40507 7.1895 8.39673 7.17802 8.39951 7.15958L8.43359 6.96793C8.43899 6.9401 8.4649 6.94115 8.4649 6.94115H8.67377L8.68507 6.87889C8.71638 6.69384 8.77846 6.55315 8.87029 6.4608C8.96264 6.36776 9.09394 6.3208 9.26055 6.3208C9.3082 6.3208 9.35029 6.32393 9.38594 6.33037C9.4209 6.33697 9.44751 6.34306 9.47707 6.3521ZM5.35951 8.34515C5.35951 8.3608 5.34873 8.37315 5.33307 8.37315H5.08872C5.07307 8.37315 5.06246 8.36063 5.06246 8.34532V6.37784C5.06246 6.36271 5.07325 6.35019 5.08855 6.35019H5.33307C5.34873 6.35019 5.35951 6.36271 5.35951 6.37802V8.34515Z" fill="white"/>
                      </svg>
                      <span className={styles.addOrImportItemText}>Salesforce</span>
                      <span className={styles.addOrImportBusinessBadge}>
                        <svg
                          className={styles.addOrImportBadgeIcon}
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                        </svg>
                        Business
                      </span>
                    </li>
                    {/* Item 7: Smartsheet */}
                    <li className={styles.addOrImportMenuItem}>
                      <svg
                        className={styles.addOrImportItemIconSmartsheet}
                        width="16"
                        height="16"
                        viewBox="0 0 165 165"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M19 76.7c0 40.1-.5 75.7-1 79.3-.5 3.5-.7 6.6-.5 6.9 1 .9 26.5-5 39-9 21.4-6.8 43.7-17.7 55.5-27 2.7-2.1 5.3-3.9 5.7-3.9.4 0 2.4 3 4.3 6.8 4.5 8.6 11.9 16.5 15.1 16 5.4-.7 5.4-1 5.6-68.8l.3-62.5-2.6 3c-4 4.7-18.5 26.9-25.4 39-7.2 12.5-24.9 48.3-30.9 62.5-2.3 5.4-4.2 8.8-4.5 8-.3-.8-2-5.6-3.7-10.5C67 90.6 52.8 69 44.8 69c-3 0-.5-3.5 4.6-6.5 4.8-2.8 9.4-3.2 13.5-1.1 3.7 2 10.2 9.2 13.6 15.2 1.6 2.7 3.7 6.4 4.8 8.2l2 3.4 6.6-12.9c10.8-20.9 25.3-41.1 42.6-59.3 4.4-4.7 8.7-9.3 9.4-10.3 1.3-1.6-1.8-1.7-60.8-1.7H19v72.7z"/>
                      </svg>
                      <span className={styles.addOrImportItemText}>Smartsheet</span>
                    </li>

                    {/* Item 8: 26 more sources... */}
                    <li className={styles.addOrImportMenuItem}>
                      <svg
                        className={styles.addOrImportItemIconBookOpen}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path fillRule="nonzero" d="M2 3C1.45364 3 1 3.45364 1 4V12C1 12.5464 1.45364 13 2 13H6C6.398 13 6.77926 13.1579 7.06067 13.4393C7.34212 13.7207 7.50001 14.102 7.5 14.5C7.50186 14.6314 7.55535 14.7568 7.64892 14.849C7.74249 14.9413 7.8686 14.993 8 14.993C8.1314 14.993 8.25751 14.9413 8.35108 14.849C8.44465 14.7568 8.49814 14.6314 8.5 14.5V5.5C8.50013 4.12514 7.37486 2.99987 6 3H2ZM2 4H6C6.83436 3.99992 7.50008 4.66564 7.5 5.5V12.5127C7.06877 12.1874 6.54629 12 6 12H2V4Z M10 3C8.62514 2.99987 7.49987 4.12514 7.5 5.5C7.5 5.63261 7.55268 5.75979 7.64645 5.85355C7.74021 5.94732 7.86739 6 8 6C8.13261 6 8.25979 5.94732 8.35355 5.85355C8.44732 5.75979 8.5 5.63261 8.5 5.5C8.49994 4.66564 9.16564 3.99992 10 4H14V12H10C9.33719 12 8.70097 12.2635 8.2323 12.7322C7.76355 13.2009 7.49998 13.8371 7.5 14.5C7.5 14.6326 7.55268 14.7598 7.64645 14.8536C7.74021 14.9473 7.86739 15 8 15C8.13261 15 8.25979 14.9473 8.35355 14.8536C8.44732 14.7598 8.5 14.6326 8.5 14.5C8.49999 14.102 8.65788 13.7207 8.93933 13.4393C9.22074 13.1579 9.602 13 10 13H14C14.5464 13 15 12.5464 15 12V4C15 3.45364 14.5464 3 14 3H10Z" />
                      </svg>
                      <span className={styles.addOrImportItemText}>26 more sources...</span>
                      <svg
                        className={styles.addOrImportItemChevronRight}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path fillRule="nonzero" d="M5.64645 12.3536C5.45118 12.1583 5.45118 11.8417 5.64645 11.6464L9.29289 8L5.64645 4.35355C5.45118 4.15829 5.45118 3.84171 5.64645 3.64645C5.84171 3.45118 6.15829 3.45118 6.35355 3.64645L10.3536 7.64645C10.5488 7.84171 10.5488 8.15829 10.3536 8.35355L6.35355 12.3536C6.15829 12.5488 5.84171 12.5488 5.64645 12.3536Z" />
                      </svg>
                    </li>
                  </ul>
                )}
              </div>
            </div>
            <div className={styles.tableToolbarSpacer} />
            <button className={styles.tableToolbarRightButton}>
              <span className={styles.tableToolbarRightButtonText}>Tools</span>
              <svg 
                className={styles.tableToolbarRightButtonIcon}
                viewBox="0 0 16 16" 
                fill="currentColor"
                aria-hidden="true"
              >
                <path 
                  fillRule="nonzero" 
                  d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" 
                />
              </svg>
            </button>
          </div>

          {/* === GRID BAR (sub-header below table toolbar) === */}
          <div className={styles.gridBar}>
            {/* Left section */}
            <div className={styles.gridBarLeft}>
              {/* List icon button (toggles views sidebar) */}
              <button
                type="button"
                className={styles.gridBarListButton}
                onClick={handleToggleViewsSidebar}
                onMouseEnter={handleListButtonMouseEnter}
                onMouseLeave={handleListButtonMouseLeave}
              >
                <svg className={styles.gridBarListButtonIcon} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="nonzero" d="M2.5 11.5C2.36739 11.5 2.24021 11.5527 2.14645 11.6464C2.05268 11.7402 2 11.8674 2 12C2 12.1326 2.05268 12.2598 2.14645 12.3536C2.24021 12.4473 2.36739 12.5 2.5 12.5H13.5C13.6326 12.5 13.7598 12.4473 13.8536 12.3536C13.9473 12.2598 14 12.1326 14 12C14 11.8674 13.9473 11.7402 13.8536 11.6464C13.7598 11.5527 13.6326 11.5 13.5 11.5H2.5Z M2.5 3.5C2.36739 3.5 2.24021 3.55268 2.14645 3.64645C2.05268 3.74021 2 3.86739 2 4C2 4.13261 2.05268 4.25979 2.14645 4.35355C2.24021 4.44732 2.36739 4.5 2.5 4.5H13.5C13.6326 4.5 13.7598 4.44732 13.8536 4.35355C13.9473 4.25979 14 4.13261 14 4C14 3.86739 13.9473 3.74021 13.8536 3.64645C13.7598 3.55268 13.6326 3.5 13.5 3.5H2.5Z M2.5 7.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H2.5Z" />
                </svg>
              </button>

              {/* Grid View selector */}
              <div
                ref={viewDropdownButtonRef}
                className={`${styles.gridBarViewSelector} ${isRenamingView ? styles.gridBarViewSelectorRenaming : ''}`}
                onClick={isRenamingView ? undefined : () => {
                  setIsViewDropdownOpen((prev) => !prev);
                  setIsCreateNewDropdownOpen(false);
                }}
                onDoubleClick={isRenamingView ? undefined : () => startRenamingView()}
              >
                {isRenamingView ? (
                  <div className={styles.gridBarRenameInputWrapper}>
                    <input
                      ref={renameViewInputRef}
                      className={styles.gridBarRenameInput}
                      value={renameViewValue}
                      onChange={(e) => setRenameViewValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRenameView();
                        if (e.key === 'Escape') cancelRenameView();
                      }}
                      onBlur={() => commitRenameView()}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                ) : (
                  <>
                    {/* Grid Feature icon */}
                    <svg className={styles.gridBarViewIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="evenodd" d="M2.5 2C1.67157 2 1 2.67157 1 3.5V12.5C1 13.3284 1.67157 14 2.5 14H13.5C14.3284 14 15 13.3284 15 12.5V3.5C15 2.67157 14.3284 2 13.5 2H2.5ZM2 3.5C2 3.22386 2.22386 3 2.5 3H13.5C13.7761 3 14 3.22386 14 3.5V5H2V3.5ZM8.5 6H14V9H8.5V6ZM7.5 9V6H2V9H7.5ZM2 10V12.5C2 12.7761 2.22386 13 2.5 13H7.5V10H2ZM8.5 10H14V12.5C14 12.7761 13.7761 13 13.5 13H8.5V10Z" />
                    </svg>
                    {/* Grid View text */}
                    <span className={styles.gridBarViewText}>{activeViewName}</span>
                    {/* Dropdown chevron */}
                    <svg className={styles.gridBarViewChevron} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
                    </svg>
                  </>
                )}

                {/* View Dropdown Menu (rendered via portal to escape stacking contexts) */}
                {!isRenamingView && isViewDropdownOpen && (() => {
                  const vdRect = viewDropdownButtonRef.current?.getBoundingClientRect();
                  const vdStyle: React.CSSProperties = vdRect
                    ? { position: 'fixed', top: vdRect.bottom + 8, left: vdRect.left, zIndex: 99999 }
                    : {};
                  return createPortal(
                  <ul ref={viewDropdownRef} className={styles.viewDropdownMenu} style={vdStyle} onClick={(e) => e.stopPropagation()}>
                    {/* Collaborative view */}
                    <li className={styles.viewDropdownCollaborativeItem}>
                      <div className={styles.viewDropdownCollaborativeRow}>
                        {/* UsersThree icon */}
                        <svg className={styles.viewDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                          <path fillRule="nonzero" d="M3.68726 2.76918C3.00369 2.77619 2.31788 3.05605 1.8208 3.65761C0.919321 4.74857 1.17576 6.24775 2.08557 7.09572C1.40673 7.38504 0.802933 7.84404 0.349488 8.4507C0.310181 8.50329 0.281619 8.56312 0.265432 8.62675C0.249245 8.69038 0.24575 8.75658 0.255147 8.82157C0.264544 8.88656 0.286648 8.94905 0.320199 9.00549C0.353749 9.06194 0.398088 9.11122 0.450684 9.15053C0.503281 9.18983 0.563104 9.21839 0.626738 9.23458C0.690373 9.25077 0.756572 9.25426 0.821558 9.24487C0.886543 9.23547 0.949041 9.21337 1.00548 9.17981C1.06193 9.14626 1.11121 9.10193 1.15051 9.04933C1.76315 8.2297 2.72586 7.74834 3.74915 7.75001C3.74907 7.75005 3.74923 7.74997 3.74915 7.75001C3.74953 7.75001 3.75011 7.75001 3.75049 7.75001C3.87664 7.74769 3.99725 7.69777 4.08814 7.61024C4.09539 7.60337 4.10243 7.59629 4.10925 7.589C4.19691 7.49831 4.24706 7.37783 4.24963 7.25172C4.24951 7.252 4.24976 7.25144 4.24963 7.25172C4.24959 7.25147 4.24992 7.25038 4.24988 7.25013C4.24984 7.25034 4.24992 7.24993 4.24988 7.25013C4.24976 7.24984 4.24976 7.24894 4.24963 7.24865C4.24718 7.12237 4.19703 7.0017 4.10925 6.91088C4.10254 6.90377 4.09562 6.89685 4.0885 6.89013C3.99767 6.80248 3.87706 6.75243 3.75086 6.75001C3.75044 6.75001 3.75005 6.75014 3.74963 6.75014C3.74967 6.75018 3.74959 6.7501 3.74963 6.75014C2.44509 6.75147 1.76078 5.30012 2.59168 4.29457C3.42258 3.28902 4.97671 3.68735 5.22131 4.96876C5.23363 5.03326 5.25853 5.09471 5.29459 5.14958C5.33066 5.20446 5.37718 5.25169 5.4315 5.28859C5.48582 5.32549 5.54687 5.35132 5.61118 5.36462C5.67548 5.37792 5.74178 5.37843 5.80628 5.3661C5.93651 5.34123 6.05154 5.26564 6.12605 5.15596C6.20057 5.04629 6.22847 4.91151 6.20361 4.78126C5.95974 3.50367 4.82653 2.7575 3.68726 2.76918Z M12.3127 2.76918C11.1735 2.7575 10.0403 3.50367 9.79639 4.78126C9.77154 4.91151 9.79943 5.04629 9.87395 5.15596C9.94846 5.26564 10.0635 5.34123 10.1937 5.3661C10.2582 5.37843 10.3245 5.37792 10.3888 5.36462C10.4531 5.35132 10.5142 5.32549 10.5685 5.28859C10.6228 5.25169 10.6693 5.20446 10.7054 5.14958C10.7415 5.09471 10.7664 5.03326 10.7787 4.96876C11.0233 3.68735 12.5774 3.28902 13.4083 4.29457C14.2392 5.30012 13.555 6.75134 12.2505 6.75001C12.2505 6.74997 12.2504 6.75005 12.2505 6.75001C12.25 6.75001 12.2496 6.75001 12.2491 6.75001C12.1871 6.76292 12.1282 6.78748 12.0753 6.8224C12.0115 6.83534 11.9508 6.86064 11.8966 6.89686C11.8603 6.95112 11.835 7.01196 11.8221 7.07594C11.7873 7.12872 11.7629 7.18762 11.75 7.24952C11.75 7.24931 11.7501 7.24973 11.75 7.24952C11.75 7.24976 11.7501 7.25064 11.75 7.25088C11.7629 7.31289 11.7875 7.37187 11.8224 7.42471C11.8353 7.48856 11.8606 7.54927 11.8969 7.60342C11.9511 7.63969 12.0119 7.66499 12.0759 7.67788C12.1287 7.71269 12.1876 7.73717 12.2495 7.75003C12.2499 7.75003 12.2502 7.7499 12.2506 7.7499C12.2505 7.74986 12.2507 7.74994 12.2506 7.7499C13.2738 7.7481 14.237 8.22964 14.8495 9.04934C14.8888 9.10194 14.9381 9.14628 14.9945 9.17983C15.051 9.21338 15.1135 9.23548 15.1785 9.24488C15.2434 9.25428 15.3096 9.25078 15.3733 9.2346C15.4369 9.21841 15.4967 9.18985 15.5493 9.15054C15.6019 9.11123 15.6463 9.06195 15.6798 9.00551C15.7134 8.94907 15.7355 8.88657 15.7449 8.82158C15.7543 8.7566 15.7508 8.6904 15.7346 8.62676C15.7184 8.56313 15.6898 8.50331 15.6505 8.45071C15.1971 7.844 14.5934 7.38493 13.9146 7.09561C14.8243 6.24762 15.0806 4.74853 14.1792 3.65762C13.6821 3.05606 12.9962 2.77619 12.3127 2.76918Z M8 5.75001C6.34908 5.75001 5 7.0991 5 8.75001C5 9.72266 5.47549 10.5819 6.19788 11.1309C5.23485 11.5518 4.42849 12.3022 3.95068 13.2808C3.92187 13.3398 3.90497 13.4039 3.90093 13.4694C3.8969 13.535 3.90582 13.6007 3.92717 13.6628C3.94853 13.7249 3.98191 13.7821 4.0254 13.8313C4.0689 13.8805 4.12165 13.9207 4.18067 13.9495C4.29982 14.0076 4.4372 14.0161 4.56258 13.9729C4.68796 13.9298 4.79107 13.8386 4.84924 13.7195C5.43767 12.5144 6.65894 11.7517 8 11.7517C9.34106 11.7517 10.5623 12.5144 11.1508 13.7195C11.2089 13.8386 11.312 13.9298 11.4374 13.9729C11.5628 14.0161 11.7002 14.0076 11.8193 13.9495C11.8783 13.9207 11.9311 13.8805 11.9746 13.8313C12.0181 13.7821 12.0515 13.7249 12.0728 13.6628C12.0942 13.6007 12.1031 13.535 12.0991 13.4694C12.095 13.4039 12.0781 13.3398 12.0493 13.2808C11.5715 12.3022 10.7652 11.5518 9.80212 11.1309C10.5245 10.5819 11 9.72266 11 8.75001C11 7.0991 9.65092 5.75001 8 5.75001ZM8 6.75001C9.11046 6.75001 10 7.63956 10 8.75001C10 9.86047 9.11046 10.75 8 10.75C6.88955 10.75 6 9.86047 6 8.75001C6 7.63956 6.88955 6.75001 8 6.75001Z" />
                        </svg>
                        {/* Collaborative view text */}
                        <span className={styles.viewDropdownItemText}>Collaborative view</span>
                        {/* ChevronDown rotated as right chevron */}
                        <svg className={styles.viewDropdownCollaborativeChevron} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                          <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
                        </svg>
                      </div>
                      {/* Subtitle text */}
                      <span className={styles.viewDropdownCollaborativeSubtitle}>Editors and up can edit the view configuration</span>
                    </li>

                    {/* Separator */}
                    <li className={styles.viewDropdownSeparator} />

                    {/* Rename view */}
                    <li
                      className={styles.viewDropdownItem}
                      onClick={() => startRenamingView()}
                    >
                      <svg className={styles.viewDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                        <path fillRule="nonzero" d="M10.5 1.71045C10.2406 1.71045 9.9813 1.80867 9.7876 2.00525L2.29017 9.50269L2.28931 9.50354C2.10332 9.69048 1.9991 9.94419 2.00001 10.2079V12.9999C2.00007 13.5462 2.45358 13.9998 2.99988 13.9999H5.79212C6.05578 14.0008 6.30942 13.8966 6.49635 13.7107L6.49732 13.7097L13.9948 6.21228C14.3878 5.82489 14.3878 5.17499 13.9948 4.7876L11.2124 2.00525C11.0187 1.80867 10.7594 1.71045 10.5 1.71045ZM10.4999 2.70715C10.4955 2.70269 10.5043 2.70269 10.4999 2.70715L10.5027 2.70972L13.2902 5.49719L13.2927 5.49976C13.2972 5.49534 13.2972 5.50418 13.2927 5.49976L13.2902 5.50269L12 6.79297L9.20704 4L10.4973 2.70972L10.4999 2.70715ZM8.50001 4.70703L11.293 7.5L5.79297 12.9999H3.00013L3.00001 10.207L8.50001 4.70703Z" />
                      </svg>
                      <span className={styles.viewDropdownItemText}>Rename view</span>
                    </li>

                    {/* Edit view description */}
                    <li className={styles.viewDropdownItem}>
                      <svg className={styles.viewDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                        <path fillRule="nonzero" d="M7.875 6C8.28919 6 8.625 5.66419 8.625 5.25C8.625 4.83581 8.28919 4.5 7.875 4.5C7.46081 4.5 7.125 4.83581 7.125 5.25C7.125 5.66419 7.46081 6 7.875 6Z M7.5 7C7.36739 7 7.24021 7.05268 7.14645 7.14645C7.05268 7.24021 7 7.36739 7 7.5C7 7.63261 7.05268 7.75979 7.14645 7.85355C7.24021 7.94732 7.36739 8 7.5 8V11C7.50001 11.1326 7.5527 11.2598 7.64646 11.3535C7.74023 11.4473 7.8674 11.5 8 11.5H8.5C8.63261 11.5 8.75979 11.4473 8.85355 11.3536C8.94732 11.2598 9 11.1326 9 11C9 10.8674 8.94732 10.7402 8.85355 10.6464C8.75979 10.5527 8.63261 10.5 8.5 10.5V7.5C8.49999 7.3674 8.4473 7.24023 8.35354 7.14646C8.25977 7.0527 8.1326 7.00001 8 7H7.5Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
                      </svg>
                      <span className={styles.viewDropdownItemText}>Edit view description</span>
                    </li>

                    {/* Separator */}
                    <li className={styles.viewDropdownSeparator} />

                    {/* Duplicate view */}
                    <li className={styles.viewDropdownItem}>
                      <svg className={styles.viewDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                        <path fillRule="nonzero" d="M2.5 5C2.3674 5.00001 2.24023 5.0527 2.14646 5.14646C2.0527 5.24023 2.00001 5.3674 2 5.5V13.5C2.00001 13.6326 2.0527 13.7598 2.14646 13.8535C2.24023 13.9473 2.3674 14 2.5 14H10.5C10.6326 14 10.7598 13.9473 10.8535 13.8535C10.9473 13.7598 11 13.6326 11 13.5V5.5C11 5.3674 10.9473 5.24023 10.8535 5.14646C10.7598 5.0527 10.6326 5.00001 10.5 5H2.5ZM3 6H10V13H3V6Z M5.5 2C5.3674 2.00001 5.24023 2.0527 5.14646 2.14646C5.0527 2.24023 5.00001 2.3674 5 2.5V5.5C5 5.63261 5.05268 5.75979 5.14645 5.85355C5.24021 5.94732 5.36739 6 5.5 6C5.63261 6 5.75979 5.94732 5.85355 5.85355C5.94732 5.75979 6 5.63261 6 5.5V3H13V10H10.5C10.3674 10 10.2402 10.0527 10.1464 10.1464C10.0527 10.2402 10 10.3674 10 10.5C10 10.6326 10.0527 10.7598 10.1464 10.8536C10.2402 10.9473 10.3674 11 10.5 11H13.5C13.6326 11 13.7598 10.9473 13.8535 10.8535C13.9473 10.7598 14 10.6326 14 10.5V2.5C14 2.3674 13.9473 2.24023 13.8535 2.14646C13.7598 2.0527 13.6326 2.00001 13.5 2H5.5Z" />
                      </svg>
                      <span className={styles.viewDropdownItemText}>Duplicate view</span>
                    </li>

                    {/* Separator */}
                    <li className={styles.viewDropdownSeparator} />

                    {/* Download CSV */}
                    <li className={styles.viewDropdownItem}>
                      <svg className={styles.viewDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                        <path fillRule="nonzero" d="M8 5C7.86739 5 7.74021 5.05268 7.64645 5.14645C7.55268 5.24021 7.5 5.36739 7.5 5.5V9.29297L6.23486 8.02771C6.18843 7.98127 6.13331 7.94444 6.07264 7.91931C6.01198 7.89418 5.94695 7.88124 5.88129 7.88124C5.81562 7.88124 5.7506 7.89418 5.68993 7.91931C5.62926 7.94444 5.57414 7.98127 5.52771 8.02771C5.48127 8.07414 5.44444 8.12926 5.41931 8.18993C5.39418 8.2506 5.38124 8.31562 5.38124 8.38129C5.38124 8.44695 5.39418 8.51198 5.41931 8.57264C5.44444 8.63331 5.48127 8.68843 5.52771 8.73486L7.64648 10.8535C7.74026 10.9472 7.86741 10.9999 8 10.9999C8.13259 10.9999 8.25974 10.9472 8.35352 10.8535L10.4723 8.73486C10.5187 8.68843 10.5556 8.63331 10.5807 8.57264C10.6058 8.51198 10.6188 8.44695 10.6188 8.38129C10.6188 8.31562 10.6058 8.2506 10.5807 8.18993C10.5556 8.12926 10.5187 8.07414 10.4723 8.02771C10.4259 7.98127 10.3707 7.94444 10.3101 7.91931C10.2494 7.89418 10.1844 7.88124 10.1187 7.88124C10.053 7.88124 9.98802 7.89418 9.92736 7.91931C9.86669 7.94444 9.81157 7.98127 9.76514 8.02771L8.5 9.29297V5.5C8.5 5.36739 8.44732 5.24021 8.35355 5.14645C8.25979 5.05268 8.13261 5 8 5Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
                      </svg>
                      <span className={styles.viewDropdownItemText}>Download CSV</span>
                    </li>

                    {/* Print view */}
                    <li className={styles.viewDropdownItem}>
                      <svg className={styles.viewDropdownItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                        <path fillRule="nonzero" d="M11.75 8C12.1642 8 12.5 7.66419 12.5 7.25C12.5 6.83581 12.1642 6.5 11.75 6.5C11.3358 6.5 11 6.83581 11 7.25C11 7.66419 11.3358 8 11.75 8Z M2.8313 4.5C1.98492 4.5 1.25 5.15455 1.25 6V11C1.25001 11.1326 1.3027 11.2598 1.39646 11.3535C1.49023 11.4473 1.6174 11.5 1.75 11.5H4C4.13261 11.5 4.25979 11.4473 4.35355 11.3536C4.44732 11.2598 4.5 11.1326 4.5 11C4.5 10.8674 4.44732 10.7402 4.35355 10.6464C4.25979 10.5527 4.13261 10.5 4 10.5H2.25V6C2.25 5.74545 2.49018 5.5 2.8313 5.5H13.1687C13.5098 5.5 13.75 5.74545 13.75 6V10.5H12C11.8674 10.5 11.7402 10.5527 11.6464 10.6464C11.5527 10.7402 11.5 10.8674 11.5 11C11.5 11.1326 11.5527 11.2598 11.6464 11.3536C11.7402 11.4473 11.8674 11.5 12 11.5H14.25C14.3826 11.5 14.5098 11.4473 14.6035 11.3535C14.6973 11.2598 14.75 11.1326 14.75 11V6C14.75 5.15455 14.0151 4.5 13.1687 4.5H2.8313Z M4 2C3.8674 2.00001 3.74023 2.0527 3.64646 2.14646C3.5527 2.24023 3.50001 2.3674 3.5 2.5V5C3.5 5.13261 3.55268 5.25979 3.64645 5.35355C3.74021 5.44732 3.86739 5.5 4 5.5C4.13261 5.5 4.25979 5.44732 4.35355 5.35355C4.44732 5.25979 4.5 5.13261 4.5 5V3H11.5V5C11.5 5.13261 11.5527 5.25979 11.6464 5.35355C11.7402 5.44732 11.8674 5.5 12 5.5C12.1326 5.5 12.2598 5.44732 12.3536 5.35355C12.4473 5.25979 12.5 5.13261 12.5 5V2.5C12.5 2.3674 12.4473 2.24023 12.3535 2.14646C12.2598 2.0527 12.1326 2.00001 12 2H4Z M4 9C3.8674 9.00001 3.74023 9.0527 3.64646 9.14646C3.5527 9.24023 3.50001 9.3674 3.5 9.5V13.75C3.50001 13.8826 3.5527 14.0098 3.64646 14.1035C3.74023 14.1973 3.8674 14.25 4 14.25H12C12.1326 14.25 12.2598 14.1973 12.3535 14.1035C12.4473 14.0098 12.5 13.8826 12.5 13.75V9.5C12.5 9.3674 12.4473 9.24023 12.3535 9.14646C12.2598 9.0527 12.1326 9.00001 12 9H4ZM4.5 10H11.5V13.25H4.5V10Z" />
                      </svg>
                      <span className={styles.viewDropdownItemText}>Print view</span>
                    </li>

                    {/* Delete view — disabled when there is only a single view */}
                    <li
                      className={styles.viewDropdownItem}
                      style={canDeleteView ? { cursor: 'pointer' } : { opacity: 0.5, cursor: 'default' }}
                      onClick={() => {
                        if (canDeleteView && activeViewId) {
                          deleteViewMut.mutate({ viewId: activeViewId });
                        }
                      }}
                    >
                      <svg className={styles.viewDropdownDeleteIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                        <path fillRule="nonzero" d="M6.5 6C6.36739 6 6.24021 6.05268 6.14645 6.14645C6.05268 6.24021 6 6.36739 6 6.5V10.5C6 10.6326 6.05268 10.7598 6.14645 10.8536C6.24021 10.9473 6.36739 11 6.5 11C6.63261 11 6.75979 10.9473 6.85355 10.8536C6.94732 10.7598 7 10.6326 7 10.5V6.5C7 6.36739 6.94732 6.24021 6.85355 6.14645C6.75979 6.05268 6.63261 6 6.5 6Z M9.5 6C9.36739 6 9.24021 6.05268 9.14645 6.14645C9.05268 6.24021 9 6.36739 9 6.5V10.5C9 10.6326 9.05268 10.7598 9.14645 10.8536C9.24021 10.9473 9.36739 11 9.5 11C9.63261 11 9.75979 10.9473 9.85355 10.8536C9.94732 10.7598 10 10.6326 10 10.5V6.5C10 6.36739 9.94732 6.24021 9.85355 6.14645C9.75979 6.05268 9.63261 6 9.5 6Z M6.5 1C5.6775 1 5 1.6775 5 2.5V3H2.5C2.36739 3 2.24021 3.05268 2.14645 3.14645C2.05268 3.24021 2 3.36739 2 3.5C2 3.63261 2.05268 3.75979 2.14645 3.85355C2.24021 3.94732 2.36739 4 2.5 4H3V13C3.00007 13.5463 3.45357 13.9999 3.99988 14H12C12.5464 14 13 13.5464 13 13V4H13.5C13.6326 4 13.7598 3.94732 13.8536 3.85355C13.9473 3.75979 14 3.63261 14 3.5C14 3.36739 13.9473 3.24021 13.8536 3.14645C13.7598 3.05268 13.6326 3 13.5 3H11V2.5C10.9999 1.67757 10.3226 1.0001 9.50012 1H6.5ZM6.5 2H9.5C9.78202 2.0001 9.99996 2.21808 10 2.50012V3H6V2.5C6 2.21794 6.21794 2 6.5 2ZM4 4H12V13H4.00012L4 4Z" />
                      </svg>
                      <span className={styles.viewDropdownDeleteText}>Delete view</span>
                    </li>
                  </ul>,
                  document.body
                  );
                })()}
              </div>
            </div>

            {/* Right section */}
            <div className={styles.gridBarRight}>
              {/* Tools outer container */}
              <div className={styles.gridBarToolsOuter}>
                {/* Tools inner container */}
                <div className={styles.gridBarToolsInner}>
                  {/* Hide fields button */}
                  <button type="button" className={`${styles.gridBarToolButton} ${styles.gridBarHideFieldsButton}`}>
                    <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M8.00013 2.99999C7.53899 2.99917 7.07864 3.03701 6.62379 3.11315C6.55902 3.12398 6.49703 3.14747 6.44134 3.18226C6.38565 3.21706 6.33736 3.26248 6.29923 3.31594C6.2611 3.3694 6.23387 3.42984 6.2191 3.49382C6.20433 3.5578 6.2023 3.62407 6.21314 3.68883C6.23505 3.81961 6.30801 3.93632 6.41597 4.01331C6.52393 4.0903 6.65805 4.12125 6.78883 4.09935C7.18869 4.03242 7.59357 3.99923 7.99915 3.99999C7.99882 3.99999 7.99948 3.99999 7.99915 3.99999C12.083 3.99999 14.0065 7.16727 14.4415 7.99926C14.2327 8.39403 13.6815 9.3219 12.7042 10.196C12.6553 10.2398 12.6154 10.2928 12.587 10.352C12.5585 10.4112 12.542 10.4754 12.5383 10.5409C12.5347 10.6065 12.544 10.6721 12.5657 10.7341C12.5874 10.7961 12.6211 10.8531 12.6649 10.9021C12.7533 11.0009 12.8774 11.0606 13.0097 11.0679C13.1421 11.0753 13.272 11.0298 13.3709 10.9414C14.8157 9.64896 15.4569 8.20311 15.4569 8.20311C15.4853 8.13917 15.5 8.06997 15.5 7.99999C15.5 7.93001 15.4853 7.86081 15.4569 7.79686C15.4569 7.79686 13.2994 3.00052 8.00013 2.99999Z M8.56177 5.05248C8.4315 5.02783 8.29677 5.05593 8.18721 5.1306C8.07765 5.20527 8.00223 5.3204 7.97755 5.45067C7.96532 5.51519 7.96592 5.58148 7.97932 5.64576C7.99271 5.71004 8.01864 5.77106 8.05562 5.82532C8.09259 5.87958 8.13989 5.92603 8.19482 5.96201C8.24975 5.99799 8.31122 6.0228 8.37574 6.03502C9.25118 6.20086 9.90696 6.92166 9.98963 7.80883C9.99573 7.87421 10.0146 7.93775 10.0453 7.99582C10.076 8.05389 10.1177 8.10536 10.1683 8.14727C10.2188 8.18919 10.2771 8.22074 10.3399 8.24013C10.4026 8.25951 10.4686 8.26635 10.5339 8.26024C10.666 8.24793 10.7877 8.18368 10.8723 8.08163C10.957 7.97958 10.9976 7.84808 10.9854 7.71605C10.8617 6.38949 9.8708 5.30045 8.56177 5.05248Z M3.02381 2.0006C2.89137 1.99428 2.76183 2.04082 2.6637 2.12999C2.56557 2.21919 2.5069 2.34371 2.50058 2.47617C2.49426 2.60862 2.54082 2.73816 2.63001 2.83629L5.64234 6.14989C4.99783 6.97182 4.81667 8.0854 5.20167 9.08153C5.64782 10.2359 6.7614 10.9994 7.99891 10.9997C8.57697 11.0018 9.13723 10.8317 9.61744 10.5226L12.63 13.8363C12.7192 13.9344 12.8437 13.9931 12.9762 13.9994C13.1086 14.0057 13.2382 13.9592 13.3363 13.87C13.4344 13.7808 13.4931 13.6563 13.4994 13.5238C13.5058 13.3914 13.4592 13.2618 13.37 13.1637L6.6908 5.81652C6.69016 5.81554 6.68951 5.81456 6.68885 5.81359C6.6884 5.81338 6.68796 5.81318 6.68751 5.81298L3.37 2.16369C3.2808 2.06557 3.15627 2.0069 3.02381 2.0006ZM4.78126 3.81261C4.65529 3.7712 4.51803 3.78151 4.39966 3.8413C1.67465 5.21716 0.542853 7.79748 0.542853 7.79748C0.514536 7.86137 0.499927 7.93049 0.49997 8.00038C0.500012 8.07027 0.514704 8.13938 0.543098 8.20324C0.543098 8.20324 2.69954 12.9988 7.99805 13C9.24842 13.0098 10.4832 12.7217 11.6 12.1592C11.6586 12.1296 11.7109 12.0888 11.7537 12.0391C11.7966 11.9893 11.8293 11.9317 11.8498 11.8693C11.8704 11.8069 11.8785 11.7411 11.8736 11.6757C11.8688 11.6102 11.8511 11.5463 11.8215 11.4877C11.792 11.429 11.7512 11.3768 11.7015 11.3339C11.6517 11.291 11.594 11.2584 11.5317 11.2378C11.4693 11.2172 11.4035 11.2091 11.338 11.214C11.2726 11.2189 11.2087 11.2366 11.15 11.2661C10.1746 11.7574 9.09616 12.009 8.00403 12.0001C8.00269 12.0001 8.00135 12.0001 8.00001 12.0001C3.9214 12.0001 1.99934 8.84205 1.56104 8.00512C1.80002 7.53467 2.78966 5.77445 4.85035 4.734C4.90897 4.7044 4.96118 4.66355 5.00401 4.61377C5.04684 4.56399 5.07944 4.50626 5.09996 4.44389C5.12048 4.38151 5.12851 4.3157 5.12359 4.25021C5.11867 4.18473 5.1009 4.12086 5.0713 4.06225C5.01154 3.94387 4.90721 3.85407 4.78126 3.81261ZM6.3307 6.90709L8.92811 9.76427C8.64391 9.91434 8.32855 10.0011 8.00196 9.99987C8.00131 9.99987 8.00066 9.99987 8.00001 9.99987C7.17209 9.99993 6.43288 9.49318 6.13441 8.72094C5.89804 8.10936 5.98275 7.43768 6.3307 6.90709Z" />
                    </svg>
                    <span className={styles.gridBarToolText}>Hide fields</span>
                  </button>

                  {/* Filter button */}
                  <button type="button" className={`${styles.gridBarToolButton} ${styles.gridBarFilterButton}`}>
                    <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M6.5 10.5C6.36739 10.5 6.24021 10.5527 6.14645 10.6464C6.05268 10.7402 6 10.8674 6 11C6 11.1326 6.05268 11.2598 6.14645 11.3536C6.24021 11.4473 6.36739 11.5 6.5 11.5H9.5C9.63261 11.5 9.75979 11.4473 9.85355 11.3536C9.94732 11.2598 10 11.1326 10 11C10 10.8674 9.94732 10.7402 9.85355 10.6464C9.75979 10.5527 9.63261 10.5 9.5 10.5H6.5Z M1.5 4.5C1.36739 4.5 1.24021 4.55268 1.14645 4.64645C1.05268 4.74021 1 4.86739 1 5C1 5.13261 1.05268 5.25979 1.14645 5.35355C1.24021 5.44732 1.36739 5.5 1.5 5.5H14.5C14.6326 5.5 14.7598 5.44732 14.8536 5.35355C14.9473 5.25979 15 5.13261 15 5C15 4.86739 14.9473 4.74021 14.8536 4.64645C14.7598 4.55268 14.6326 4.5 14.5 4.5H1.5Z M4 7.5C3.86739 7.5 3.74021 7.55268 3.64645 7.64645C3.55268 7.74021 3.5 7.86739 3.5 8C3.5 8.13261 3.55268 8.25979 3.64645 8.35355C3.74021 8.44732 3.86739 8.5 4 8.5H12C12.1326 8.5 12.2598 8.44732 12.3536 8.35355C12.4473 8.25979 12.5 8.13261 12.5 8C12.5 7.86739 12.4473 7.74021 12.3536 7.64645C12.2598 7.55268 12.1326 7.5 12 7.5H4Z" />
                    </svg>
                    <span className={styles.gridBarToolText}>Filter</span>
                  </button>

                  {/* Group button */}
                  <button type="button" className={`${styles.gridBarToolButton} ${styles.gridBarGroupButton}`}>
                    <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M6 6.5C6 6.91421 5.66421 7.25 5.25 7.25C4.83579 7.25 4.5 6.91421 4.5 6.5C4.5 6.08579 4.83579 5.75 5.25 5.75C5.66421 5.75 6 6.08579 6 6.5Z M7 6.5C7 6.22386 7.22386 6 7.5 6H11C11.2761 6 11.5 6.22386 11.5 6.5C11.5 6.77614 11.2761 7 11 7H7.5C7.22386 7 7 6.77614 7 6.5Z M7.5 9C7.22386 9 7 9.22386 7 9.5C7 9.77614 7.22386 10 7.5 10H11C11.2761 10 11.5 9.77614 11.5 9.5C11.5 9.22386 11.2761 9 11 9H7.5Z M6 9.5C6 9.91421 5.66421 10.25 5.25 10.25C4.83579 10.25 4.5 9.91421 4.5 9.5C4.5 9.08579 4.83579 8.75 5.25 8.75C5.66421 8.75 6 9.08579 6 9.5Z M2.54545 2.5C2.0573 2.5 1.5 2.84588 1.5 3.45455V12.5455C1.5 13.1541 2.0573 13.5 2.54545 13.5H13.4545C13.9427 13.5 14.5 13.1541 14.5 12.5455V3.45455C14.5 2.84588 13.9427 2.5 13.4545 2.5H2.54545ZM2.5 12.4929V3.50706C2.51085 3.50329 2.52597 3.5 2.54545 3.5H13.4545C13.474 3.5 13.4891 3.50329 13.5 3.50706V12.4929C13.4891 12.4967 13.474 12.5 13.4545 12.5H2.54545C2.52597 12.5 2.51085 12.4967 2.5 12.4929Z" />
                    </svg>
                    <span className={styles.gridBarToolText}>Group</span>
                  </button>

                  {/* Sort button */}
                  <button type="button" className={`${styles.gridBarToolButton} ${styles.gridBarSortButton}`}>
                    <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M4.99999 2.5C4.86738 2.5 4.7402 2.55268 4.64643 2.64645C4.55266 2.74021 4.49999 2.86739 4.49999 3V11.793L3.3535 10.6465C3.25974 10.5527 3.13258 10.5001 2.99999 10.5001C2.8674 10.5001 2.74023 10.5527 2.64647 10.6465C2.55272 10.7402 2.50006 10.8674 2.50006 11C2.50006 11.1326 2.55272 11.2598 2.64647 11.3535L4.64647 13.3535C4.74022 13.4473 4.86738 13.5 4.99999 13.5C5.13259 13.5 5.25975 13.4473 5.3535 13.3535L7.3535 11.3535C7.44725 11.2598 7.49991 11.1326 7.49991 11C7.49991 10.8674 7.44725 10.7402 7.3535 10.6465C7.25974 10.5527 7.13258 10.5001 6.99999 10.5001C6.8674 10.5001 6.74024 10.5527 6.64647 10.6465L5.49999 11.793V3C5.49999 2.86739 5.44731 2.74021 5.35354 2.64645C5.25977 2.55268 5.13259 2.5 4.99999 2.5Z M11 2.5C10.8674 2.50003 10.7402 2.55272 10.6465 2.64648L8.64647 4.64648C8.55272 4.74025 8.50006 4.86741 8.50006 5C8.50006 5.13259 8.55272 5.25975 8.64647 5.35352C8.74024 5.44726 8.8674 5.49992 8.99999 5.49992C9.13258 5.49992 9.25974 5.44726 9.3535 5.35352L10.5 4.20703V13C10.5 13.1326 10.5527 13.2598 10.6464 13.3536C10.7402 13.4473 10.8674 13.5 11 13.5C11.1326 13.5 11.2598 13.4473 11.3535 13.3536C11.4473 13.2598 11.5 13.1326 11.5 13V4.20703L12.6465 5.35352C12.7402 5.44726 12.8674 5.49992 13 5.49992C13.1326 5.49992 13.2597 5.44726 13.3535 5.35352C13.4472 5.25975 13.4999 5.13259 13.4999 5C13.4999 4.86741 13.4472 4.74025 13.3535 4.64648L11.3535 2.64648C11.3487 2.64437 11.3438 2.64234 11.3389 2.64038C11.2478 2.55235 11.1266 2.50218 11 2.5Z" />
                    </svg>
                    <span className={styles.gridBarToolText}>Sort</span>
                  </button>

                  {/* Color button */}
                  <button type="button" className={`${styles.gridBarToolButton} ${styles.gridBarColorButton}`}>
                    <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="nonzero" d="M2.36878 1.36865C2.30311 1.36863 2.23808 1.38154 2.17741 1.40666C2.11673 1.43177 2.06159 1.46859 2.01515 1.51501C1.96871 1.56144 1.93187 1.61657 1.90674 1.67723C1.88161 1.7379 1.86868 1.80292 1.86868 1.86859C1.86868 1.93426 1.88161 1.99928 1.90674 2.05995C1.93187 2.12062 1.96871 2.17574 2.01515 2.22217L6.21803 6.42505C6.08351 6.67237 6.00001 6.95077 6.00001 7.25C6.00001 8.21058 6.78943 9 7.75001 9C8.71059 9 9.50001 8.21058 9.50001 7.25C9.50001 6.28942 8.71059 5.5 7.75001 5.5C7.45086 5.5 7.17258 5.58356 6.9253 5.71802L2.7223 1.51501C2.62853 1.42129 2.50137 1.36864 2.36878 1.36865ZM7.75001 6.5C8.17018 6.5 8.50001 6.82983 8.50001 7.25C8.50001 7.67017 8.17018 8 7.75001 8C7.32984 8 7.00001 7.67017 7.00001 7.25C7.00001 7.04405 7.08091 6.86114 7.21119 6.72681C7.21491 6.72531 7.21862 6.72376 7.2223 6.72217C7.22618 6.71703 7.22997 6.71183 7.23365 6.70654C7.36745 6.57966 7.54709 6.5 7.75001 6.5Z M14.25 9.75C14.1174 9.75003 13.9902 9.80272 13.8965 9.89648C13.8965 9.89648 13.5499 10.2425 13.209 10.7539C12.868 11.2653 12.5 11.9583 12.5 12.75C12.5 13.7106 13.2894 14.5 14.25 14.5C15.2106 14.5 16 13.7106 16 12.75C16 11.9583 15.632 11.2653 15.291 10.7539C14.9501 10.2425 14.6035 9.89648 14.6035 9.89648C14.5098 9.80272 14.3826 9.75003 14.25 9.75ZM14.25 11.0325C14.3204 11.1233 14.3825 11.1938 14.459 11.3086C14.743 11.7347 15 12.2917 15 12.75C15 13.1701 14.6701 13.5 14.25 13.5C13.8299 13.5 13.5 13.1701 13.5 12.75C13.5 12.2917 13.757 11.7347 14.041 11.3086C14.1176 11.1938 14.1796 11.1233 14.25 11.0325Z M7.21876 0.5C7.08616 0.500026 6.959 0.552716 6.86524 0.646484L0.852671 6.65894C0.851813 6.65979 0.850959 6.66064 0.850108 6.6615C0.276242 7.24384 0.276242 8.19366 0.850108 8.776C0.850959 8.77686 0.851813 8.77771 0.852671 8.77856L6.15895 14.0848C6.15984 14.0857 6.16073 14.0865 6.16163 14.0874C6.74398 14.6612 7.69354 14.6612 8.27589 14.0874C8.27679 14.0865 8.27768 14.0857 8.27858 14.0848L14.291 8.07226C14.3848 7.97849 14.4374 7.85133 14.4374 7.71875C14.4374 7.58616 14.3848 7.459 14.291 7.36523L7.57228 0.646483C7.47852 0.552715 7.35136 0.500025 7.21876 0.5ZM7.21876 1.70703L13.2305 7.71875L7.57374 13.3754C7.37274 13.5731 7.06478 13.5731 6.86378 13.3754L1.56239 8.0741C1.36466 7.87311 1.36441 7.56475 1.56214 7.36376C1.56203 7.36388 1.56225 7.36364 1.56214 7.36376L7.21876 1.70703Z" />
                    </svg>
                    <span className={styles.gridBarToolText}>Color</span>
                  </button>

                  {/* Row height button (icon only) */}
                  <div className={styles.gridBarRowHeightWrapper}>
                    <button type="button" className={styles.gridBarRowHeightButton}>
                      <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="nonzero" d="M13.1464 2.64645L12.1464 3.64645C11.9512 3.84171 11.9512 4.15829 12.1464 4.35355C12.3417 4.54882 12.6583 4.54882 12.8536 4.35355L13 4.20711V11.7929L12.8536 11.6464C12.6583 11.4512 12.3417 11.4512 12.1464 11.6464C11.9512 11.8417 11.9512 12.1583 12.1464 12.3536L13.1464 13.3536C13.2402 13.4473 13.3674 13.5 13.5 13.5C13.6326 13.5 13.7598 13.4473 13.8536 13.3536L14.8536 12.3536C15.0488 12.1583 15.0488 11.8417 14.8536 11.6464C14.6583 11.4512 14.3417 11.4512 14.1464 11.6464L14 11.7929V4.20711L14.1464 4.35355C14.3417 4.54882 14.6583 4.54882 14.8536 4.35355C15.0488 4.15829 15.0488 3.84171 14.8536 3.64645L13.8536 2.64645C13.6583 2.45118 13.3417 2.45118 13.1464 2.64645Z M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H9.5C9.77614 4 10 3.77614 10 3.5C10 3.22386 9.77614 3 9.5 3H1.5Z M1.5 6C1.22386 6 1 6.22386 1 6.5C1 6.77614 1.22386 7 1.5 7H9.5C9.77614 7 10 6.77614 10 6.5C10 6.22386 9.77614 6 9.5 6H1.5Z M1 9.5C1 9.22386 1.22386 9 1.5 9H9.5C9.77614 9 10 9.22386 10 9.5C10 9.77614 9.77614 10 9.5 10H1.5C1.22386 10 1 9.77614 1 9.5Z M1.5 12C1.22386 12 1 12.2239 1 12.5C1 12.7761 1.22386 13 1.5 13H9.5C9.77614 13 10 12.7761 10 12.5C10 12.2239 9.77614 12 9.5 12H1.5Z" />
                      </svg>
                    </button>
                    <span className={styles.gridBarRowHeightTooltip}>Row height</span>
                  </div>

                  {/* Share and sync button */}
                  <div className={styles.gridBarShareViewWrapper}>
                    <button type="button" className={`${styles.gridBarToolButton} ${styles.gridBarShareSyncButton}`}>
                      <svg className={styles.gridBarToolIcon} viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="nonzero" d="M9.75 2C9.61739 2 9.49021 2.05268 9.39645 2.14645C9.30268 2.24021 9.25 2.36739 9.25 2.5C9.25 2.63261 9.30268 2.75979 9.39645 2.85355C9.49021 2.94732 9.61739 3 9.75 3H12.293L8.64648 6.64648C8.55274 6.74025 8.50008 6.86741 8.50008 7C8.50008 7.13259 8.55274 7.25975 8.64648 7.35352C8.74025 7.44726 8.86741 7.49992 9 7.49992C9.13259 7.49992 9.25975 7.44726 9.35352 7.35352L13 3.70703V6.25C13 6.38261 13.0527 6.50979 13.1464 6.60355C13.2402 6.69732 13.3674 6.75 13.5 6.75C13.6326 6.75 13.7598 6.69732 13.8536 6.60355C13.9473 6.50979 14 6.38261 14 6.25V2.5C13.998 2.49504 13.996 2.49012 13.9939 2.48523C13.9917 2.35861 13.9415 2.23755 13.8535 2.14648C13.7598 2.05272 13.6326 2.00003 13.5 2H9.75Z M3 4C2.45364 4 2 4.45364 2 5V13C2.00007 13.5463 2.45357 13.9999 2.99988 14C2.99984 14 2.99992 14 2.99988 14H11C11.5464 14 12 13.5464 12 13V9C12 8.86739 11.9473 8.74021 11.8536 8.64645C11.7598 8.55268 11.6326 8.5 11.5 8.5C11.3674 8.5 11.2402 8.55268 11.1464 8.64645C11.0527 8.74021 11 8.86739 11 9V13H3.00012L3 5H7C7.1326 5 7.25978 4.94732 7.35355 4.85355C7.44732 4.75979 7.5 4.63261 7.5 4.5C7.5 4.36739 7.44732 4.24021 7.35355 4.14645C7.25978 4.05268 7.1326 4 7 4H3Z" />
                      </svg>
                      <span className={styles.gridBarToolText}>Share and sync</span>
                    </button>
                    <span className={styles.gridBarShareViewTooltip}>Share view</span>
                  </div>
                </div>
              </div>

              {/* Search button with custom tooltip */}
              <div className={styles.tooltipWrapper}>
                <button type="button" className={styles.gridBarSearchButton}>
                  <svg className={styles.gridBarSearchIcon} viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="nonzero" d="M7.25 1.5C4.08028 1.5 1.5 4.08028 1.5 7.25C1.5 10.4197 4.08028 13 7.25 13C8.65529 13 9.94315 12.4911 10.9432 11.6503L13.6465 14.3534C13.7402 14.4471 13.8674 14.4998 14 14.4998C14.1326 14.4998 14.2598 14.4471 14.3535 14.3534C14.4473 14.2596 14.4999 14.1325 14.4999 13.9999C14.4999 13.8673 14.4473 13.7401 14.3535 13.6464L11.6504 10.9431C12.4912 9.94305 13 8.65523 13 7.25C13 4.08028 10.4197 1.5 7.25 1.5ZM7.25 2.5C9.87928 2.5 12 4.62072 12 7.25C12 8.56227 11.4715 9.74761 10.6154 10.6061C10.6132 10.607 10.611 10.6079 10.6089 10.6088C10.608 10.611 10.6071 10.6132 10.6062 10.6154C9.74772 11.4715 8.5623 12 7.25 12C4.62072 12 2.5 9.87928 2.5 7.25C2.5 4.62072 4.62072 2.5 7.25 2.5Z" />
                  </svg>
                </button>
                <span className={styles.tooltip}><span className={styles.tooltipText}>Find in view</span><span className={styles.tooltipShortcut}><span className={styles.tooltipShortcutKey}>⌘</span><span className={styles.tooltipShortcutKey}>F</span></span></span>
              </div>
            </div>
          </div>

          {/* === GRID AREA (views sidebar + grid content) === */}
          <div className={styles.gridArea}>
            {/* === VIEWS SIDEBAR (collapsible) === */}
            <div
              ref={viewsSidebarRef}
              className={`${styles.viewsSidebar} ${!isViewsSidebarOpen ? styles.viewsSidebarCollapsed : ''}`}
              onMouseEnter={handleSidebarMouseEnter}
              onMouseLeave={handleSidebarMouseLeave}
            >
              <div className={styles.viewsSidebarInner}>
              {/* "+ Create new..." button */}
              <button
                ref={createNewButtonRef}
                type="button"
                className={styles.viewsSidebarCreateButton}
                onClick={() => {
                  setIsCreateNewDropdownOpen((prev) => !prev);
                  setIsViewDropdownOpen(false);
                }}
              >
                <svg
                  className={styles.viewsSidebarCreateButtonIcon}
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path fillRule="nonzero" d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z" />
                </svg>
                <span className={styles.viewsSidebarCreateButtonText}>Create new...</span>
              </button>

              {/* Create New Dropdown (rendered via portal to escape stacking contexts) */}
              {isCreateNewDropdownOpen && (() => {
                const rect = createNewButtonRef.current?.getBoundingClientRect();
                const dropdownStyle: React.CSSProperties = rect
                  ? { top: rect.top, left: rect.right + 23 }
                  : {};
                return createPortal(
                <ul ref={createNewDropdownRef} className={styles.createNewDropdownContainer} style={dropdownStyle}>
                  {/* Grid */}
                  <li
                    className={styles.createNewDropdownItem}
                    onClick={() => {
                      setIsCreateNewDropdownOpen(false);
                      setCreateViewName(computeNextViewName());
                      setIsCreateViewBoxOpen(true);
                    }}
                  >
                    <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#156EE1" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                      <path fillRule="evenodd" d="M2.5 2C1.67157 2 1 2.67157 1 3.5V12.5C1 13.3284 1.67157 14 2.5 14H13.5C14.3284 14 15 13.3284 15 12.5V3.5C15 2.67157 14.3284 2 13.5 2H2.5ZM2 3.5C2 3.22386 2.22386 3 2.5 3H13.5C13.7761 3 14 3.22386 14 3.5V5H2V3.5ZM8.5 6H14V9H8.5V6ZM7.5 9V6H2V9H7.5ZM2 10V12.5C2 12.7761 2.22386 13 2.5 13H7.5V10H2ZM8.5 10H14V12.5C14 12.7761 13.7761 13 13.5 13H8.5V10Z" />
                    </svg>
                    <span className={styles.createNewDropdownItemText}>Grid</span>
                  </li>

                  {/* Calendar */}
                  <li className={styles.createNewDropdownItem}>
                    <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#D54402" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                      <path fillRule="evenodd" d="M5.75 7.5C5.61739 7.5 5.49021 7.55268 5.39645 7.64645C5.30268 7.74021 5.25 7.86739 5.25 8C5.25 8.13261 5.30268 8.25979 5.39645 8.35355C5.49021 8.44732 5.61739 8.5 5.75 8.5H6.45972L6.10962 8.93762C6.05075 9.01123 6.01388 9.09999 6.00326 9.19365C5.99265 9.28731 6.00872 9.38206 6.04963 9.46698C6.09054 9.55189 6.15462 9.62352 6.23448 9.6736C6.31433 9.72367 6.40672 9.75016 6.50098 9.75C6.87529 9.74929 7.10696 10.0953 6.96375 10.4412C6.96379 10.4411 6.9637 10.4412 6.96375 10.4412C6.89965 10.5961 6.76358 10.7079 6.59912 10.7405C6.59916 10.7405 6.59908 10.7405 6.59912 10.7405C6.43467 10.7731 6.26622 10.7219 6.14782 10.6032C6.10146 10.5567 6.04638 10.5197 5.98575 10.4945C5.92512 10.4693 5.86011 10.4563 5.79445 10.4562C5.72878 10.4561 5.66374 10.4689 5.60304 10.494C5.54234 10.519 5.48716 10.5558 5.44067 10.6022C5.39417 10.6485 5.35726 10.7036 5.33204 10.7642C5.30683 10.8249 5.2938 10.8899 5.29371 10.9556C5.29362 11.0212 5.30646 11.0863 5.33151 11.147C5.35656 11.2077 5.39332 11.2628 5.43969 11.3093C5.79332 11.6639 6.30238 11.8188 6.79357 11.7213C7.28484 11.6239 7.6962 11.2865 7.88769 10.8237C8.17053 10.1406 7.88369 9.40065 7.32678 9.01697L7.89038 8.31238C7.9492 8.23883 7.98605 8.15017 7.9967 8.0566C8.00735 7.96303 7.99136 7.86835 7.95057 7.78347C7.90979 7.69858 7.84585 7.62694 7.76614 7.57679C7.68643 7.52665 7.59418 7.50003 7.5 7.5H5.75Z M10.0472 7.50232C9.92336 7.49052 9.79953 7.52534 9.69995 7.59998L8.69995 8.34997C8.64741 8.38937 8.60315 8.43874 8.56969 8.49524C8.53624 8.55175 8.51424 8.61429 8.50495 8.6793C8.49567 8.74431 8.49928 8.81051 8.51559 8.87413C8.53189 8.93774 8.56057 8.99752 8.59998 9.05005C8.63937 9.10259 8.68874 9.14685 8.74524 9.1803C8.80175 9.21376 8.86429 9.23576 8.9293 9.24505C8.99431 9.25433 9.06052 9.25072 9.12413 9.23441C9.18774 9.21811 9.24752 9.18943 9.30005 9.15002L9.5 9V11.25C9.5 11.3826 9.55268 11.5098 9.64645 11.6036C9.74021 11.6973 9.86739 11.75 10 11.75C10.1326 11.75 10.2598 11.6973 10.3536 11.6036C10.4473 11.5098 10.5 11.3826 10.5 11.25V8C10.5 7.87559 10.4536 7.75566 10.3698 7.66363C10.2861 7.5716 10.1711 7.51409 10.0472 7.50232Z M5 1C4.86739 1 4.74021 1.05268 4.64645 1.14645C4.55268 1.24021 4.5 1.36739 4.5 1.5V2H3C2.45364 2 2 2.45364 2 3V13C2 13.5464 2.45364 14 3 14H13C13.5464 14 14 13.5464 14 13V3C14 2.45364 13.5464 2 13 2H11.5V1.5C11.5 1.36739 11.4473 1.24021 11.3536 1.14645C11.2598 1.05268 11.1326 1 11 1C10.8674 1 10.7402 1.05268 10.6464 1.14645C10.5527 1.24021 10.5 1.36739 10.5 1.5V2H5.5V1.5C5.5 1.36739 5.44732 1.24021 5.35355 1.14645C5.25979 1.05268 5.13261 1 5 1ZM3 3H4.5V3.5C4.5 3.63261 4.55268 3.75979 4.64645 3.85355C4.74021 3.94732 4.86739 4 5 4C5.13261 4 5.25979 3.94732 5.35355 3.85355C5.44732 3.75979 5.5 3.63261 5.5 3.5V3H10.5V3.5C10.5 3.63261 10.5527 3.75979 10.6464 3.85355C10.7402 3.94732 10.8674 4 11 4C11.1326 4 11.2598 3.94732 11.3536 3.85355C11.4473 3.75979 11.5 3.63261 11.5 3.5V3H13V5H3V3ZM3 6H13V13H3V6Z" />
                    </svg>
                    <span className={styles.createNewDropdownItemText}>Calendar</span>
                  </li>

                  {/* Gallery */}
                  <li className={styles.createNewDropdownItem}>
                    <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#7D37EF" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                      <path fillRule="nonzero" d="M1.5 3.5C1.5 2.67157 2.17157 2 3 2H6C6.82843 2 7.5 2.67157 7.5 3.5V6C7.5 6.82843 6.82843 7.5 6 7.5H3C2.17157 7.5 1.5 6.82843 1.5 6V3.5ZM3 3C2.72386 3 2.5 3.22386 2.5 3.5V6C2.5 6.27614 2.72386 6.5 3 6.5H6C6.27614 6.5 6.5 6.27614 6.5 6V3.5C6.5 3.22386 6.27614 3 6 3H3Z M8.5 3.5C8.5 2.67157 9.17157 2 10 2H13C13.8284 2 14.5 2.67157 14.5 3.5V6C14.5 6.82843 13.8284 7.5 13 7.5H10C9.17157 7.5 8.5 6.82843 8.5 6V3.5ZM10 3C9.72386 3 9.5 3.22386 9.5 3.5V6C9.5 6.27614 9.72386 6.5 10 6.5H13C13.2761 6.5 13.5 6.27614 13.5 6V3.5C13.5 3.22386 13.2761 3 13 3H10Z M1.5 10C1.5 9.17157 2.17157 8.5 3 8.5H6C6.82843 8.5 7.5 9.17157 7.5 10V12.5C7.5 13.3284 6.82843 14 6 14H3C2.17157 14 1.5 13.3284 1.5 12.5V10ZM3 9.5C2.72386 9.5 2.5 9.72386 2.5 10V12.5C2.5 12.7761 2.72386 13 3 13H6C6.27614 13 6.5 12.7761 6.5 12.5V10C6.5 9.72386 6.27614 9.5 6 9.5H3Z M8.5 10C8.5 9.17157 9.17157 8.5 10 8.5H13C13.8284 8.5 14.5 9.17157 14.5 10V12.5C14.5 13.3284 13.8284 14 13 14H10C9.17157 14 8.5 13.3284 8.5 12.5V10ZM10 9.5C9.72386 9.5 9.5 9.72386 9.5 10V12.5C9.5 12.7761 9.72386 13 10 13H13C13.2761 13 13.5 12.7761 13.5 12.5V10C13.5 9.72386 13.2761 9.5 13 9.5H10Z" />
                    </svg>
                    <span className={styles.createNewDropdownItemText}>Gallery</span>
                  </li>

                  {/* Kanban */}
                  <li className={styles.createNewDropdownItem}>
                    <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#068A0D" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                      <path fillRule="nonzero" d="M1 3.5C1 2.67157 1.67157 2 2.5 2H13.5C14.3284 2 15 2.67157 15 3.5V9.5C15 10.3284 14.3284 11 13.5 11H11.5C11.3247 11 11.1564 10.9699 11 10.9146V12.5C11 13.3284 10.3284 14 9.5 14H6.5C5.67157 14 5 13.3284 5 12.5V7.91465C4.84361 7.96992 4.67532 8 4.5 8H2.5C1.67157 8 1 7.32843 1 6.5V3.5ZM6 12.5C6 12.7761 6.22386 13 6.5 13H9.5C9.77614 13 10 12.7761 10 12.5V3H6V12.5ZM5 3H2.5C2.22386 3 2 3.22386 2 3.5V6.5C2 6.77614 2.22386 7 2.5 7H4.5C4.77614 7 5 6.77614 5 6.5V3ZM11 3V9.5C11 9.77614 11.2239 10 11.5 10H13.5C13.7761 10 14 9.77614 14 9.5V3.5C14 3.22386 13.7761 3 13.5 3H11Z" />
                    </svg>
                    <span className={styles.createNewDropdownItemText}>Kanban</span>
                  </li>

                  {/* Timeline + Team badge */}
                  <li className={styles.createNewDropdownItem} style={{ transform: 'translateY(1px)' }}>
                    <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#DC043B" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision', transform: 'translateY(-0.5px)' }}>
                      <path fillRule="evenodd" d="M9 0.5C9 0.223858 8.77614 0 8.5 0C8.22386 0 8 0.223858 8 0.5V15.5C8 15.7761 8.22386 16 8.5 16C8.77614 16 9 15.7761 9 15.5V14H11.5C12.3284 14 13 13.3284 13 12.5V10.5C13 9.67157 12.3284 9 11.5 9H9V7H14.5C15.3284 7 16 6.32843 16 5.5V3.5C16 2.67157 15.3284 2 14.5 2H9V0.5ZM9 3V6H14.5C14.7761 6 15 5.77614 15 5.5V3.5C15 3.22386 14.7761 3 14.5 3H9ZM9 10V13H11.5C11.7761 13 12 12.7761 12 12.5V10.5C12 10.2239 11.7761 10 11.5 10H9Z M4.5 2H7V3H4.5C4.22386 3 4 3.22386 4 3.5V5.5C4 5.77614 4.22386 6 4.5 6H7V7H4.5C3.67157 7 3 6.32843 3 5.5V3.5C3 2.67157 3.67157 2 4.5 2Z M7 9H1.5C0.671573 9 0 9.67157 0 10.5V12.5C0 13.3284 0.671573 14 1.5 14H7V13H1.5C1.22386 13 1 12.7761 1 12.5V10.5C1 10.2239 1.22386 10 1.5 10H7V9Z" />
                    </svg>
                    <span className={styles.createNewDropdownItemText}>
                      Timeline
                      <span className={styles.createNewDropdownTeamBadge}>
                        <svg className={styles.createNewDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                        </svg>
                        Team
                      </span>
                    </span>
                  </li>

                  {/* List */}
                  <li className={styles.createNewDropdownItem} style={{ transform: 'translateY(1px)' }}>
                    <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#0D52AC" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                      <path fillRule="nonzero" d="M8.5 10C8.5 9.72386 8.72386 9.5 9 9.5H12C12.2761 9.5 12.5 9.72386 12.5 10C12.5 10.2761 12.2761 10.5 12 10.5H9C8.72386 10.5 8.5 10.2761 8.5 10Z M8.5 6.5C8.5 6.22386 8.72386 6 9 6H12C12.2761 6 12.5 6.22386 12.5 6.5C12.5 6.77614 12.2761 7 12 7H9C8.72386 7 8.5 6.77614 8.5 6.5Z M7.61756 5.16104C7.80477 5.36404 7.79196 5.68036 7.58896 5.86756L5.42021 7.86756C5.22853 8.04433 4.93319 8.04412 4.74176 7.86708L3.66051 6.86708C3.45778 6.67958 3.44543 6.36324 3.63292 6.16051C3.82042 5.95778 4.13676 5.94543 4.33949 6.13292L5.08174 6.8194L6.91104 5.13244C7.11404 4.94523 7.43036 4.95804 7.61756 5.16104Z M7.61756 8.66104C7.80477 8.86404 7.79196 9.18036 7.58896 9.36756L5.42021 11.3676C5.22853 11.5443 4.93319 11.5441 4.74176 11.3671L3.66051 10.3671C3.45778 10.1796 3.44543 9.86324 3.63292 9.66051C3.82042 9.45778 4.13676 9.44543 4.33949 9.63292L5.08174 10.3194L6.91104 8.63244C7.11404 8.44523 7.43036 8.45804 7.61756 8.66104Z M1 3.5C1 2.67157 1.67157 2 2.5 2H13.5C14.3284 2 15 2.67157 15 3.5V12.5C15 13.3284 14.3284 14 13.5 14H2.5C1.67157 14 1 13.3284 1 12.5V3.5ZM2.5 3C2.22386 3 2 3.22386 2 3.5V12.5C2 12.7761 2.22386 13 2.5 13H13.5C13.7761 13 14 12.7761 14 12.5V3.5C14 3.22386 13.7761 3 13.5 3H2.5Z" />
                    </svg>
                    <span className={styles.createNewDropdownItemText}>List</span>
                  </li>

                  {/* Gantt + Team badge */}
                  <li className={styles.createNewDropdownItem} style={{ transform: 'translateY(2px)' }}>
                    <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#0C7F78" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision', transform: 'translateY(-0.5px)' }}>
                      <path fillRule="nonzero" d="M0 3.5C0 2.67157 0.671573 2 1.5 2H11.5C12.3284 2 13 2.67157 13 3.5V5.5C13 6.32843 12.3284 7 11.5 7H4.5V10C4.5 10.5523 4.94771 11 5.5 11H7.5V10.5C7.5 9.67157 8.17157 9 9 9H14.5C15.3284 9 16 9.67157 16 10.5V12.5C16 13.3284 15.3284 14 14.5 14H9C8.17157 14 7.5 13.3284 7.5 12.5V12H5.5C4.39543 12 3.5 11.1046 3.5 10V7H1.5C0.671573 7 0 6.32843 0 5.5V3.5ZM8.5 12.5C8.5 12.7761 8.72386 13 9 13H14.5C14.7761 13 15 12.7761 15 12.5V10.5C15 10.2239 14.7761 10 14.5 10H9C8.72386 10 8.5 10.2239 8.5 10.5V12.5ZM1.5 3C1.22386 3 1 3.22386 1 3.5V5.5C1 5.77614 1.22386 6 1.5 6H11.5C11.7761 6 12 5.77614 12 5.5V3.5C12 3.22386 11.7761 3 11.5 3H1.5Z" />
                    </svg>
                    <span className={styles.createNewDropdownItemText}>
                      Gantt
                      <span className={styles.createNewDropdownTeamBadge}>
                        <svg className={styles.createNewDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                        </svg>
                        Team
                      </span>
                    </span>
                  </li>

                  {/* Divider 1 */}
                  <li className={styles.createNewDropdownDivider} aria-hidden="true" style={{ transform: 'translateY(2px)' }} />

                  {/* Form */}
                  <li className={styles.createNewDropdownItem} style={{ transform: 'translateY(2px)' }}>
                    <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#DD04A8" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                      <path fillRule="nonzero" d="M4.5 6.5C4.5 6.22386 4.72386 6 5 6H7.5C7.77614 6 8 6.22386 8 6.5C8 6.77614 7.77614 7 7.5 7H5C4.72386 7 4.5 6.77614 4.5 6.5Z M5.5 8C4.67157 8 4 8.67157 4 9.5C4 10.3284 4.67157 11 5.5 11H10.5C11.3284 11 12 10.3284 12 9.5C12 8.67157 11.3284 8 10.5 8H5.5ZM5 9.5C5 9.22386 5.22386 9 5.5 9H10.5C10.7761 9 11 9.22386 11 9.5C11 9.77614 10.7761 10 10.5 10H5.5C5.22386 10 5 9.77614 5 9.5Z M1 3.5C1 2.67157 1.67157 2 2.5 2H13.5C14.3284 2 15 2.67157 15 3.5V12.5C15 13.3284 14.3284 14 13.5 14H2.5C1.67157 14 1 13.3284 1 12.5V3.5ZM2.5 3C2.22386 3 2 3.22386 2 3.5V12.5C2 12.7761 2.22386 13 2.5 13H13.5C13.7761 13 14 12.7761 14 12.5V3.5C14 3.22386 13.7761 3 13.5 3H2.5Z" />
                    </svg>
                    <span className={styles.createNewDropdownItemText}>Form</span>
                  </li>

                  {/* Divider 2 */}
                  <li className={styles.createNewDropdownDivider} aria-hidden="true" style={{ transform: 'translateY(2px)' }} />

                  {/* Section + Team badge */}
                  <li className={styles.createNewDropdownItem} style={{ transform: 'translateY(3px)' }}>
                    <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#1D1F25" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision', transform: 'translateY(-0.5px)' }}>
                      <path fillRule="nonzero" d="M1 3.5C1 2.67157 1.67157 2 2.5 2H13.5C14.3284 2 15 2.67157 15 3.5V12.5C15 13.3284 14.3284 14 13.5 14H2.5C1.67157 14 1 13.3284 1 12.5V3.5ZM2.5 3C2.22386 3 2 3.22386 2 3.5V5.5L14 5.5V3.5C14 3.22386 13.7761 3 13.5 3H2.5ZM2 10.5L2 12.5C2 12.7761 2.22386 13 2.5 13H13.5C13.7761 13 14 12.7761 14 12.5V10.5L2 10.5ZM2 6.5L2 9.5L14 9.5V6.5L2 6.5Z" />
                    </svg>
                    <span className={styles.createNewDropdownItemText}>
                      Section
                      <span className={styles.createNewDropdownTeamBadge}>
                        <svg className={styles.createNewDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                        </svg>
                        Team
                      </span>
                    </span>
                  </li>
                </ul>,
                document.body
                );
              })()}

              {/* Create View Box (rendered via portal) */}
              {isCreateViewBoxOpen && (() => {
                const rect = createNewButtonRef.current?.getBoundingClientRect();
                const boxStyle: React.CSSProperties = rect
                  ? { top: rect.top, left: rect.right + 23 }
                  : {};
                return createPortal(
                  <div ref={createViewBoxRef} className={styles.createViewBoxContainer} style={boxStyle}>
                    {/* Name input section */}
                    <div className={styles.createViewBoxInputSection}>
                      <input
                        ref={createViewInputRef}
                        type="text"
                        className={styles.createViewBoxInput}
                        value={createViewName}
                        onChange={(e) => setCreateViewName(e.target.value)}
                      />
                    </div>

                    {/* "Who can edit" label */}
                    <div className={styles.createViewBoxWhoCanEditLabel}>Who can edit</div>

                    {/* Three options container */}
                    <ul className={styles.createViewBoxOptionsContainer}>
                      {/* Option 1: Collaborative (selected) */}
                      <li className={styles.createViewBoxOption} style={{ marginRight: 16 }}>
                        {/* Radio circle (selected) */}
                        <div className={styles.createViewBoxRadioCircleSelected}>
                          <div className={styles.createViewBoxRadioDot} />
                        </div>
                        {/* UsersThree icon */}
                        <svg className={styles.createViewBoxOptionIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                          <path fillRule="nonzero" d="M3.68726 2.76918C3.00369 2.77619 2.31788 3.05605 1.8208 3.65761C0.919321 4.74857 1.17576 6.24775 2.08557 7.09572C1.40673 7.38504 0.802933 7.84404 0.349488 8.4507C0.310181 8.50329 0.281619 8.56312 0.265432 8.62675C0.249245 8.69038 0.24575 8.75658 0.255147 8.82157C0.264544 8.88656 0.286648 8.94905 0.320199 9.00549C0.353749 9.06194 0.398088 9.11122 0.450684 9.15053C0.503281 9.18983 0.563104 9.21839 0.626738 9.23458C0.690373 9.25077 0.756572 9.25426 0.821558 9.24487C0.886543 9.23547 0.949041 9.21337 1.00548 9.17981C1.06193 9.14626 1.11121 9.10193 1.15051 9.04933C1.76315 8.2297 2.72586 7.74834 3.74915 7.75001C3.74907 7.75005 3.74923 7.74997 3.74915 7.75001C3.74953 7.75001 3.75011 7.75001 3.75049 7.75001C3.87664 7.74769 3.99725 7.69777 4.08814 7.61024C4.09539 7.60337 4.10243 7.59629 4.10925 7.589C4.19691 7.49831 4.24706 7.37783 4.24963 7.25172C4.24951 7.252 4.24976 7.25144 4.24963 7.25172C4.24959 7.25147 4.24992 7.25038 4.24988 7.25013C4.24984 7.25034 4.24992 7.24993 4.24988 7.25013C4.24976 7.24984 4.24976 7.24894 4.24963 7.24865C4.24718 7.12237 4.19703 7.0017 4.10925 6.91088C4.10254 6.90377 4.09562 6.89685 4.0885 6.89013C3.99767 6.80248 3.87706 6.75243 3.75086 6.75001C3.75044 6.75001 3.75005 6.75014 3.74963 6.75014C3.74967 6.75018 3.74959 6.7501 3.74963 6.75014C2.44509 6.75147 1.76078 5.30012 2.59168 4.29457C3.42258 3.28902 4.97671 3.68735 5.22131 4.96876C5.23363 5.03326 5.25853 5.09471 5.29459 5.14958C5.33066 5.20446 5.37718 5.25169 5.4315 5.28859C5.48582 5.32549 5.54687 5.35132 5.61118 5.36462C5.67548 5.37792 5.74178 5.37843 5.80628 5.3661C5.93651 5.34123 6.05154 5.26564 6.12605 5.15596C6.20057 5.04629 6.22847 4.91151 6.20361 4.78126C5.95974 3.50367 4.82653 2.7575 3.68726 2.76918Z M12.3127 2.76918C11.1735 2.7575 10.0403 3.50367 9.79639 4.78126C9.77154 4.91151 9.79943 5.04629 9.87395 5.15596C9.94846 5.26564 10.0635 5.34123 10.1937 5.3661C10.2582 5.37843 10.3245 5.37792 10.3888 5.36462C10.4531 5.35132 10.5142 5.32549 10.5685 5.28859C10.6228 5.25169 10.6693 5.20446 10.7054 5.14958C10.7415 5.09471 10.7664 5.03326 10.7787 4.96876C11.0233 3.68735 12.5774 3.28902 13.4083 4.29457C14.2392 5.30012 13.555 6.75134 12.2505 6.75001C12.2505 6.74997 12.2504 6.75005 12.2505 6.75001C12.25 6.75001 12.2496 6.75001 12.2491 6.75001C12.1871 6.76292 12.1282 6.78748 12.0753 6.8224C12.0115 6.83534 11.9508 6.86064 11.8966 6.89686C11.8603 6.95112 11.835 7.01196 11.8221 7.07594C11.7873 7.12872 11.7629 7.18762 11.75 7.24952C11.75 7.24931 11.7501 7.24973 11.75 7.24952C11.75 7.24976 11.7501 7.25064 11.75 7.25088C11.7629 7.31289 11.7875 7.37187 11.8224 7.42471C11.8353 7.48856 11.8606 7.54927 11.8969 7.60342C11.9511 7.63969 12.0119 7.66499 12.0759 7.67788C12.1287 7.71269 12.1876 7.73717 12.2495 7.75003C12.2499 7.75003 12.2502 7.7499 12.2506 7.7499C12.2505 7.74986 12.2507 7.74994 12.2506 7.7499C13.2738 7.7481 14.237 8.22964 14.8495 9.04934C14.8888 9.10194 14.9381 9.14628 14.9945 9.17983C15.051 9.21338 15.1135 9.23548 15.1785 9.24488C15.2434 9.25428 15.3096 9.25078 15.3733 9.2346C15.4369 9.21841 15.4967 9.18985 15.5493 9.15054C15.6019 9.11123 15.6463 9.06195 15.6798 9.00551C15.7134 8.94907 15.7355 8.88657 15.7449 8.82158C15.7543 8.7566 15.7508 8.6904 15.7346 8.62676C15.7184 8.56313 15.6898 8.50331 15.6505 8.45071C15.1971 7.844 14.5934 7.38493 13.9146 7.09561C14.8243 6.24762 15.0806 4.74853 14.1792 3.65762C13.6821 3.05606 12.9962 2.77619 12.3127 2.76918Z M8 5.75001C6.34908 5.75001 5 7.0991 5 8.75001C5 9.72266 5.47549 10.5819 6.19788 11.1309C5.23485 11.5518 4.42849 12.3022 3.95068 13.2808C3.92187 13.3398 3.90497 13.4039 3.90093 13.4694C3.8969 13.535 3.90582 13.6007 3.92717 13.6628C3.94853 13.7249 3.98191 13.7821 4.0254 13.8313C4.0689 13.8805 4.12165 13.9207 4.18067 13.9495C4.29982 14.0076 4.4372 14.0161 4.56258 13.9729C4.68796 13.9298 4.79107 13.8386 4.84924 13.7195C5.43767 12.5144 6.65894 11.7517 8 11.7517C9.34106 11.7517 10.5623 12.5144 11.1508 13.7195C11.2089 13.8386 11.312 13.9298 11.4374 13.9729C11.5628 14.0161 11.7002 14.0076 11.8193 13.9495C11.8783 13.9207 11.9311 13.8805 11.9746 13.8313C12.0181 13.7821 12.0515 13.7249 12.0728 13.6628C12.0942 13.6007 12.1031 13.535 12.0991 13.4694C12.095 13.4039 12.0781 13.3398 12.0493 13.2808C11.5715 12.3022 10.7652 11.5518 9.80212 11.1309C10.5245 10.5819 11 9.72266 11 8.75001C11 7.0991 9.65092 5.75001 8 5.75001ZM8 6.75001C9.11046 6.75001 10 7.63956 10 8.75001C10 9.86047 9.11046 10.75 8 10.75C6.88955 10.75 6 9.86047 6 8.75001C6 7.63956 6.88955 6.75001 8 6.75001Z" />
                        </svg>
                        {/* Text */}
                        <span className={styles.createViewBoxOptionText} style={{ marginRight: 4 }}>Collaborative</span>
                      </li>

                      {/* Option 2: Personal */}
                      <li className={styles.createViewBoxOption} style={{ marginRight: 16 }}>
                        {/* Radio circle (unselected) */}
                        <div className={styles.createViewBoxRadioCircle} />
                        {/* User icon */}
                        <svg className={styles.createViewBoxOptionIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                          <path fillRule="nonzero" d="M8 9.49951C5.32109 9.49957 2.84382 10.93 1.50451 13.2501C1.43822 13.365 1.42025 13.5014 1.45457 13.6295C1.48888 13.7576 1.57267 13.8668 1.6875 13.9331C1.80235 13.9994 1.93883 14.0173 2.06691 13.983C2.195 13.9487 2.30419 13.8648 2.37048 13.75C3.53197 11.738 5.67677 10.4996 8 10.4995C10.3232 10.4995 12.4681 11.7379 13.6295 13.75C13.6958 13.8648 13.805 13.9487 13.9331 13.983C14.0612 14.0173 14.1976 13.9994 14.3125 13.9331C14.4273 13.8668 14.5111 13.7576 14.5454 13.6295C14.5797 13.5014 14.5618 13.365 14.4955 13.2501C13.1563 10.9299 10.679 9.49944 8 9.49951Z M8 1.5C5.52065 1.5 3.5 3.52065 3.5 6C3.5 8.47935 5.52065 10.4995 8 10.4995C10.4793 10.4995 12.5 8.47935 12.5 6C12.5 3.52065 10.4793 1.5 8 1.5ZM8 2.5C9.9389 2.5 11.5 4.0611 11.5 6C11.5 7.9389 9.9389 9.49951 8 9.49951C6.0611 9.49951 4.5 7.9389 4.5 6C4.5 4.0611 6.0611 2.5 8 2.5Z" />
                        </svg>
                        {/* Text */}
                        <span className={styles.createViewBoxOptionText} style={{ marginRight: 4 }}>Personal</span>
                        {/* Upsell star */}
                        <svg className={styles.createViewBoxUpsellStar} viewBox="0 0 16 16" fill="rgb(22, 110, 225)" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                          <path fillRule="nonzero" d="M9.84928 11.9396C9.96786 12.0088 10.106 12.0487 10.2443 12.0496C10.4026 12.0486 10.5606 11.9986 10.6893 11.8996C10.9293 11.7196 11.0393 11.3996 10.9693 11.1096L10.4293 8.98961L12.0993 7.59961C12.3393 7.40961 12.4293 7.07961 12.3393 6.78961C12.2393 6.48961 11.9793 6.27961 11.6693 6.25961L9.49928 6.11961L8.68928 4.07961C8.58928 3.78961 8.29928 3.59961 7.99928 3.59961C7.69928 3.59961 7.41928 3.78961 7.30928 4.07961L6.49928 6.11961L4.32928 6.25961C4.01928 6.27961 3.74928 6.48961 3.65928 6.78961C3.56928 7.07961 3.66928 7.40961 3.89928 7.59961L5.55928 8.98961L5.05928 10.9496C4.97928 11.2696 5.09928 11.6096 5.35928 11.8096C5.62928 12.0096 5.99928 12.0296 6.27928 11.8496L7.99928 10.7596L9.84928 11.9396ZM8.40928 9.98961C8.28928 9.91961 8.14928 9.87961 8.00928 9.87961V9.88961C7.86928 9.88961 7.72928 9.91961 7.60928 9.99961L5.92928 11.0596L6.41928 9.13961C6.48928 8.85961 6.38928 8.54961 6.16928 8.36961L4.64928 7.09961L6.62928 6.96961C6.91928 6.94961 7.17928 6.75961 7.27928 6.48961L8.00928 4.64961L8.73928 6.48961C8.83928 6.76961 9.09928 6.94961 9.38928 6.96961L11.3693 7.09961L9.84928 8.36961C9.61928 8.54961 9.51928 8.84961 9.58928 9.10961L10.0893 11.0596L8.40928 9.98961Z M7.99999 1C4.134 1 0.999992 4.13401 0.999992 8C0.999992 11.866 4.134 15 7.99999 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 7.99999 1ZM1.99999 8C1.99999 4.68629 4.68628 2 7.99999 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 7.99999 14C4.68628 14 1.99999 11.3137 1.99999 8Z" />
                        </svg>
                      </li>

                      {/* Option 3: Locked */}
                      <li className={styles.createViewBoxOption} style={{ marginRight: 16 }}>
                        {/* Radio circle (unselected) */}
                        <div className={styles.createViewBoxRadioCircle} />
                        {/* Lock icon */}
                        <svg className={styles.createViewBoxOptionIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                          <path fillRule="nonzero" d="M8 10.25C8.41419 10.25 8.75 9.91419 8.75 9.5C8.75 9.08581 8.41419 8.75 8 8.75C7.58581 8.75 7.25 9.08581 7.25 9.5C7.25 9.91419 7.58581 10.25 8 10.25Z M8 0.5C6.48714 0.5 5.25 1.73714 5.25 3.25V5H3C2.45364 5 2 5.45364 2 6V13C2 13.5464 2.45364 14 3 14H13C13.5464 14 14 13.5464 14 13V6C14 5.45364 13.5464 5 13 5H10.75V3.25C10.75 1.73714 9.51286 0.5 8 0.5ZM8 1.5C8.97242 1.5 9.75 2.27758 9.75 3.25V5H6.25V3.25C6.25 2.27758 7.02758 1.5 8 1.5ZM3 6H13V13H3V6Z" />
                        </svg>
                        {/* Text */}
                        <span className={styles.createViewBoxOptionText} style={{ marginRight: 4 }}>Locked</span>
                        {/* Upsell star */}
                        <svg className={styles.createViewBoxUpsellStar} viewBox="0 0 16 16" fill="rgb(22, 110, 225)" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                          <path fillRule="nonzero" d="M9.84928 11.9396C9.96786 12.0088 10.106 12.0487 10.2443 12.0496C10.4026 12.0486 10.5606 11.9986 10.6893 11.8996C10.9293 11.7196 11.0393 11.3996 10.9693 11.1096L10.4293 8.98961L12.0993 7.59961C12.3393 7.40961 12.4293 7.07961 12.3393 6.78961C12.2393 6.48961 11.9793 6.27961 11.6693 6.25961L9.49928 6.11961L8.68928 4.07961C8.58928 3.78961 8.29928 3.59961 7.99928 3.59961C7.69928 3.59961 7.41928 3.78961 7.30928 4.07961L6.49928 6.11961L4.32928 6.25961C4.01928 6.27961 3.74928 6.48961 3.65928 6.78961C3.56928 7.07961 3.66928 7.40961 3.89928 7.59961L5.55928 8.98961L5.05928 10.9496C4.97928 11.2696 5.09928 11.6096 5.35928 11.8096C5.62928 12.0096 5.99928 12.0296 6.27928 11.8496L7.99928 10.7596L9.84928 11.9396ZM8.40928 9.98961C8.28928 9.91961 8.14928 9.87961 8.00928 9.87961V9.88961C7.86928 9.88961 7.72928 9.91961 7.60928 9.99961L5.92928 11.0596L6.41928 9.13961C6.48928 8.85961 6.38928 8.54961 6.16928 8.36961L4.64928 7.09961L6.62928 6.96961C6.91928 6.94961 7.17928 6.75961 7.27928 6.48961L8.00928 4.64961L8.73928 6.48961C8.83928 6.76961 9.09928 6.94961 9.38928 6.96961L11.3693 7.09961L9.84928 8.36961C9.61928 8.54961 9.51928 8.84961 9.58928 9.10961L10.0893 11.0596L8.40928 9.98961Z M7.99999 1C4.134 1 0.999992 4.13401 0.999992 8C0.999992 11.866 4.134 15 7.99999 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 7.99999 1ZM1.99999 8C1.99999 4.68629 4.68628 2 7.99999 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 7.99999 14C4.68628 14 1.99999 11.3137 1.99999 8Z" />
                        </svg>
                      </li>
                    </ul>

                    {/* Description text */}
                    <div className={styles.createViewBoxDescription}>All collaborators can edit the configuration</div>

                    {/* Buttons container */}
                    <div className={styles.createViewBoxButtonsContainer}>
                      <button
                        type="button"
                        className={styles.createViewBoxCancelButton}
                        onClick={() => setIsCreateViewBoxOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={styles.createViewBoxCreateButton}
                        disabled={createViewMut.isPending || !createViewName.trim()}
                        onClick={() => {
                          if (createViewName.trim()) {
                            createViewMut.mutate({
                              tableId,
                              name: createViewName.trim(),
                              config: { search: '', filters: [], sort: null, hiddenColumnIds: [] },
                            });
                          }
                        }}
                      >
                        {createViewMut.isPending ? 'Creating...' : 'Create new view'}
                      </button>
                    </div>
                  </div>,
                  document.body
                );
              })()}

              {/* "Find a view" search bar */}
              <div className={styles.viewsSidebarSearchWrapper}>
                <svg
                  className={styles.viewsSidebarSearchIcon}
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path fillRule="nonzero" d="M7.25 1.5C4.08028 1.5 1.5 4.08028 1.5 7.25C1.5 10.4197 4.08028 13 7.25 13C8.65529 13 9.94315 12.4911 10.9432 11.6503L13.6465 14.3534C13.7402 14.4471 13.8674 14.4998 14 14.4998C14.1326 14.4998 14.2598 14.4471 14.3535 14.3534C14.4473 14.2596 14.4999 14.1325 14.4999 13.9999C14.4999 13.8673 14.4473 13.7401 14.3535 13.6464L11.6504 10.9431C12.4912 9.94305 13 8.65523 13 7.25C13 4.08028 10.4197 1.5 7.25 1.5ZM7.25 2.5C9.87928 2.5 12 4.62072 12 7.25C12 8.56227 11.4715 9.74761 10.6154 10.6061C10.6132 10.607 10.611 10.6079 10.6089 10.6088C10.608 10.611 10.6071 10.6132 10.6062 10.6154C9.74772 11.4715 8.5623 12 7.25 12C4.62072 12 2.5 9.87928 2.5 7.25C2.5 4.62072 4.62072 2.5 7.25 2.5Z" />
                </svg>
                <input
                  type="text"
                  className={styles.viewsSidebarSearchInput}
                  placeholder="Find a view"
                  value={viewSearchQuery}
                  onChange={(e) => setViewSearchQuery(e.target.value)}
                />
              </div>

              {/* View items list */}
              <ul className={styles.viewsSidebarViewList}>
                {views
                  .filter(v => !viewSearchQuery || v.name.toLowerCase().includes(viewSearchQuery.toLowerCase()))
                  .map((view) => (
                  <li
                    key={view.id}
                    className={`${styles.viewsSidebarViewItem} ${view.id === activeViewId ? styles.viewsSidebarViewItemActive : ''}`}
                    onClick={() => setActiveViewId(view.id)}
                  >
                    <div className={styles.viewsSidebarViewItemRow}>
                      {/* Grid Feature icon (shown by default, hidden on hover) */}
                      <svg
                        className={styles.viewsSidebarViewItemGridIcon}
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path fillRule="evenodd" d="M2.5 2C1.67157 2 1 2.67157 1 3.5V12.5C1 13.3284 1.67157 14 2.5 14H13.5C14.3284 14 15 13.3284 15 12.5V3.5C15 2.67157 14.3284 2 13.5 2H2.5ZM2 3.5C2 3.22386 2.22386 3 2.5 3H13.5C13.7761 3 14 3.22386 14 3.5V5H2V3.5ZM8.5 6H14V9H8.5V6ZM7.5 9V6H2V9H7.5ZM2 10V12.5C2 12.7761 2.22386 13 2.5 13H7.5V10H2ZM8.5 10H14V12.5C14 12.7761 13.7761 13 13.5 13H8.5V10Z" />
                      </svg>

                      {/* Star icon (hidden by default, shown on hover) */}
                      <svg
                        className={`${styles.viewsSidebarViewItemStarIcon} ${favoritedViews.has(view.id) ? styles.viewsSidebarViewItemStarIconFavorited : ''}`}
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden="true"
                        style={{ shapeRendering: "geometricPrecision" }}
                        onClick={(e) => { e.stopPropagation(); handleToggleViewFavorite(view.id); }}
                      >
                        {favoritedViews.has(view.id) ? (
                          <path fillRule="nonzero" d="M7.99975 0.996094C7.57318 0.996128 7.18836 1.26571 7.04259 1.66663L5.67284 5.11548C5.66565 5.13431 5.66096 5.1378 5.65221 5.13831L1.96166 5.37598C1.51229 5.40516 1.16169 5.73277 1.04735 6.10218C0.933105 6.47128 1.03046 6.92969 1.37353 7.21521L4.19848 9.57142C4.21392 9.58422 4.21899 9.59964 4.21471 9.61707L3.37182 12.9387C3.2506 13.4131 3.44889 13.8848 3.78808 14.1426C4.12727 14.4004 4.64722 14.4608 5.06213 14.1968L7.99255 12.3412C7.99764 12.338 8.00161 12.3375 8.00671 12.3407L11.157 14.3408C11.5342 14.5789 12.0093 14.5257 12.3175 14.2924C12.6257 14.059 12.8055 13.6299 12.6971 13.2023L11.7853 9.61706C11.781 9.59967 11.786 9.58428 11.7998 9.57287L14.6261 7.21545C14.9694 6.92994 15.0669 6.4714 14.9526 6.10217C14.8383 5.73276 14.4881 5.40527 14.0387 5.37609L10.3508 5.13854C10.3389 5.13779 10.3343 5.13439 10.3313 5.12621L8.95213 1.65295C8.81167 1.26574 8.4264 0.996056 7.99975 0.996094Z" />
                        ) : (
                          <path fillRule="nonzero" d="M7.99975 0.996094C7.57318 0.996128 7.18836 1.26571 7.04259 1.66663L7.04784 1.65295L5.67284 5.11548C5.67142 5.119 5.67004 5.12254 5.66869 5.1261C5.66565 5.13431 5.66096 5.1378 5.65221 5.13831L5.64916 5.13855L1.96166 5.37598V5.37598C1.51229 5.40516 1.16169 5.73277 1.04735 6.10218C0.933105 6.47128 1.03046 6.92969 1.37353 7.21521L4.19848 9.57142L4.20007 9.57276C4.21392 9.58422 4.21899 9.59964 4.21471 9.61707V9.61707L3.37182 12.9387C3.2506 13.4131 3.44889 13.8848 3.78808 14.1426C4.12727 14.4004 4.64722 14.4608 5.06213 14.1968L7.99255 12.3412V12.3412C7.99764 12.338 8.00161 12.3375 8.00671 12.3407V12.3407L11.157 14.3408L11.1582 14.3417C11.5342 14.5789 12.0093 14.5257 12.3175 14.2924C12.6257 14.059 12.8055 13.6299 12.6971 13.2023V13.2023L11.7853 9.61706C11.781 9.59967 11.786 9.58428 11.7998 9.57287L11.8015 9.57141L14.6261 7.21545C14.9694 6.92994 15.0669 6.4714 14.9526 6.10217C14.8383 5.73276 14.4881 5.40527 14.0387 5.37609V5.37609L10.3508 5.13854L10.3476 5.1383C10.3389 5.13779 10.3343 5.13439 10.3313 5.12621C10.3299 5.12262 10.3286 5.11904 10.3271 5.11547L8.95213 1.65295L8.95738 1.66674C8.81167 1.26574 8.4264 0.996056 7.99975 0.996094ZM7.99987 1.99609V1.99609C8.00935 1.99609 8.01434 1.99939 8.01758 2.0083C8.01926 2.01292 8.02101 2.01752 8.02283 2.02209L9.39783 5.4845L9.39368 5.47375C9.53379 5.85173 9.88715 6.11327 10.2896 6.13672L13.9741 6.37402C14.006 6.37609 13.9898 6.37346 13.9973 6.39782C14.0048 6.42217 14.0118 6.42588 13.9868 6.44665L13.986 6.44728L11.1627 8.80214C10.8543 9.05717 10.7183 9.46962 10.8147 9.85805L10.8154 9.86073L11.7278 13.4478C11.7382 13.4889 11.7274 13.4848 11.7137 13.4951C11.7001 13.5055 11.722 13.5149 11.6918 13.4959L8.54296 11.4967C8.21256 11.2868 7.78728 11.2867 7.4569 11.4967V11.4967L4.52623 13.3525L4.52526 13.3532C4.45892 13.3954 4.43836 13.3808 4.39318 13.3465C4.34799 13.3121 4.31816 13.2744 4.34068 13.1863V13.1863L5.18468 9.86049L5.18529 9.8578C5.28156 9.46947 5.14573 9.05742 4.83752 8.80237L2.01403 6.44727L2.01318 6.44664C1.98816 6.42587 1.99514 6.42216 2.00268 6.39781C2.01021 6.37347 1.99424 6.37596 2.02612 6.37389L5.71337 6.13646L5.71032 6.13659C6.11276 6.11317 6.46615 5.85184 6.60632 5.47387L7.97717 2.02209C7.97898 2.01751 7.98073 2.01292 7.98242 2.00829C7.98567 1.99933 7.99034 1.99609 7.99987 1.99609Z" />
                        )}
                      </svg>

                      {/* View name text */}
                      <span className={styles.viewsSidebarViewItemText}>{view.name}</span>

                      {/* Actions (shown on hover) */}
                      <div className={styles.viewsSidebarViewItemActions}>
                        {/* Overflow (three dots) icon */}
                        <svg
                          className={styles.viewsSidebarViewItemOverflowIcon}
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          aria-hidden="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (contextMenuViewId === view.id) {
                              setContextMenuViewId(null);
                              setContextMenuPosition(null);
                            } else {
                              setContextMenuViewId(view.id);
                              setContextMenuPosition({ top: rect.bottom + 4, left: rect.left - 40 });
                            }
                          }}
                        >
                          <path fillRule="nonzero" d="M5 8C5 8.55228 4.55228 9 4 9C3.44772 9 3 8.55228 3 8C3 7.44772 3.44772 7 4 7C4.55228 7 5 7.44772 5 8Z M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z M13 8C13 8.55228 12.5523 9 12 9C11.4477 9 11 8.55228 11 8C11 7.44772 11.4477 7 12 7C12.5523 7 13 7.44772 13 8Z" />
                        </svg>

                        {/* DotsSixVertical (drag handle) icon */}
                        <svg
                          className={styles.viewsSidebarViewItemDragIcon}
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path fillRule="nonzero" d="M5.75 4.5C6.16419 4.5 6.5 4.16419 6.5 3.75C6.5 3.33581 6.16419 3 5.75 3C5.33581 3 5 3.33581 5 3.75C5 4.16419 5.33581 4.5 5.75 4.5Z M10.25 4.5C10.6642 4.5 11 4.16419 11 3.75C11 3.33581 10.6642 3 10.25 3C9.83581 3 9.5 3.33581 9.5 3.75C9.5 4.16419 9.83581 4.5 10.25 4.5Z M5.75 8.75C6.16419 8.75 6.5 8.41419 6.5 8C6.5 7.58581 6.16419 7.25 5.75 7.25C5.33581 7.25 5 7.58581 5 8C5 8.41419 5.33581 8.75 5.75 8.75Z M10.25 8.75C10.6642 8.75 11 8.41419 11 8C11 7.58581 10.6642 7.25 10.25 7.25C9.83581 7.25 9.5 7.58581 9.5 8C9.5 8.41419 9.83581 8.75 10.25 8.75Z M5.75 13C6.16419 13 6.5 12.6642 6.5 12.25C6.5 11.8358 6.16419 11.5 5.75 11.5C5.33581 11.5 5 11.8358 5 12.25C5 12.6642 5.33581 13 5.75 13Z M10.25 13C10.6642 13 11 12.6642 11 12.25C11 11.8358 10.6642 11.5 10.25 11.5C9.83581 11.5 9.5 11.8358 9.5 12.25C9.5 12.6642 9.83581 13 10.25 13Z" />
                        </svg>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* View Item Context Menu (rendered via portal) */}
              {contextMenuViewId && contextMenuPosition && (() => {
                const menuStyle: React.CSSProperties = {
                  top: contextMenuPosition.top,
                  left: contextMenuPosition.left,
                };
                return createPortal(
                  <ul ref={viewItemContextMenuRef} className={styles.viewItemContextMenuContainer} style={menuStyle} onClick={(e) => e.stopPropagation()}>
                    {/* Add to 'My favorites' */}
                    <li className={styles.viewItemContextMenuItem}>
                      {/* Star icon */}
                      <svg className={styles.viewItemContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                        <path fillRule="nonzero" d="M7.99975 0.996094C7.57318 0.996128 7.18836 1.26571 7.04259 1.66663L7.04784 1.65295L5.67284 5.11548C5.67142 5.119 5.67004 5.12254 5.66869 5.1261C5.66565 5.13431 5.66096 5.1378 5.65221 5.13831L5.64916 5.13855L1.96166 5.37598V5.37598C1.51229 5.40516 1.16169 5.73277 1.04735 6.10218C0.933105 6.47128 1.03046 6.92969 1.37353 7.21521L4.19848 9.57142L4.20007 9.57276C4.21392 9.58422 4.21899 9.59964 4.21471 9.61707V9.61707L3.37182 12.9387C3.2506 13.4131 3.44889 13.8848 3.78808 14.1426C4.12727 14.4004 4.64722 14.4608 5.06213 14.1968L7.99255 12.3412V12.3412C7.99764 12.338 8.00161 12.3375 8.00671 12.3407V12.3407L11.157 14.3408L11.1582 14.3417C11.5342 14.5789 12.0093 14.5257 12.3175 14.2924C12.6257 14.059 12.8055 13.6299 12.6971 13.2023V13.2023L11.7853 9.61706C11.781 9.59967 11.786 9.58428 11.7998 9.57287L11.8015 9.57141L14.6261 7.21545C14.9694 6.92994 15.0669 6.4714 14.9526 6.10217C14.8383 5.73276 14.4881 5.40527 14.0387 5.37609V5.37609L10.3508 5.13854L10.3476 5.1383C10.3389 5.13779 10.3343 5.13439 10.3313 5.12621C10.3299 5.12262 10.3286 5.11904 10.3271 5.11547L8.95213 1.65295L8.95738 1.66674C8.81167 1.26574 8.4264 0.996056 7.99975 0.996094ZM7.99987 1.99609V1.99609C8.00935 1.99609 8.01434 1.99939 8.01758 2.0083C8.01926 2.01292 8.02101 2.01752 8.02283 2.02209L9.39783 5.4845L9.39368 5.47375C9.53379 5.85173 9.88715 6.11327 10.2896 6.13672L13.9741 6.37402C14.006 6.37609 13.9898 6.37346 13.9973 6.39782C14.0048 6.42217 14.0118 6.42588 13.9868 6.44665L13.986 6.44728L11.1627 8.80214C10.8543 9.05717 10.7183 9.46962 10.8147 9.85805L10.8154 9.86073L11.7278 13.4478C11.7382 13.4889 11.7274 13.4848 11.7137 13.4951C11.7001 13.5055 11.722 13.5149 11.6918 13.4959L8.54296 11.4967C8.21256 11.2868 7.78728 11.2867 7.4569 11.4967V11.4967L4.52623 13.3525L4.52526 13.3532C4.45892 13.3954 4.43836 13.3808 4.39318 13.3465C4.34799 13.3121 4.31816 13.2744 4.34068 13.1863V13.1863L5.18468 9.86049L5.18529 9.8578C5.28156 9.46947 5.14573 9.05742 4.83752 8.80237L2.01403 6.44727L2.01318 6.44664C1.98816 6.42587 1.99514 6.42216 2.00268 6.39781C2.01021 6.37347 1.99424 6.37596 2.02612 6.37389L5.71337 6.13646L5.71032 6.13659C6.11276 6.11317 6.46615 5.85184 6.60632 5.47387L7.97717 2.02209C7.97898 2.01751 7.98073 2.01292 7.98242 2.00829C7.98567 1.99933 7.99034 1.99609 7.99987 1.99609Z" />
                      </svg>
                      {/* Text + Team badge container */}
                      <div className={styles.viewItemContextMenuFavContainer}>
                        <span className={styles.viewItemContextMenuFavText}>Add to &apos;My favorites&apos;</span>
                        {/* Team badge */}
                        <span className={styles.createNewDropdownTeamBadge} style={{ marginLeft: 0, transform: 'translate(-8px, 0px)' }}>
                          <svg className={styles.createNewDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                          </svg>
                          Team
                        </span>
                      </div>
                    </li>

                    {/* Separator */}
                    <li className={styles.viewItemContextMenuSeparator} />

                    {/* Rename view */}
                    <li
                      className={styles.viewItemContextMenuItem}
                      onClick={() => {
                        const viewToRename = views.find(v => v.id === contextMenuViewId);
                        if (viewToRename) {
                          setActiveViewId(viewToRename.id);
                          setRenameViewValue(viewToRename.name);
                          setIsRenamingView(true);
                          setIsViewDropdownOpen(false);
                          setIsCreateNewDropdownOpen(false);
                          setContextMenuViewId(null);
                          setContextMenuPosition(null);
                        }
                      }}
                    >
                      <svg className={styles.viewItemContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                        <path fillRule="nonzero" d="M10.5 1.71045C10.2406 1.71045 9.9813 1.80867 9.7876 2.00525L2.29017 9.50269L2.28931 9.50354C2.10332 9.69048 1.9991 9.94419 2.00001 10.2079V12.9999C2.00007 13.5462 2.45358 13.9998 2.99988 13.9999H5.79212C6.05578 14.0008 6.30942 13.8966 6.49635 13.7107L6.49732 13.7097L13.9948 6.21228C14.3878 5.82489 14.3878 5.17499 13.9948 4.7876L11.2124 2.00525C11.0187 1.80867 10.7594 1.71045 10.5 1.71045ZM10.4999 2.70715C10.4955 2.70269 10.5043 2.70269 10.4999 2.70715L10.5027 2.70972L13.2902 5.49719L13.2927 5.49976C13.2972 5.49534 13.2972 5.50418 13.2927 5.49976L13.2902 5.50269L12 6.79297L9.20704 4L10.4973 2.70972L10.4999 2.70715ZM8.50001 4.70703L11.293 7.5L5.79297 12.9999H3.00013L3.00001 10.207L8.50001 4.70703Z" />
                      </svg>
                      <span className={styles.viewItemContextMenuItemText}>Rename view</span>
                    </li>

                    {/* Duplicate view */}
                    <li className={styles.viewItemContextMenuItem} style={{ transform: 'translateY(-1px)' }}>
                      <svg className={styles.viewItemContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                        <path fillRule="nonzero" d="M2.5 5C2.3674 5.00001 2.24023 5.0527 2.14646 5.14646C2.0527 5.24023 2.00001 5.3674 2 5.5V13.5C2.00001 13.6326 2.0527 13.7598 2.14646 13.8535C2.24023 13.9473 2.3674 14 2.5 14H10.5C10.6326 14 10.7598 13.9473 10.8535 13.8535C10.9473 13.7598 11 13.6326 11 13.5V5.5C11 5.3674 10.9473 5.24023 10.8535 5.14646C10.7598 5.0527 10.6326 5.00001 10.5 5H2.5ZM3 6H10V13H3V6Z M5.5 2C5.3674 2.00001 5.24023 2.0527 5.14646 2.14646C5.0527 2.24023 5.00001 2.3674 5 2.5V5.5C5 5.63261 5.05268 5.75979 5.14645 5.85355C5.24021 5.94732 5.36739 6 5.5 6C5.63261 6 5.75979 5.94732 5.85355 5.85355C5.94732 5.75979 6 5.63261 6 5.5V3H13V10H10.5C10.3674 10 10.2402 10.0527 10.1464 10.1464C10.0527 10.2402 10 10.3674 10 10.5C10 10.6326 10.0527 10.7598 10.1464 10.8536C10.2402 10.9473 10.3674 11 10.5 11H13.5C13.6326 11 13.7598 10.9473 13.8535 10.8535C13.9473 10.7598 14 10.6326 14 10.5V2.5C14 2.3674 13.9473 2.24023 13.8535 2.14646C13.7598 2.0527 13.6326 2.00001 13.5 2H5.5Z" />
                      </svg>
                      <span className={styles.viewItemContextMenuItemText}>Duplicate view</span>
                    </li>

                    {/* Delete view */}
                    <li
                      className={styles.viewItemContextMenuItem}
                      style={canDeleteView ? { cursor: 'pointer', transform: 'translateY(-2px)' } : { opacity: 0.5, cursor: 'default', transform: 'translateY(-2px)' }}
                      onClick={() => {
                        if (canDeleteView && contextMenuViewId) {
                          deleteViewMut.mutate({ viewId: contextMenuViewId });
                        }
                      }}
                    >
                      <svg className={styles.viewItemContextMenuDeleteIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                        <path fillRule="nonzero" d="M6.5 6C6.36739 6 6.24021 6.05268 6.14645 6.14645C6.05268 6.24021 6 6.36739 6 6.5V10.5C6 10.6326 6.05268 10.7598 6.14645 10.8536C6.24021 10.9473 6.36739 11 6.5 11C6.63261 11 6.75979 10.9473 6.85355 10.8536C6.94732 10.7598 7 10.6326 7 10.5V6.5C7 6.36739 6.94732 6.24021 6.85355 6.14645C6.75979 6.05268 6.63261 6 6.5 6Z M9.5 6C9.36739 6 9.24021 6.05268 9.14645 6.14645C9.05268 6.24021 9 6.36739 9 6.5V10.5C9 10.6326 9.05268 10.7598 9.14645 10.8536C9.24021 10.9473 9.36739 11 9.5 11C9.63261 11 9.75979 10.9473 9.85355 10.8536C9.94732 10.7598 10 10.6326 10 10.5V6.5C10 6.36739 9.94732 6.24021 9.85355 6.14645C9.75979 6.05268 9.63261 6 9.5 6Z M6.5 1C5.6775 1 5 1.6775 5 2.5V3H2.5C2.36739 3 2.24021 3.05268 2.14645 3.14645C2.05268 3.24021 2 3.36739 2 3.5C2 3.63261 2.05268 3.75979 2.14645 3.85355C2.24021 3.94732 2.36739 4 2.5 4H3V13C3.00007 13.5463 3.45357 13.9999 3.99988 14H12C12.5464 14 13 13.5464 13 13V4H13.5C13.6326 4 13.7598 3.94732 13.8536 3.85355C13.9473 3.75979 14 3.63261 14 3.5C14 3.36739 13.9473 3.24021 13.8536 3.14645C13.7598 3.05268 13.6326 3 13.5 3H11V2.5C11 1.6775 10.3225 1 9.5 1H6.5ZM6.5 2H9.5C9.78214 2 10 2.21786 10 2.5V3H6V2.5C6 2.21786 6.21786 2 6.5 2ZM4 4H12V13H4V4Z" />
                      </svg>
                      <span className={styles.viewItemContextMenuDeleteText}>Delete view</span>
                    </li>
                  </ul>,
                  document.body
                );
              })()}

              </div>{/* end viewsSidebarInner */}
            </div>

            {/* Grid content area (future: actual grid rows/cells) */}
            <div className={styles.gridContainer}>
              {/* Grid content will go here */}
            </div>
          </div>
        </div>
    </div>

    {/* Clear Data Warning Modal */}
    {isClearDataModalOpen && (
      <div 
        className={styles.clearDataModalOverlay}
        onClick={handleCloseClearDataModal}
      >
        <div 
          className={styles.clearDataModal}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className={styles.clearDataModalTitle}>
            Are you sure you want to clear all data in {tables.find(t => t.id === activeTableId)?.name ?? 'this table'}?
          </h2>
          <p className={styles.clearDataModalDescription}>
            All records will be deleted from {tables.find(t => t.id === activeTableId)?.name ?? 'this table'} table.
          </p>
          <div className={styles.clearDataModalButtons}>
            <button
              type="button"
              className={styles.clearDataCancelButton}
              onClick={handleCloseClearDataModal}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.clearDataConfirmButton}
              onClick={handleClearData}
            >
              Clear data
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Delete Table Popup */}
    {isDeleteTablePopupOpen && deleteTablePopupPosition && (
      <div 
        ref={deleteTablePopupRef}
        className={styles.deleteTablePopup}
        style={{ 
          top: deleteTablePopupPosition.top, 
          left: deleteTablePopupPosition.left 
        }}
      >
        <p className={styles.deleteTablePopupTitle}>
          Are you sure you want to delete this table?
        </p>
        <p className={styles.deleteTablePopupDescription}>
          Recently deleted tables can be restored from trash.{' '}
          <svg className={styles.deleteTablePopupIcon} viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="nonzero" d="M8.07349 4.50134C7.75062 4.49155 7.43049 4.55078 7.13904 4.67151C6.36183 4.99344 5.75017 5.76895 5.75 6.74988C5.74997 6.88249 5.80262 7.00968 5.89636 7.10347C5.99011 7.19726 6.11727 7.24997 6.24988 7.25C6.31554 7.25002 6.38056 7.2371 6.44123 7.21199C6.5019 7.18687 6.55703 7.15006 6.60347 7.10364C6.64991 7.05722 6.68675 7.00211 6.71189 6.94145C6.73704 6.8808 6.74998 6.81578 6.75 6.75012C6.75013 6.17215 7.08092 5.77793 7.52173 5.59534C7.96254 5.41275 8.47515 5.45759 8.88391 5.86621C9.24251 6.22468 9.34907 6.75995 9.15503 7.22839C8.96099 7.69684 8.50716 8.00009 8.00012 8C7.93445 7.99999 7.86942 8.01292 7.80875 8.03804C7.74808 8.06316 7.69295 8.09999 7.6465 8.14642C7.60006 8.19285 7.56322 8.24797 7.53809 8.30864C7.51295 8.36931 7.50001 8.43433 7.5 8.5V9C7.5 9.13261 7.55268 9.25979 7.64645 9.35355C7.74021 9.44732 7.86739 9.5 8 9.5C8.13261 9.5 8.25979 9.44732 8.35355 9.35355C8.44732 9.25979 8.5 9.13261 8.5 9V8.93738C9.1999 8.77686 9.79665 8.2924 10.0789 7.61108C10.4266 6.77156 10.2336 5.80137 9.59094 5.15894C9.15735 4.7255 8.61159 4.51766 8.07349 4.50134Z M8 12C8.41419 12 8.75 11.6642 8.75 11.25C8.75 10.8358 8.41419 10.5 8 10.5C7.58581 10.5 7.25 10.8358 7.25 11.25C7.25 11.6642 7.58581 12 8 12Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
          </svg>
        </p>
        <div className={styles.deleteTablePopupButtons}>
          <button
            type="button"
            className={styles.deleteTableCancelButton}
            onClick={handleCloseDeleteTablePopup}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.deleteTableConfirmButton}
            onClick={handleDeleteTable}
          >
            Delete
          </button>
        </div>
      </div>
    )}
  </div>
  );
}

