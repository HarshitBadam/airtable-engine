import styles from "./TopBar.module.css";
import {
  IconBaseLogo,
  IconChevronDown,
  IconClockCounterClockwise,
  IconSidebarPlay,
} from "./GridIcons";
import { LinkIcon } from "~/components/home/Icons";
import { useSaveStatus } from "~/components/grid/hooks/useSaveStatus";
import { toast } from "sonner";

interface TopBarProps {
  baseName: string;
  baseColor: string;
  baseBorderColor: string;
  baseTextColor: string;
}

export function TopBar({ baseName, baseColor, baseBorderColor, baseTextColor }: TopBarProps) {
  const saveStatus = useSaveStatus();
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarInner}>
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

        <ul className={styles.topBarCenter} style={{ '--base-color': baseColor } as React.CSSProperties}>
          <li className={`${styles.topBarNavItem} ${styles.topBarNavItemActive}`}>Data</li>
          <li
            className={styles.topBarNavItem}
            onClick={() => toast("This feature is currently not available")}
          >
            Automations
          </li>
          <li
            className={styles.topBarNavItem}
            onClick={() => toast("This feature is currently not available")}
          >
            Interfaces
          </li>
          <li
            className={styles.topBarNavItem}
            onClick={() => toast("This feature is currently not available")}
          >
            Forms
          </li>
        </ul>

        <div className={styles.topBarRight}>
          {saveStatus !== "idle" && (
            <span className={styles.savingIndicator}>
              {saveStatus === "saving" && (
                <span className={styles.savingSpinnerWrapper}>
                  <svg
                    className={styles.savingSpinner}
                    width="10.8"
                    height="10.8"
                    viewBox="0 0 54 54"
                    aria-hidden="true"
                    style={{ shapeRendering: "geometricPrecision" }}
                  >
                    <g>
                      <path
                        d="M10.9,48.6c-1.6-1.3-2-3.6-0.7-5.3c1.3-1.6,3.6-2.1,5.3-0.8c0.8,0.5,1.5,1.1,2.4,1.5c7.5,4.1,16.8,2.7,22.8-3.4c1.5-1.5,3.8-1.5,5.3,0c1.4,1.5,1.4,3.9,0,5.3c-8.4,8.5-21.4,10.6-31.8,4.8C13,50.1,11.9,49.3,10.9,48.6z"
                        fill="currentColor"
                        fillOpacity="1"
                      />
                      <path
                        d="M53.6,31.4c-0.3,2.1-2.3,3.5-4.4,3.2c-2.1-0.3-3.4-2.3-3.1-4.4c0.2-1.1,0.2-2.2,0.2-3.3c0-8.7-5.7-16.2-13.7-18.5c-2-0.5-3.2-2.7-2.6-4.7s2.6-3.2,4.7-2.6C46,4.4,53.9,14.9,53.9,27C53.9,28.5,53.8,30,53.6,31.4z"
                        fill="currentColor"
                        fillOpacity="1"
                      />
                      <path
                        d="M16.7,1.9c1.9-0.8,4.1,0.2,4.8,2.2s-0.2,4.2-2.1,5c-7.2,2.9-12,10-12,18.1c0,1.6,0.2,3.2,0.6,4.7c0.5,2-0.7,4.1-2.7,4.6c-2,0.5-4-0.7-4.5-2.8C0.3,31.5,0,29.3,0,27.1C0,15.8,6.7,5.9,16.7,1.9z"
                        fill="currentColor"
                        fillOpacity="1"
                      />
                    </g>
                  </svg>
                </span>
              )}
              <span className={styles.savingText}>
                {saveStatus === "saving" ? "Saving\u2026" : "All changes saved"}
              </span>
            </span>
          )}

          <button
            aria-label="History"
            className={styles.topBarHistoryButton}
            onClick={() => toast("This feature is currently not available")}
          >
            <IconClockCounterClockwise className={styles.topBarHistoryIcon} />
          </button>

          <button
            aria-label="Copy link"
            className={styles.topBarLinkButton}
            onClick={() => toast("This feature is currently not available")}
          >
            <LinkIcon className={styles.topBarLinkIcon} size={16} />
          </button>
          <button
            className={styles.topBarLaunchButton}
            onClick={() => toast("This feature is currently not available")}
          >
            <IconSidebarPlay className={styles.topBarLaunchIcon} />
            <span className={styles.topBarLaunchText}>Launch</span>
          </button>
          <button 
            className={styles.topBarShareButton}
            style={{ backgroundColor: baseColor }}
            onClick={() => toast("This feature is currently not available")}
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
