"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import styles from "./Rail.module.css";
import { useClickOutside } from "~/hooks/useClickOutside";
import {
  AirtableLogoMonochrome,
  IconBackArrow,
  IconOmni,
  IconHelp,
  IconBell,
} from "./GridIcons";
import { AccountDropdownContent } from "~/components/home/AccountDropdownContent";
import type { AccountDropdownStyles } from "~/components/home/AccountDropdownContent";

const railStyles: AccountDropdownStyles = {
  header: styles.railAccountDropdownHeader!,
  headerName: styles.railAccountDropdownName!,
  headerEmail: styles.railAccountDropdownEmail!,
  item: styles.railAccountDropdownItem!,
  itemIcon: styles.railAccountDropdownItemIcon!,
  itemText: styles.railAccountDropdownItemText!,
  itemArrow: styles.railAccountDropdownItemArrow!,
  badgeBusiness: styles.railAccountDropdownBadgeBusiness!,
  badgeBusinessIcon: styles.railAccountDropdownBadgeBusinessIcon!,
  badgeBeta: styles.railAccountDropdownBadgeBeta!,
  divider: styles.railAccountDropdownDivider!,
  dividerAfterAppearance: styles.railAccountDropdownDividerAfterAppearance!,
};

export function Rail() {
  const router = useRouter();

  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  const { data: session } = useSession();
  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "user@example.com";
  const userInitial = userName.charAt(0).toUpperCase();

  const handleLogout = useCallback(() => {
    void signOut({ callbackUrl: "/" });
  }, []);

  useClickOutside(accountDropdownRef, isAccountDropdownOpen, useCallback(() => setIsAccountDropdownOpen(false), []));

  return (
    <nav className={styles.rail}>
      <div className={styles.railTop}>
        <button className={styles.railLogo} onClick={() => router.push("/dashboard")}>
          <AirtableLogoMonochrome className={styles.logoIcon} />
          <IconBackArrow className={styles.backArrowIcon} />
          <span className={styles.railTooltip}>Back to home</span>
        </button>
        <button className={styles.railSecondIcon} title="Omni">
          <IconOmni />
        </button>
      </div>

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
                <AccountDropdownContent
                  userName={userName}
                  userEmail={userEmail}
                  onLogout={handleLogout}
                  classNames={railStyles}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
