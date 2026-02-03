"use client";

/**
 * AccountDropdown component
 * Dropdown menu for account settings and actions
 */

import { useState, useRef, useEffect } from "react";
import styles from "./HomeShell.module.css";
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
} from "./Icons";
import { signOut } from "next-auth/react";

interface AccountDropdownProps {
  userName: string;
  userEmail: string;
  userInitial: string;
}

export function AccountDropdown({ userName, userEmail, userInitial }: AccountDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

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
          {/* Header with name and email */}
          <div className={styles.accountDropdownHeader}>
            <div>
              <p className={styles.accountDropdownName}>{userName}</p>
              <span className={styles.accountDropdownEmail}>{userEmail}</span>
            </div>
          </div>

          {/* Account */}
          <button type="button" className={styles.accountDropdownItem}>
            <span className={styles.accountDropdownItemIcon}>
              <UserIcon size={16} />
            </span>
            <span className={styles.accountDropdownItemText}>Account</span>
          </button>

          {/* Manage groups with Business badge */}
          <button type="button" className={styles.accountDropdownItem}>
            <span className={styles.accountDropdownItemIcon}>
              <UsersIcon size={16} />
            </span>
            <span className={styles.accountDropdownItemText}>Manage groups</span>
            <span className={styles.accountDropdownBadgeBusiness}>
              <span className={styles.accountDropdownBadgeBusinessIcon}>
                <AirtablePlusFillIcon size={12} color="rgb(15, 104, 162)" />
              </span>
              Business
            </span>
          </button>

          {/* Notification preferences with arrow */}
          <button type="button" className={styles.accountDropdownItem}>
            <span className={styles.accountDropdownItemIcon}>
              <BellIcon size={16} />
            </span>
            <span className={styles.accountDropdownItemText}>Notification preferences</span>
            <span className={styles.accountDropdownItemArrow}>
              <ChevronDownIcon size={16} />
            </span>
          </button>

          {/* Language preferences with arrow */}
          <button type="button" className={styles.accountDropdownItem}>
            <span className={styles.accountDropdownItemIcon}>
              <TranslateIcon size={16} />
            </span>
            <span className={styles.accountDropdownItemText}>Language preferences</span>
            <span className={styles.accountDropdownItemArrow}>
              <ChevronDownIcon size={16} />
            </span>
          </button>

          {/* Appearance with Beta badge and arrow */}
          <button type="button" className={styles.accountDropdownItem}>
            <span className={styles.accountDropdownItemIcon}>
              <PaletteIcon size={16} />
            </span>
            <span className={styles.accountDropdownItemText}>Appearance</span>
            <span className={styles.accountDropdownBadgeBeta}>Beta</span>
            <span className={styles.accountDropdownItemArrow}>
              <ChevronDownIcon size={16} />
            </span>
          </button>

          {/* Divider */}
          <div className={styles.accountDropdownDivider} />

          {/* Contact sales */}
          <button type="button" className={styles.accountDropdownItem}>
            <span className={styles.accountDropdownItemIcon}>
              <EnvelopeSimpleIcon size={16} />
            </span>
            <span className={styles.accountDropdownItemText}>Contact sales</span>
          </button>

          {/* Upgrade */}
          <button type="button" className={styles.accountDropdownItem}>
            <span className={styles.accountDropdownItemIcon}>
              <UpsellStarIcon size={16} />
            </span>
            <span className={styles.accountDropdownItemText}>Upgrade</span>
          </button>

          {/* Tell a friend */}
          <button type="button" className={styles.accountDropdownItem}>
            <span className={styles.accountDropdownItemIcon}>
              <EnvelopeSimpleIcon size={16} />
            </span>
            <span className={styles.accountDropdownItemText}>Tell a friend</span>
          </button>

          {/* Divider */}
          <div className={styles.accountDropdownDivider} />

          {/* Integrations */}
          <button type="button" className={styles.accountDropdownItem}>
            <span className={styles.accountDropdownItemIcon}>
              <LinkIcon size={16} />
            </span>
            <span className={styles.accountDropdownItemText}>Integrations</span>
          </button>

          {/* Builder hub */}
          <button type="button" className={styles.accountDropdownItem}>
            <span className={styles.accountDropdownItemIcon}>
              <WrenchIcon size={16} />
            </span>
            <span className={styles.accountDropdownItemText}>Builder hub</span>
          </button>

          {/* Divider */}
          <div className={styles.accountDropdownDivider} />

          {/* Trash */}
          <button type="button" className={styles.accountDropdownItem}>
            <span className={styles.accountDropdownItemIcon}>
              <TrashIcon size={16} />
            </span>
            <span className={styles.accountDropdownItemText}>Trash</span>
          </button>

          {/* Log out - functional */}
          <button type="button" className={styles.accountDropdownItem} onClick={handleLogout}>
            <span className={styles.accountDropdownItemIcon}>
              <SignOutIcon size={16} />
            </span>
            <span className={styles.accountDropdownItemText}>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
