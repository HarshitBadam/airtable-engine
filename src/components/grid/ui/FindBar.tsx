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
  onSearchChange,
  onPrevMatch,
  onNextMatch,
}: FindBarProps) {
  const [searchValue, setSearchValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when the find bar mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape key closes the find bar
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

  // Determine which state we're in
  const hasSearchText = searchValue.trim().length > 0;
  const hasResults = totalMatches !== undefined && totalMatches > 0;
  const showNoResults = hasSearchText && totalMatches !== undefined && totalMatches === 0;
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

      {/* No results text */}
      {showNoResults && (
        <span className={styles.findResultCount}>No results</span>
      )}

      {/* Result count "X of Y" */}
      {showResultNav && (
        <span className={styles.findResultCount}>
          {matchIndex.toLocaleString()} of {(totalMatches ?? 0).toLocaleString()}
        </span>
      )}

      {/* Navigation arrows (prev/next) — only when results exist */}
      {showResultNav && (
        <div className={styles.findNavArrows}>
          {/* Up chevron (previous match) */}
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

          {/* Down chevron (next match) */}
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

      {/* Ask Omni button */}
      <button
        type="button"
        className={styles.findOmniButton}
      >
        Ask Omni
      </button>

      {/* X close button */}
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
