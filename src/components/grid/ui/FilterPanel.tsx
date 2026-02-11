import React, { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./FilterPanel.module.css";
import { useGridStore, type FilterConditionUI } from "~/components/grid/grid-store";

/* ============================================================
   Types
   ============================================================ */

export interface FilterColumn {
  id: string;
  name: string;
  type: string; // "TEXT" | "NUMBER"
}

interface FilterPanelProps {
  /** Base color (hex) for the Omni icon tint — matches the base icon color. */
  baseColor?: string;
  /** Columns available for the field selector. */
  columns?: FilterColumn[];
}

/* ============================================================
   Operator helpers
   ============================================================ */

const TEXT_OPERATORS = [
  { value: "contains", label: "contains..." },
  { value: "not_contains", label: "does not contain..." },
  { value: "equals", label: "is..." },
  { value: "not_equals", label: "is not..." },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

const NUMBER_OPERATORS = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "≠" },
  { value: "lt", label: "<" },
  { value: "gt", label: ">" },
  { value: "lte", label: "≤" },
  { value: "gte", label: "≥" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

function getOperatorsForType(type: string) {
  return type === "NUMBER" ? NUMBER_OPERATORS : TEXT_OPERATORS;
}

function getDefaultOperator(type: string): string {
  return type === "NUMBER" ? "equals" : "contains";
}

function operatorLabel(op: string, type: string): string {
  const ops = getOperatorsForType(type);
  return ops.find((o) => o.value === op)?.label ?? op;
}

/* ============================================================
   SVG helpers
   ============================================================ */

/* Question-mark-in-circle SVG (16×16) */
function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ shapeRendering: "geometricPrecision" }}
    >
      <path
        fillRule="nonzero"
        d="M8.07349 4.50134C7.75062 4.49155 7.43049 4.55078 7.13904 4.67151C6.36183 4.99344 5.75017 5.76895 5.75 6.74988C5.74997 6.88249 5.80262 7.00968 5.89636 7.10347C5.99011 7.19726 6.11727 7.24997 6.24988 7.25C6.31554 7.25002 6.38056 7.2371 6.44123 7.21199C6.5019 7.18687 6.55703 7.15006 6.60347 7.10364C6.64991 7.05722 6.68675 7.00211 6.71189 6.94145C6.73704 6.8808 6.74998 6.81578 6.75 6.75012C6.75013 6.17215 7.08092 5.77793 7.52173 5.59534C7.96254 5.41275 8.47515 5.45759 8.88391 5.86621C9.24251 6.22468 9.34907 6.75995 9.15503 7.22839C8.96099 7.69684 8.50716 8.00009 8.00012 8C7.93445 7.99999 7.86942 8.01292 7.80875 8.03804C7.74808 8.06316 7.69295 8.09999 7.6465 8.14642C7.60006 8.19285 7.56322 8.24797 7.53809 8.30864C7.51295 8.36931 7.50001 8.43433 7.5 8.5V9C7.5 9.13261 7.55268 9.25979 7.64645 9.35355C7.74021 9.44732 7.86739 9.5 8 9.5C8.13261 9.5 8.25979 9.44732 8.35355 9.35355C8.44732 9.25979 8.5 9.13261 8.5 9V8.93738C9.1999 8.77686 9.79665 8.2924 10.0789 7.61108C10.4266 6.77156 10.2336 5.80137 9.59094 5.15894C9.15735 4.7255 8.61159 4.51766 8.07349 4.50134Z M8 12C8.41419 12 8.75 11.6642 8.75 11.25C8.75 10.8358 8.41419 10.5 8 10.5C7.58581 10.5 7.25 10.8358 7.25 11.25C7.25 11.6642 7.58581 12 8 12Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z"
      />
    </svg>
  );
}

/* Plus icon (12×12) */
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ shapeRendering: "geometricPrecision" }}
    >
      <path
        fillRule="nonzero"
        d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z"
      />
    </svg>
  );
}

/* Down chevron SVG (16×16) */
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ shapeRendering: "geometricPrecision" }}
    >
      <path
        fillRule="nonzero"
        d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z"
      />
    </svg>
  );
}

/* Trash SVG (16×16) */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ shapeRendering: "geometricPrecision" }}
    >
      <path
        fillRule="nonzero"
        d="M6.5 6C6.36739 6 6.24021 6.05268 6.14645 6.14645C6.05268 6.24021 6 6.36739 6 6.5V10.5C6 10.6326 6.05268 10.7598 6.14645 10.8536C6.24021 10.9473 6.36739 11 6.5 11C6.63261 11 6.75979 10.9473 6.85355 10.8536C6.94732 10.7598 7 10.6326 7 10.5V6.5C7 6.36739 6.94732 6.24021 6.85355 6.14645C6.75979 6.05268 6.63261 6 6.5 6Z M9.5 6C9.36739 6 9.24021 6.05268 9.14645 6.14645C9.05268 6.24021 9 6.36739 9 6.5V10.5C9 10.6326 9.05268 10.7598 9.14645 10.8536C9.24021 10.9473 9.36739 11 9.5 11C9.63261 11 9.75979 10.9473 9.85355 10.8536C9.94732 10.7598 10 10.6326 10 10.5V6.5C10 6.36739 9.94732 6.24021 9.85355 6.14645C9.75979 6.05268 9.63261 6 9.5 6Z M6.5 1C5.6775 1 5 1.6775 5 2.5V3H2.5C2.36739 3 2.24021 3.05268 2.14645 3.14645C2.05268 3.24021 2 3.36739 2 3.5C2 3.63261 2.05268 3.75979 2.14645 3.85355C2.24021 3.94732 2.36739 4 2.5 4H3V13C3.00007 13.5463 3.45357 13.9999 3.99988 14H12C12.5464 14 13 13.5464 13 13V4H13.5C13.6326 4 13.7598 3.94732 13.8536 3.85355C13.9473 3.75979 14 3.63261 14 3.5C14 3.36739 13.9473 3.24021 13.8536 3.14645C13.7598 3.05268 13.6326 3 13.5 3H11V2.5C10.9999 1.67757 10.3226 1.0001 9.50012 1H6.5ZM6.5 2H9.5C9.78202 2.0001 9.99996 2.21808 10 2.50012V3H6V2.5C6 2.21794 6.21794 2 6.5 2ZM4 4H12V13H4.00012L4 4Z"
      />
    </svg>
  );
}

