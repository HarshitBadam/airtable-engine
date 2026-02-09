import styles from "./TopBar.module.css";
import {
  IconBaseLogo,
  IconChevronDown,
  IconClockCounterClockwise,
  IconSidebarPlay,
} from "./icons";

interface TopBarProps {
  baseName: string;
  baseColor: string;
  baseBorderColor: string;
  baseTextColor: string;
}

export function TopBar({ baseName, baseColor, baseBorderColor, baseTextColor }: TopBarProps) {
  return (
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
              <IconBaseLogo className={styles.baseIconSvg} style={{ color: baseTextColor }} />
            </div>
            <span className={styles.baseName}>{baseName}</span>
            <IconChevronDown className={styles.baseDropdownIcon} />
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
            <IconClockCounterClockwise className={styles.topBarHistoryIcon} />
          </button>
          <button className={styles.topBarLaunchButton}>
            <IconSidebarPlay className={styles.topBarLaunchIcon} />
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
  );
}
