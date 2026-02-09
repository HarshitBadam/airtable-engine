"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";
import styles from "./Rail.module.css";
import {
  AirtableLogoMonochrome,
  IconBackArrow,
  IconOmni,
  IconHelp,
  IconBell,
} from "./icons";
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

export function Rail() {
  // Account dropdown state (co-located)
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  // Get user session
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "user@example.com";
  const userInitial = userName.charAt(0).toUpperCase();

  // Handle logout
  const handleLogout = useCallback(() => {
    void signOut({ callbackUrl: "/" });
  }, []);

  // Click-outside to close account dropdown
  useEffect(() => {
    if (!isAccountDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isAccountDropdownOpen]);

  return (
    <nav className={styles.rail}>
      {/* Rail Top - Logo and second icon */}
      <div className={styles.railTop}>
        <button className={styles.railLogo}>
          <AirtableLogoMonochrome className={styles.logoIcon} />
          <IconBackArrow className={styles.backArrowIcon} />
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
  );
}