/* DotsSixVertical SVG (16×16) — drag handle icon */
function DragIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ shapeRendering: "geometricPrecision" }}
    >
      <path
        fillRule="nonzero"
        d="M5.75 4.5C6.16419 4.5 6.5 4.16419 6.5 3.75C6.5 3.33581 6.16419 3 5.75 3C5.33581 3 5 3.33581 5 3.75C5 4.16419 5.33581 4.5 5.75 4.5Z M10.25 4.5C10.6642 4.5 11 4.16419 11 3.75C11 3.33581 10.6642 3 10.25 3C9.83581 3 9.5 3.33581 9.5 3.75C9.5 4.16419 9.83581 4.5 10.25 4.5Z M5.75 8.75C6.16419 8.75 6.5 8.41419 6.5 8C6.5 7.58581 6.16419 7.25 5.75 7.25C5.33581 7.25 5 7.58581 5 8C5 8.41419 5.33581 8.75 5.75 8.75Z M10.25 8.75C10.6642 8.75 11 8.41419 11 8C11 7.58581 10.6642 7.25 10.25 7.25C9.83581 7.25 9.5 7.58581 9.5 8C9.5 8.41419 9.83581 8.75 10.25 8.75Z M5.75 13C6.16419 13 6.5 12.6642 6.5 12.25C6.5 11.8358 6.16419 11.5 5.75 11.5C5.33581 11.5 5 11.8358 5 12.25C5 12.6642 5.33581 13 5.75 13Z M10.25 13C10.6642 13 11 12.6642 11 12.25C11 11.8358 10.6642 11.5 10.25 11.5C9.83581 11.5 9.5 11.8358 9.5 12.25C9.5 12.6642 9.83581 13 10.25 13Z"
      />
    </svg>
  );
}

/* Magnifying glass SVG (16×16) — search icon */
function MagnifyingGlassIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ shapeRendering: "geometricPrecision" }}
    >
      <path
        fillRule="nonzero"
        d="M6.5 1.5C3.73858 1.5 1.5 3.73858 1.5 6.5C1.5 9.26142 3.73858 11.5 6.5 11.5C7.63689 11.5 8.68651 11.1305 9.53608 10.5054L13.0154 13.9846C13.1112 14.0804 13.2418 14.1339 13.3778 14.1339C13.5139 14.1339 13.6444 14.0804 13.7402 13.9846C13.836 13.8889 13.8896 13.7583 13.8896 13.6222C13.8896 13.4862 13.836 13.3556 13.7402 13.2598L10.261 9.78063C10.8862 8.93106 11.2557 7.88144 11.2557 6.74455C11.2557 6.66362 11.2538 6.58312 11.25 6.50305C11.2499 6.50203 11.2499 6.50102 11.2499 6.5C11.2499 3.73859 9.01135 1.50001 6.24995 1.50001C6.16668 1.50001 6.08399 1.50221 6.00189 1.50657C6.00126 1.50004 6.00063 1.49351 6 1.48698V1.5L6.5 1.5ZM6.5 2.5C8.70914 2.5 10.5 4.29086 10.5 6.5C10.5 8.70914 8.70914 10.5 6.5 10.5C4.29086 10.5 2.5 8.70914 2.5 6.5C2.5 4.29086 4.29086 2.5 6.5 2.5Z"
      />
    </svg>
  );
}

/* Text type SVG icon (A) — 16×16 */
function TextTypeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
      <path
        fillRule="evenodd"
        d="M8.44187 3.26606C8.35522 3.10237 8.18518 3 7.99998 3C7.81477 3 7.64474 3.10237 7.55808 3.26606L3.05808 11.7661C2.92888 12.0101 3.02198 12.3127 3.26603 12.4419C3.51009 12.5711 3.81267 12.478 3.94187 12.2339L5.12455 10H10.8754L12.0581 12.2339C12.1873 12.478 12.4899 12.5711 12.7339 12.4419C12.978 12.3127 13.0711 12.0101 12.9419 11.7661L8.44187 3.26606ZM10.346 9L7.99998 4.56863L5.65396 9H10.346Z"
      />
    </svg>
  );
}

