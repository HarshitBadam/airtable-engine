"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./AccountDropdown.module.css";
import { signOut } from "next-auth/react";
import { AccountDropdownContent } from "./AccountDropdownContent";
import type { AccountDropdownStyles } from "./AccountDropdownContent";

const homeStyles: AccountDropdownStyles = {
  header: styles.accountDropdownHeader!,
  headerName: styles.accountDropdownName!,
  headerEmail: styles.accountDropdownEmail!,
  item: styles.accountDropdownItem!,
  itemIcon: styles.accountDropdownItemIcon!,
  itemText: styles.accountDropdownItemText!,
  itemArrow: styles.accountDropdownItemArrow!,
  badgeBusiness: styles.accountDropdownBadgeBusiness!,
  badgeBusinessIcon: styles.accountDropdownBadgeBusinessIcon!,
  badgeBeta: styles.accountDropdownBadgeBeta!,
  divider: styles.accountDropdownDivider!,
  dividerAfterAppearance: styles.accountDropdownDivider!,
};

interface AccountDropdownProps {
  userName: string;
  userEmail: string;
  userInitial: string;
}

export function AccountDropdown({ userName, userEmail, userInitial }: AccountDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleLogout = useCallback(() => {
    void signOut({ callbackUrl: "/" });
  }, []);

  return (
    <div className={styles.accountDropdownWrapper} ref={dropdownRef}>
      <button
        type="button"
        className={styles.avatar}
        aria-label="Account"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        {userInitial}
      </button>
      {!isOpen && <span className={styles.hoverTooltip} role="tooltip">Account</span>}

      {isOpen && (
        <div className={styles.accountDropdown}>
          <AccountDropdownContent
            userName={userName}
            userEmail={userEmail}
            onLogout={handleLogout}
            classNames={homeStyles}
          />
        </div>
      )}
    </div>
  );
}
