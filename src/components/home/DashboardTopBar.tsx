"use client";

import Link from "next/link";
import styles from "~/components/home/HomeShell.module.css";
import {
  HamburgerIcon,
  SearchIcon,
  HelpIcon,
  BellIcon,
  AirtableLogoMark,
  AirtableWordmark,
} from "~/components/home/Icons";
import { AccountDropdown } from "~/components/home/AccountDropdown";

interface DashboardTopBarProps {
  sidebarExpanded: boolean;
  onToggleSidebar: () => void;
  userName: string;
  userEmail: string;
  userInitial: string;
  /** Reserved for future use — top bar may react to scroll position. */
  isScrolled?: boolean;
  /** Reserved for future use — base accent color when inside a base. */
  baseColor?: string;
}

export function DashboardTopBar({
  sidebarExpanded,
  onToggleSidebar,
  userName,
  userEmail,
  userInitial,
}: DashboardTopBarProps) {
  return (
    <header className={styles.topbar} role="banner">
      <nav className={styles.topbarNav} aria-label="Top bar">
        <div className={styles.topbarLeft}>
          <div className={styles.hamburgerWrapper}>
            <button
              type="button"
              className={styles.hamburgerButton}
              aria-label="Toggle sidebar"
              onClick={onToggleSidebar}
            >
              <HamburgerIcon size={20} />
            </button>
            <span className={styles.hamburgerTooltip} role="tooltip">
              {sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
            </span>
          </div>

          <Link href="/dashboard" aria-label="Airtable home" className={styles.brand}>
            <span className={styles.brandMark}>
              <AirtableLogoMark size={30} />
            </span>
            <span className={styles.brandWordmark}>
              <AirtableWordmark height={15} />
            </span>
          </Link>
        </div>

        <div className={styles.topbarCenter}>
          <button type="button" className={styles.searchPill} aria-label="Search">
            <span className={styles.searchIcon}>
              <SearchIcon size={16} />
            </span>
            <span className={styles.searchPlaceholder}>Search...</span>
            <span className={styles.searchKbd} aria-hidden="true">
              <span>⌘</span> <span>K</span>
            </span>
          </button>
        </div>

        <div className={styles.topbarRight}>
          <button type="button" className={styles.helpButton} aria-label="Help">
            <HelpIcon size={16} />
            <span className={styles.helpText}>Help</span>
          </button>

          <div className={styles.tooltipWrapper}>
            <button
              type="button"
              className={styles.bellButton}
              aria-label="Notifications"
            >
              <BellIcon size={17} />
            </button>
            <span className={styles.hoverTooltip} role="tooltip">
              Notifications
            </span>
          </div>

          <AccountDropdown
            userName={userName}
            userEmail={userEmail}
            userInitial={userInitial}
          />
        </div>
      </nav>
    </header>
  );
}