/* Number type SVG icon (#) — 16×16 */
function NumberTypeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style={{ shapeRendering: "geometricPrecision" }}>
      <path
        fillRule="nonzero"
        d="M6 2C5.86739 2 5.74021 2.05268 5.64645 2.14645C5.55268 2.24021 5.5 2.36739 5.5 2.5V5.5H2.5C2.36739 5.5 2.24021 5.55268 2.14645 5.64645C2.05268 5.74021 2 5.86739 2 6C2 6.13261 2.05268 6.25979 2.14645 6.35355C2.24021 6.44732 2.36739 6.5 2.5 6.5H5.5V9.5H2.5C2.36739 9.5 2.24021 9.55268 2.14645 9.64645C2.05268 9.74021 2 9.86739 2 10C2 10.1326 2.05268 10.2598 2.14645 10.3536C2.24021 10.4473 2.36739 10.5 2.5 10.5H5.5V13.5C5.5 13.6326 5.55268 13.7598 5.64645 13.8536C5.74021 13.9473 5.86739 14 6 14C6.13261 14 6.25979 13.9473 6.35355 13.8536C6.44732 13.7598 6.5 13.6326 6.5 13.5V10.5H9.5V13.5C9.5 13.6326 9.55268 13.7598 9.64645 13.8536C9.74021 13.9473 9.86739 14 10 14C10.1326 14 10.2598 13.9473 10.3536 13.8536C10.4473 13.7598 10.5 13.6326 10.5 13.5V10.5H13.5C13.6326 10.5 13.7598 10.4473 13.8536 10.3536C13.9473 10.2598 14 10.1326 14 10C14 9.86739 13.9473 9.74021 13.8536 9.64645C13.7598 9.55268 13.6326 9.5 13.5 9.5H10.5V6.5H13.5C13.6326 6.5 13.7598 6.44732 13.8536 6.35355C13.9473 6.25979 14 6.13261 14 6C14 5.86739 13.9473 5.74021 13.8536 5.64645C13.7598 5.55268 13.6326 5.5 13.5 5.5H10.5V2.5C10.5 2.36739 10.4473 2.24021 10.3536 2.14645C10.2598 2.05268 10.1326 2 10 2C9.86739 2 9.74021 2.05268 9.64645 2.14645C9.55268 2.24021 9.5 2.36739 9.5 2.5V5.5H6.5V2.5C6.5 2.36739 6.44732 2.24021 6.35355 2.14645C6.25979 2.05268 6.13261 2 6 2ZM6.5 6.5H9.5V9.5H6.5V6.5Z"
      />
    </svg>
  );
}

/**
 * Omni SVG icon (20×20) — same paths as the rail Omni icon.
 */
