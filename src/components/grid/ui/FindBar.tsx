import React, { useState, useRef, useEffect, useCallback } from "react";
import styles from "./FindBar.module.css";

interface FindBarProps {
  onClose: () => void;
  /** Initial value for the search input (e.g. from the store's current search). */
  defaultValue?: string;
  /** Current match index (1-based). 0 when no matches or idle. */
  matchIndex?: number;
  /** Total number of matches. undefined when idle (no search performed yet). */
  totalMatches?: number;
  /** True while debounce or query is in-flight */
  isSearching?: boolean;
  /** Called when the search text changes */
  onSearchChange?: (value: string) => void;
  /** Navigate to previous match */
  onPrevMatch?: () => void;
  /** Navigate to next match */
  onNextMatch?: () => void;
}

export function FindBar({
  onClose,
  defaultValue = "",
  matchIndex = 0,
  totalMatches,
  isSearching = false,
  onSearchChange,
  onPrevMatch,
  onNextMatch,
}: FindBarProps) {
  const [searchValue, setSearchValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchValue(val);
      onSearchChange?.(val);
    },
    [onSearchChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        if (e.shiftKey) {
          onPrevMatch?.();
        } else {
          onNextMatch?.();
        }
      }
    },
    [onPrevMatch, onNextMatch],
  );

  const hasSearchText = searchValue.trim().length > 0;
  const hasResults = totalMatches !== undefined && totalMatches > 0;
  const showSpinner = hasSearchText && isSearching;
  const showNoResults = hasSearchText && !isSearching && totalMatches !== undefined && totalMatches === 0;
  const showResultNav = hasSearchText && hasResults;

  return (
    <div className={styles.findBar}>
      {/* Input — "Find in view..." */}
      <input
        ref={inputRef}
        className={styles.findInput}
        type="text"
        placeholder="Find in view..."
        value={searchValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
      />

      {showSpinner && (
        <div className={styles.findSpinner}>
          <svg width="13.5" height="13.5" viewBox="0 0 54 54" style={{ shapeRendering: "geometricPrecision" }} className={styles.findSpinnerSvg}>
            <g>
              <path d="M10.9,48.6c-1.6-1.3-2-3.6-0.7-5.3c1.3-1.6,3.6-2.1,5.3-0.8c0.8,0.5,1.5,1.1,2.4,1.5c7.5,4.1,16.8,2.7,22.8-3.4c1.5-1.5,3.8-1.5,5.3,0c1.4,1.5,1.4,3.9,0,5.3c-8.4,8.5-21.4,10.6-31.8,4.8C13,50.1,11.9,49.3,10.9,48.6z" fill="#616670" />
              <path d="M53.6,31.4c-0.3,2.1-2.3,3.5-4.4,3.2c-2.1-0.3-3.4-2.3-3.1-4.4c0.2-1.1,0.2-2.2,0.2-3.3c0-8.7-5.7-16.2-13.7-18.5c-2-0.5-3.2-2.7-2.6-4.7s2.6-3.2,4.7-2.6C46,4.4,53.9,14.9,53.9,27C53.9,28.5,53.8,30,53.6,31.4z" fill="#616670" />
              <path d="M16.7,1.9c1.9-0.8,4.1,0.2,4.8,2.2s-0.2,4.2-2.1,5c-7.2,2.9-12,10-12,18.1c0,1.6,0.2,3.2,0.6,4.7c0.5,2-0.7,4.1-2.7,4.6c-2,0.5-4-0.7-4.5-2.8C0.3,31.5,0,29.3,0,27.1C0,15.8,6.7,5.9,16.7,1.9z" fill="#616670" />
            </g>
          </svg>
        </div>
      )}

      {showNoResults && (
        <span className={styles.findNoResults}>No results</span>
      )}

      {showResultNav && (
        <span className={styles.findResultCount}>
          {matchIndex.toLocaleString()} of {(totalMatches ?? 0).toLocaleString()}
        </span>
      )}

      {/* Navigation arrows (prev/next) — only when results exist */}
      {showResultNav && (
        <div className={styles.findNavArrows}>
          <button
            type="button"
            className={styles.findNavButton}
            onClick={onPrevMatch}
            aria-label="Previous match"
          >
            <svg className={styles.findNavIcon} viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="nonzero" d="M12.3536 10.3536C12.1583 10.5488 11.8417 10.5488 11.6464 10.3536L8 6.70711L4.35355 10.3536C4.15829 10.5488 3.84171 10.5488 3.64645 10.3536C3.45118 10.1583 3.45118 9.84171 3.64645 9.64645L7.64645 5.64645C7.84171 5.45118 8.15829 5.45118 8.35355 5.64645L12.3536 9.64645C12.5488 9.84171 12.5488 10.1583 12.3536 10.3536Z" />
            </svg>
          </button>

          <button
            type="button"
            className={styles.findNavButton}
            onClick={onNextMatch}
            aria-label="Next match"
          >
            <svg className={styles.findNavIcon} viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
            </svg>
          </button>
        </div>
      )}

      <button
        type="button"
        className={styles.findOmniButton}
      >
        Ask Omni
      </button>

      <button
        type="button"
        className={styles.findCloseButton}
        onClick={onClose}
        aria-label="Close find bar"
      >
        <svg className={styles.findCloseIcon} viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="nonzero" d="M3.49999 3C3.36738 3.00002 3.24022 3.05271 3.14647 3.14648C3.05272 3.24025 3.00006 3.36741 3.00006 3.5C3.00006 3.63259 3.05272 3.75975 3.14647 3.85352L12.1465 12.8535C12.2402 12.9473 12.3674 12.9999 12.5 12.9999C12.6326 12.9999 12.7597 12.9473 12.8535 12.8535C12.9472 12.7598 12.9999 12.6326 12.9999 12.5C12.9999 12.3674 12.9472 12.2402 12.8535 12.1465L3.8535 3.14648C3.75975 3.05271 3.63259 3.00002 3.49999 3Z M12.5 3C12.3674 3.00002 12.2402 3.05271 12.1465 3.14648L3.14647 12.1465C3.05272 12.2402 3.00006 12.3674 3.00006 12.5C3.00006 12.6326 3.05272 12.7598 3.14647 12.8535C3.24023 12.9473 3.3674 12.9999 3.49999 12.9999C3.63258 12.9999 3.75974 12.9473 3.8535 12.8535L12.8535 3.85352C12.9472 3.75975 12.9999 3.63259 12.9999 3.5C12.9999 3.36741 12.9472 3.24025 12.8535 3.14648C12.7597 3.05271 12.6326 3.00002 12.5 3Z" />
        </svg>
      </button>
    </div>
  );
}