function OmniIcon({ className, color }: { className?: string; color?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 1974 2048"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ color: color ?? "rgb(22, 110, 225)" }}
    >
      <path transform="translate(1613,1514)" d="m0 0h18l10 4 21 16 9 6 13 10 12 11 13 13 9 13 6 14 4 18-1 13-5 10-8 11-7 10-12 16-9 11-21 21-10 7-10 5-15 4-16 2-14-6-10-6-16-10-10-8-12-11-17-17-9-11-6-9-6-12-1-4v-18l3-13 13-22 10-15 9-10 15-15 8-7 8-8 11-7 16-5z" fill="currentColor"/>
      <path transform="translate(963,1629)" d="m0 0h28l30 2 23 5 14 7 7 7 7 12 5 18 4 22 1 9v22l-1 3-2 33-5 13-6 10-11 12-11 7-11 4-14 2-18 1h-36l-22-2-13-3-12-6-10-9-6-7-6-12-3-14-3-24v-24l3-44 4-12 7-10 8-8 12-7 18-5z" fill="currentColor" opacity="0.5"/>
      <path transform="translate(713,1776)" d="m0 0h24l33 7 19 5 16 6 26 13 9 8 9 16 2 7v17l-5 27-5 19-4 15-9 25-6 15-9 8-19 10-11 5-8-1-11-3-28-6-11-1-9-4-30-10-15-9-8-8-7-12-5-17v-24l5-21 7-22 5-17 8-16 9-16 9-8 16-7z" fill="currentColor"/>
      <path transform="translate(347,1514)" d="m0 0h15l14 3 2-2h5l18 18 8 7 14 15 10 13 13 17 9 15 5 13 1 10-1 5 1 5-1 12-4 8-34 34-14 11-12 10-11 7-23 11-5 2h-12l-16-5-15-8-12-11-7-7-9-11-12-15-18-24-8-18-1-6 3-25 4-11 8-11 13-12 11-9 17-14 13-9 10-8 15-8z" fill="currentColor"/>
      <path transform="translate(539,261)" d="m0 0h15l18 8 10 7 10 10 26 39 7 11 9 17 6 18v17l-6 15-4 6-9 10-14 11-17 12-19 12-15 11-14 7-6 2h-12l-11-2-7-3-5 1h-7l-5-3-2-5-4-2-10-13-7-12-13-19-7-11-6-10-11-25-1-3v-13l2-6 2-12 7-12 11-12 9-8 15-11 18-11 19-10 6-4 16-5z" fill="currentColor"/>
      <path transform="translate(1654,882)" d="m0 0h20l14 5 11 7 6 7 6 12 6 18 8 38 3 20 1 22-3 16-8 16-7 8-5 4-12 6-21 7-26 5-23 3-20 1-16-2-13-5-13-11-9-14-6-14-5-19-5-30-2-18v-24l2-12 6-12 9-9 14-9 11-5 17-4 21-3z" fill="currentColor" opacity="0.5"/>
      <path transform="translate(1774,1095)" d="m0 0h21l47 5 18 2 13 4 10 4 9 7 9 10 9 14 3 16v13l-2 15-4 14v26l-8 28-6 10-10 11-8 6-15 9-14 1-8-3h-28l-4-2-11-2-8-2-10-1-11-3-4-2-15-2-8-7-9-11-9-17-3-11v-18l5-20v-23l5-22 5-14 7-13 5-6 13-10 12-5z" fill="currentColor"/>
      <path transform="translate(947,142)" d="m0 0h82l16 4 10 6 10 9 7 11 4 15 4 27 1 8v21l-2 5v34l-5 13-6 10-11 12-12 7-7 2h-20l-5 2-8 1h-35l-27-3-17-4-10-5-12-12-5-8-3-17-1-5-1-15-3-12 1-14 2-11v-33l4-14 7-11 11-11 11-7 9-3z" fill="currentColor"/>
      <path transform="translate(299,882)" d="m0 0h31l37 6 25 6 16 6 11 7 9 10 6 11 3 8 1 8v16l-6 55-4 17-5 13-7 11-9 8-17 9-9 3-6 1h-17l-27-3-29-5-17-4-14-7-10-9-10-14-5-11-1-5v-23l7-49 6-23 7-18 13-13 13-8z" fill="currentColor" opacity="0.5"/>
      <path transform="translate(188,1093)" d="m0 0 15 4 23 11 8 6 6 10 5 19 8 50 2 32-3 19-6 10-10 10-15 9-16 6-16 4-13 1-10-1-16 4-6 2h-19l-7-2h-8l-9-3-7-7-5-4-8-10-5-10-5-14-7-35-1-7-1-24-1-4v-16l4-12 10-19 8-7 14-7 16-4 24-4 24-3z" fill="currentColor"/>
      <path transform="translate(1244,1775)" d="m0 0h9l10 2 15 9 11 8 8 11 4 8 11 33 7 30 4 22 2 9-1 8-6 10-5 6-8 11-10 7-20 9-35 12-20 4-12 4h-17l-8-4-22-12-5-5-7-10-8-16-6-15-9-39-3-10v-9l-1-5v-8l5-13 9-19 8-9 10-6 10-4 39-9 20-6z" fill="currentColor"/>
      <path transform="translate(1755,622)" d="m0 0h19l13 4h7l6 3 9 8 7 10 12 22 9 21 13 41 1 5v18l-3 5-2 12-6 8-14 10-22 12-23 11-35 14-7 2h-15l-17-6-11-6-8-8-10-15-9-17-8-19-10-25-5-12-1-5v-14l4-14 2-12 9-10 10-8 15-9 24-11 23-7 12-4z" fill="currentColor"/>
      <path transform="translate(1137,345)" d="m0 0h16l17 4 41 12 19 7 16 8 10 7 7 8 7 14 1 3v20l-7 33-6 20-7 19-9 19-9 12-10 9-16 8-3 1h-11l-23-5-33-9-29-10-15-8-9-8-7-11-6-13-1-5v-14l5-25 10-35 7-20 7-14 9-12 8-7 11-5z" fill="currentColor" opacity="0.5"/>
      <path transform="translate(1334,1514)" d="m0 0h18l16 3 10 5 11 9 10 11 13 18 13 21 11 21 7 18 3 13-1 11-5 12-6 8-9 10-9 8-14 10-14 9-18 10-16 8-21 8-4 1h-7l-13-4-11-6-10-9-10-13-18-27-19-29-7-14-1-6v-9l3-19 5-12 6-8 15-12 17-12 26-17 20-13z" fill="currentColor" opacity="0.5"/>
      <path transform="translate(409,1238)" d="m0 0h13l13 5 11 8 10 10 10 15 11 21 11 28 9 28 2 13-2 11-7 12-11 12-10 8-20 12-25 12-25 9-21 6h-12l-16-8-10-7-8-8-8-13-15-32-11-28-7-21-1-5v-10l4-13 7-12 7-8 14-9 29-14 28-13 16-6z" fill="currentColor" opacity="0.5"/>
      <path transform="translate(834,344)" d="m0 0 10 1 8 5 10 9 8 8 8 13 7 15 11 33 7 30 1 5v19l-5 13-9 13-9 7-18 10-23 9-23 6-30 7h-16l-16-6-13-8-7-6-7-11-7-16-12-42-5-23-1-8v-10l2-11 9-16 8-10 11-7 20-9 24-8 45-10z" fill="currentColor" opacity="0.5"/>
      <path transform="translate(1469,537)" d="m0 0h8l24 4 10 5 13 11 19 19 7 8 11 13 11 15 9 16 4 9 1 4v9l-3 15-6 12-9 12-27 27-8 7-11 10-17 13-14 7-3 1h-9l-18-4-12-5-10-7-10-9-12-13-9-11-14-17-10-14-8-16-2-8v-20l3-12 5-10 8-10 11-9 14-12 12-11 14-11 13-10z" fill="currentColor" opacity="0.5"/>
      <path transform="translate(1431,261)" d="m0 0h14l16 8 9 6 9 8 14 8 13 8 14 12 10 9 7 11 6 13 2 8-1 13-5 11 3 1-3 8-12 16-8 16-13 16-7 11-3 7-6 9-15 10-12 3h-8l-4 1-9 1-19-10-23-11-17-10-11-9-14-12-11-10-7-10-4-12-1-11-1-3v-11l4-9 1-2h2l2-5 8-18 10-17 10-19 13-13 8-7 9-8 8-4 8-1h7z" fill="currentColor"/>
      <path transform="translate(204,621)" d="m0 0 14 1 19 5 25 12 29 14 17 9 6 5 7 11 5 10 2 9v17l-3 8-3 15-8 20-8 14-8 17-8 16-7 10-13 8-16 6h-15l-28-7-18-8-16-8-33-17-10-9-7-12-4-11-1-6v-11l3-16 5-15 9-20 21-42 9-12 14-8 12-4z" fill="currentColor"/>
      <path transform="translate(615,1513)" d="m0 0h8l15 4 24 11 20 11 21 14 13 10 10 9 6 10 7 18 2 8v7l-3 10-14 29-10 17-13 19-10 14-8 9-21 11-11 4h-10l-17-5-17-9-23-16-17-11-14-11-12-11-5-7-4-12-3-18v-10l4-11 8-15 12-17 19-28 14-15 7-7 11-7z" fill="currentColor" opacity="0.5"/>
      <path transform="translate(1561,1236)" d="m0 0 5 1 10 5 29 9 21 9 19 10 12 9 8 7 10 13 6 13 2 7v10l-5 21-8 20-8 17-10 19-12 23-5 6-32 12h-14l-17-5-38-18-18-8-13-9-10-8-8-10-7-15-3-12v-8l4-15 9-21 16-33 11-20 7-9 8-7 12-6 17-6z" fill="currentColor" opacity="0.5"/>
      <path transform="translate(482,537)" d="m0 0h9l15 4 16 8 10 7 10 8 16 13 14 12 10 10 9 12 8 16 2 7v13l-5 17-10 16-11 13-9 11-9 10-9 11-12 12-10 7-15 8-6 2h-12l-13-5-15-8-11-8-14-12-12-11-10-9-14-14-9-13-5-11-2-10v-9l4-16 6-14 10-13 19-19 7-8 12-13 12-11 15-9z" fill="currentColor" opacity="0.5"/>
    </svg>
  );
}

/* ============================================================
   COMPONENT
   ============================================================ */

type SubDropdown =
  | { kind: "conjunction"; conditionId: string }
  | { kind: "field"; conditionId: string }
  | { kind: "operator"; conditionId: string }
  | null;

export function FilterPanel({ baseColor, columns = [] }: FilterPanelProps) {
  const conditions = useGridStore((s) => s.filterConditions) ?? [];
  const setConditions = useGridStore((s) => s.setFilterConditions);
  const setFilters = useGridStore((s) => s.setFilters);
  const setFilterConjunction = useGridStore((s) => s.setFilterConjunction);

  /* ---- Sync UI conditions → backend filters ---- */
  /* Converts FilterConditionUI[] to the backend Filter[] format
     and updates the store's filters + conjunction whenever conditions change. */
  useEffect(() => {
    // Build a column type lookup (needed to skip invalid conditions)
    const colTypeMap = new Map(columns.map((c) => [c.id, c.type]));

    // Derive the global conjunction from the conditions (Airtable uses a single global mode).
    // Use the conjunction of the second condition (first after "Where"), default to "and".
    const conjunction: "and" | "or" =
      conditions.length >= 2 ? (conditions[1]?.conjunction ?? "and") : "and";

    // Convert UI conditions to backend filter objects, skipping incomplete/invalid ones
    const backendFilters: Array<
      | { columnId: string; op: "is_empty" | "is_not_empty" }
      | { columnId: string; op: "contains" | "not_contains" | "equals" | "not_equals"; value: string }
      | { columnId: string; op: "gt" | "lt" | "gte" | "lte"; value: number }
    > = [];

    for (const cond of conditions) {
      const colType = colTypeMap.get(cond.columnId);
      if (!colType) continue; // skip if column doesn't exist

      const op = cond.operator;

      // Valueless operators
      if (op === "is_empty" || op === "is_not_empty") {
        backendFilters.push({ columnId: cond.columnId, op });
        continue;
      }

      // Text operators that require a non-empty value
      if (op === "contains" || op === "not_contains" || op === "equals" || op === "not_equals") {
        if (cond.value.trim() === "") continue; // skip empty values
        backendFilters.push({ columnId: cond.columnId, op, value: cond.value });
        continue;
      }

      // Number operators
      if (op === "gt" || op === "lt" || op === "gte" || op === "lte") {
        const num = Number(cond.value);
        if (cond.value.trim() === "" || !Number.isFinite(num)) continue; // skip invalid
        backendFilters.push({ columnId: cond.columnId, op, value: num });
        continue;
      }
    }

    setFilters(backendFilters);
    setFilterConjunction(conjunction);
  }, [conditions, columns, setFilters, setFilterConjunction]);

  const [openDropdown, setOpenDropdown] = useState<SubDropdown>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [isSubSearchFocused, setIsSubSearchFocused] = useState(false);

  /* ---- drag-and-drop state ---- */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragItemRef = useRef<HTMLDivElement | null>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  const itemRectsRef = useRef<DOMRect[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);

  const hasConditions = conditions.length > 0;

  /* ---- refs for trigger elements ---- */
  const conjunctionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fieldDropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const operatorDropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  /* ---- helpers ---- */

  const getColumn = useCallback(
    (columnId: string) => columns.find((c) => c.id === columnId),
    [columns],
  );

  const getColumnName = useCallback(
    (columnId: string) => getColumn(columnId)?.name ?? "—",
    [getColumn],
  );

  const getColumnType = useCallback(
    (columnId: string) => getColumn(columnId)?.type ?? "TEXT",
    [getColumn],
  );

  /* ---- mutations ---- */

  const addCondition = useCallback(() => {
    const defaultCol = columns[0];
    const defaultOp = defaultCol ? getDefaultOperator(defaultCol.type) : "contains";
    setConditions([
      ...conditions,
      {
        id: crypto.randomUUID(),
        columnId: defaultCol?.id ?? "",
        operator: defaultOp,
        value: "",
        conjunction: "and",
      },
    ]);
  }, [columns, conditions, setConditions]);

  const removeCondition = useCallback((id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  }, [conditions, setConditions]);

  const updateValue = useCallback((id: string, value: string) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, value } : c)),
    );
  }, [conditions, setConditions]);

  const updateConjunction = useCallback((_id: string, conjunction: "and" | "or") => {
    // Airtable behavior: changing any conjunction changes ALL of them
    setConditions(
      conditions.map((c) => ({ ...c, conjunction })),
    );
    setOpenDropdown(null);
  }, [conditions, setConditions]);

  const updateField = useCallback((id: string, columnId: string, columnType: string) => {
    setConditions(
      conditions.map((c) =>
        c.id === id
          ? { ...c, columnId, operator: getDefaultOperator(columnType), value: "" }
          : c,
      ),
    );
    setOpenDropdown(null);
  }, [conditions, setConditions]);

  const updateOperator = useCallback((id: string, operator: string) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, operator } : c)),
    );
    setOpenDropdown(null);
  }, [conditions, setConditions]);

  /* ---- drag-and-drop reorder ---- */

  // Each filter row is 40px tall (32px content + 8px bottom padding)
  const ROW_HEIGHT = 40;

  const reorderConditions = useCallback((fromIdx: number, toIdx: number) => {
    const next = [...conditions];
    const [moved] = next.splice(fromIdx, 1);
    if (moved) next.splice(toIdx, 0, moved);
    setConditions(next);
  }, [conditions, setConditions]);

  const handleDragStart = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();

      // Close any open dropdown
      setOpenDropdown(null);

      // Capture all row rects at start
      if (rowsContainerRef.current) {
        const items = rowsContainerRef.current.querySelectorAll<HTMLDivElement>(
          "[data-filter-row]",
        );
        itemRectsRef.current = Array.from(items).map((el) =>
          el.getBoundingClientRect(),
        );
      }

      dragIndexRef.current = index;
      dragOverIndexRef.current = index;
      setDragIndex(index);
      setDragOverIndex(index);
      setDragPos({ x: e.clientX, y: e.clientY });

      const handleMouseMove = (ev: MouseEvent) => {
        setDragPos({ x: ev.clientX, y: ev.clientY });

        const rects = itemRectsRef.current;
        let newOver = index;
        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i]!;
          const midY = rect.top + rect.height / 2;
          if (ev.clientY > midY) {
            newOver = i;
          }
        }
        newOver = Math.max(0, Math.min(newOver, conditions.length - 1));
        dragOverIndexRef.current = newOver;
        setDragOverIndex(newOver);
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";

        const fromIdx = dragIndexRef.current;
        const toIdx = dragOverIndexRef.current;

        dragIndexRef.current = null;
        dragOverIndexRef.current = null;
        setDragIndex(null);
        setDragOverIndex(null);
        setDragPos(null);

        if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
          reorderConditions(fromIdx, toIdx);
        }
      };

      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [conditions.length, reorderConditions],
  );

  const getRowDragStyle = (index: number): React.CSSProperties | undefined => {
    if (dragIndex === null || dragOverIndex === null) return undefined;

    if (index === dragIndex) {
      // The dragged row's placeholder slides to the drop position
      const delta = dragOverIndex - dragIndex;
      return {
        transform: `translateY(${delta * ROW_HEIGHT}px)`,
        transition: "transform 0.15s ease",
      };
    }

    // Items between dragIndex and dragOverIndex shift to make room
    if (dragOverIndex > dragIndex) {
      // Dragging down: items between (dragIndex, dragOverIndex] shift up
      if (index > dragIndex && index <= dragOverIndex) {
        return {
          transform: `translateY(${-ROW_HEIGHT}px)`,
          transition: "transform 0.15s ease",
        };
      }
    } else if (dragOverIndex < dragIndex) {
      // Dragging up: items between [dragOverIndex, dragIndex) shift down
      if (index >= dragOverIndex && index < dragIndex) {
        return {
          transform: `translateY(${ROW_HEIGHT}px)`,
          transition: "transform 0.15s ease",
        };
      }
    }

    return undefined;
  };

  /* ---- dropdown open handlers ---- */

  const handleConjunctionClick = useCallback((conditionId: string) => {
    setOpenDropdown((prev) => {
      if (prev?.kind === "conjunction" && prev.conditionId === conditionId) return null;
      const el = conjunctionRefs.current.get(conditionId);
      const rect = el?.getBoundingClientRect();
      if (rect) setDropdownPos({ top: rect.bottom, left: rect.left });
      return { kind: "conjunction", conditionId };
    });
  }, []);

  const handleFieldClick = useCallback((conditionId: string) => {
    setOpenDropdown((prev) => {
      if (prev?.kind === "field" && prev.conditionId === conditionId) return null;
      const el = fieldDropdownRefs.current.get(conditionId);
      const rect = el?.getBoundingClientRect();
      if (rect) setDropdownPos({ top: rect.bottom, left: rect.left });
      setSubSearchQuery("");
      setIsSubSearchFocused(false);
      return { kind: "field", conditionId };
    });
  }, []);

  const handleOperatorClick = useCallback((conditionId: string) => {
    setOpenDropdown((prev) => {
      if (prev?.kind === "operator" && prev.conditionId === conditionId) return null;
      const el = operatorDropdownRefs.current.get(conditionId);
      const rect = el?.getBoundingClientRect();
      if (rect) setDropdownPos({ top: rect.bottom, left: rect.left });
      setSubSearchQuery("");
      setIsSubSearchFocused(false);
      return { kind: "operator", conditionId };
    });
  }, []);

  /* ---- click-outside to close ---- */
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-filter-subdropdown]")) return;
      // Check trigger refs
      for (const el of conjunctionRefs.current.values()) {
        if (el.contains(target)) return;
      }
      for (const el of fieldDropdownRefs.current.values()) {
        if (el.contains(target)) return;
      }
      for (const el of operatorDropdownRefs.current.values()) {
        if (el.contains(target)) return;
      }
      setOpenDropdown(null);
    };
    const tid = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => {
      clearTimeout(tid);
      document.removeEventListener("mousedown", handler);
    };
  }, [openDropdown]);

  /* ---- escape key closes dropdown ---- */
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpenDropdown(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openDropdown]);

  /* ---- filtered data for open dropdown ---- */
  const filteredColumns = columns.filter((col) =>
    col.name.toLowerCase().includes(subSearchQuery.toLowerCase()),
  );

  const activeConditionForDropdown = openDropdown
    ? conditions.find((c) => c.id === openDropdown.conditionId)
    : null;

  const filteredOperators = activeConditionForDropdown
    ? getOperatorsForType(getColumnType(activeConditionForDropdown.columnId)).filter((op) =>
        op.label.toLowerCase().includes(subSearchQuery.toLowerCase()),
      )
    : [];

  /* ---- panel class ---- */
  const panelCls = [styles.filterPanel, hasConditions ? styles.filterPanelActive : ""]
    .filter(Boolean)
    .join(" ");

  /* ============================================================
     RENDER — empty state (no conditions)
     ============================================================ */
  if (!hasConditions) {
    return (
      <div className={panelCls}>
        {/* 1. Header */}
        <div className={styles.filterHeader}>
          <span>Filter</span>
        </div>

        {/* 2. AI Describe Row */}
        <div className={styles.filterDescribeRow}>
          <div className={styles.filterDescribeInner}>
            <OmniIcon className={styles.filterDescribeIcon} color={baseColor} />
            <input
              className={styles.filterDescribeInput}
              type="text"
              placeholder="Describe what you want to see"
              readOnly
              tabIndex={-1}
            />
          </div>
        </div>

        {/* 3. Empty state */}
        <div className={styles.filterEmptyRow}>
          <span className={styles.filterEmptyText}>No filter conditions are applied</span>
          <QuestionIcon className={styles.filterQuestionIcon} />
        </div>

        {/* 4. Bottom action bar */}
        <div className={styles.filterActions}>
          <div className={styles.filterAddCondition} onClick={addCondition}>
            <PlusIcon className={styles.filterAddIcon} />
            <span>Add condition</span>
          </div>
          <div className={styles.filterConditionGroupWrapper}>
            <div className={styles.filterAddConditionGroup}>
              <PlusIcon className={styles.filterAddIcon} />
              <span>Add condition group</span>
            </div>
            <QuestionIcon className={styles.filterConditionGroupQuestion} />
          </div>
          <span className={styles.filterCopyFromView}>Copy from another view</span>
        </div>
      </div>
    );
  }

  /* ============================================================
     RENDER — active state (≥ 1 condition)
     ============================================================ */
  return (
    <div className={panelCls}>
      {/* 1. Header */}
      <div className={styles.filterHeader}>
        <span>Filter</span>
      </div>

      {/* 2. AI Describe Row */}
      <div className={styles.filterDescribeRow}>
        <div className={styles.filterDescribeInner}>
          <OmniIcon className={styles.filterDescribeIcon} color={baseColor} />
          <input
            className={styles.filterDescribeInput}
            type="text"
            placeholder="Describe what you want to see"
            readOnly
            tabIndex={-1}
          />
        </div>
      </div>

      {/* 3. "In this view, show records" */}
      <div className={styles.filterShowRecords}>In this view, show records</div>

      {/* 4. Filter rows */}
      <div ref={rowsContainerRef} className={styles.filterRowsContainer}>
        {conditions.map((cond, idx) => (
          <div
            key={cond.id}
            data-filter-row
            className={
              dragIndex === idx ? styles.filterRowPlaceholder : styles.filterRow
            }
            style={getRowDragStyle(idx)}
          >
            {/* ---- LEFT: "Where" or conjunction ---- */}
            <div className={styles.filterRowLeft}>
              {idx === 0 ? (
                <div className={styles.filterRowWhereText}>Where</div>
              ) : (
                <div
                  ref={(el) => {
                    if (el) conjunctionRefs.current.set(cond.id, el);
                    else conjunctionRefs.current.delete(cond.id);
                  }}
                  className={styles.filterRowConjunction}
                  onClick={dragIndex !== null ? undefined : () => handleConjunctionClick(cond.id)}
                >
                  <span className={styles.filterRowConjunctionText}>
                    {cond.conjunction}
                  </span>
                  <ChevronDownIcon className={styles.filterRowConjunctionChevron} />
                </div>
              )}
            </div>

            {/* ---- RIGHT: field + operator + value + trash + drag ---- */}
            <div className={styles.filterRowRight}>
              {/* 1) Field selector */}
              <div
                ref={(el) => {
                  if (el) fieldDropdownRefs.current.set(cond.id, el);
                  else fieldDropdownRefs.current.delete(cond.id);
                }}
                className={styles.filterRowDropdown}
                onClick={dragIndex !== null ? undefined : () => handleFieldClick(cond.id)}
              >
                <span className={styles.filterRowDropdownText}>
                  {getColumnName(cond.columnId)}
                </span>
                <ChevronDownIcon className={styles.filterRowDropdownChevron} />
              </div>

              {/* 2) Operator selector */}
              <div
                ref={(el) => {
                  if (el) operatorDropdownRefs.current.set(cond.id, el);
                  else operatorDropdownRefs.current.delete(cond.id);
                }}
                className={styles.filterRowOperatorDropdown}
                onClick={dragIndex !== null ? undefined : () => handleOperatorClick(cond.id)}
              >
                <span className={styles.filterRowDropdownText}>
                  {operatorLabel(cond.operator, getColumnType(cond.columnId))}
                </span>
                <ChevronDownIcon className={styles.filterRowDropdownChevron} />
              </div>

              {/* 3) Value input */}
              <input
                className={styles.filterRowValueInput}
                type="text"
                placeholder="Enter a value"
                value={cond.value}
                onChange={(e) => updateValue(cond.id, e.target.value)}
                readOnly={dragIndex !== null}
              />

              {/* 4) Trash button */}
              <div
                className={styles.filterRowTrashButton}
                onClick={dragIndex !== null ? undefined : () => removeCondition(cond.id)}
              >
                <TrashIcon className={styles.filterRowTrashIcon} />
              </div>

              {/* 5) Drag handle */}
              <div
                className={styles.filterRowDragHandle}
                onMouseDown={(e) => handleDragStart(e, idx)}
              >
                <DragIcon className={styles.filterRowDragIcon} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Drag overlay — floating copy of the dragged row */}
      {dragIndex !== null && dragPos && conditions[dragIndex] &&
        createPortal(
          <div
            ref={dragItemRef}
            className={styles.filterRowDragging}
            style={{
              left: itemRectsRef.current[dragIndex]?.left ?? 0,
              top: dragPos.y - (ROW_HEIGHT / 2),
              width: itemRectsRef.current[dragIndex]?.width ?? 558,
            }}
          >
            {/* Render the dragged row content */}
            {(() => {
              const cond = conditions[dragIndex]!;
              const idx = dragIndex;
              return (
                <>
                  <div className={styles.filterRowLeft}>
                    {idx === 0 ? (
                      <div className={styles.filterRowWhereText}>Where</div>
                    ) : (
                      <div className={styles.filterRowConjunction} style={{ pointerEvents: "none" }}>
                        <span className={styles.filterRowConjunctionText}>
                          {cond.conjunction}
                        </span>
                        <ChevronDownIcon className={styles.filterRowConjunctionChevron} />
                      </div>
                    )}
                  </div>
                  <div className={styles.filterRowRight}>
                    <div className={styles.filterRowDropdown} style={{ pointerEvents: "none" }}>
                      <span className={styles.filterRowDropdownText}>
                        {getColumnName(cond.columnId)}
                      </span>
                      <ChevronDownIcon className={styles.filterRowDropdownChevron} />
                    </div>
                    <div className={styles.filterRowOperatorDropdown} style={{ pointerEvents: "none" }}>
                      <span className={styles.filterRowDropdownText}>
                        {operatorLabel(cond.operator, getColumnType(cond.columnId))}
                      </span>
                      <ChevronDownIcon className={styles.filterRowDropdownChevron} />
                    </div>
                    <input
                      className={styles.filterRowValueInput}
                      type="text"
                      placeholder="Enter a value"
                      value={cond.value}
                      readOnly
                      tabIndex={-1}
                    />
                    <div className={styles.filterRowTrashButton} style={{ pointerEvents: "none" }}>
                      <TrashIcon className={styles.filterRowTrashIcon} />
                    </div>
                    <div className={styles.filterRowDragHandle} style={{ cursor: "grabbing" }}>
                      <DragIcon className={styles.filterRowDragIcon} />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>,
          document.body,
        )}

      {/* 5. Bottom action bar */}
      <div className={styles.filterActions}>
        <div className={styles.filterAddCondition} onClick={addCondition}>
          <PlusIcon className={styles.filterAddIcon} />
          <span>Add condition</span>
        </div>
        <div className={styles.filterConditionGroupWrapper}>
          <div className={styles.filterAddConditionGroup}>
            <PlusIcon className={styles.filterAddIcon} />
            <span>Add condition group</span>
          </div>
          <QuestionIcon className={styles.filterConditionGroupQuestion} />
        </div>
        <span className={styles.filterCopyFromView}>Copy from another view</span>
      </div>

      {/* ============================================================
         PORTAL: Conjunction dropdown (and / or)
         ============================================================ */}
      {openDropdown?.kind === "conjunction" &&
        createPortal(
          <div
            data-filter-subdropdown
            className={`${styles.filterSubDropdown} ${styles.filterConjunctionDropdown}`}
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              zIndex: 10004,
            }}
          >
            <div
              className={styles.filterConjunctionItem}
              onClick={() => updateConjunction(openDropdown.conditionId, "and")}
            >
              and
            </div>
            <div
              className={styles.filterConjunctionItem}
              onClick={() => updateConjunction(openDropdown.conditionId, "or")}
            >
              or
            </div>
          </div>,
          document.body,
        )}

      {/* ============================================================
         PORTAL: Field dropdown (Find a field)
         ============================================================ */}
      {openDropdown?.kind === "field" &&
        createPortal(
          <div
            data-filter-subdropdown
            className={`${styles.filterSubDropdown} ${styles.filterFieldDropdown}`}
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              zIndex: 10004,
            }}
          >
            {/* Search bar */}
            <div
              className={`${styles.filterSubSearchContainer}${isSubSearchFocused ? ` ${styles.filterSubSearchContainerFocused}` : ""}`}
            >
              <MagnifyingGlassIcon className={styles.filterSearchIcon} />
              <input
                className={styles.filterSubSearchInput}
                type="text"
                placeholder="Find a field"
                value={subSearchQuery}
                onChange={(e) => setSubSearchQuery(e.target.value)}
                onFocus={() => setIsSubSearchFocused(true)}
                onBlur={() => setIsSubSearchFocused(false)}
                autoFocus
              />
            </div>

            {/* Scrollable field list */}
            <div className={styles.filterSubItemList}>
              {filteredColumns.map((col) => (
                <div
                  key={col.id}
                  className={styles.filterFieldItem}
                  onClick={() => updateField(openDropdown.conditionId, col.id, col.type)}
                >
                  <span className={styles.filterFieldTypeIcon}>
                    {col.type === "NUMBER" ? <NumberTypeIcon /> : <TextTypeIcon />}
                  </span>
                  <span className={styles.filterFieldName}>{col.name}</span>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}

      {/* ============================================================
         PORTAL: Operator dropdown (Find an operator)
         ============================================================ */}
      {openDropdown?.kind === "operator" && activeConditionForDropdown &&
        createPortal(
          <div
            data-filter-subdropdown
            className={`${styles.filterSubDropdown} ${styles.filterOperatorDropdown}`}
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              zIndex: 10004,
            }}
          >
            {/* Search bar */}
            <div
              className={`${styles.filterSubSearchContainer}${isSubSearchFocused ? ` ${styles.filterSubSearchContainerFocused}` : ""}`}
            >
              <MagnifyingGlassIcon className={styles.filterSearchIcon} />
              <input
                className={styles.filterSubSearchInput}
                type="text"
                placeholder="Find an operator"
                value={subSearchQuery}
                onChange={(e) => setSubSearchQuery(e.target.value)}
                onFocus={() => setIsSubSearchFocused(true)}
                onBlur={() => setIsSubSearchFocused(false)}
                autoFocus
              />
            </div>

            {/* Scrollable operator list */}
            <div className={styles.filterSubItemList}>
              {filteredOperators.map((op) => (
                <div
                  key={op.value}
                  className={styles.filterOperatorItem}
                  onClick={() => updateOperator(openDropdown.conditionId, op.value)}
                >
                  {op.label}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
