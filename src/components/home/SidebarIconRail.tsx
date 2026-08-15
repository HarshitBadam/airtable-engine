"use client";

import styles from "./DashboardSidebar.module.css";
import {
  HomeIcon,
  StarIcon,
  ShareIcon,
  WorkspacesIcon,
  TemplatesIcon,
  MarketplaceIcon,
  GlobeIcon,
  PlusIcon,
} from "~/components/home/Icons";
import { toast } from "sonner";

interface SidebarIconRailProps {
  onCreateClick: () => void;
}

export function SidebarIconRail({ onCreateClick }: SidebarIconRailProps) {
  return (
    <aside className={styles.rail} aria-label="Primary navigation">
      <nav className={styles.railNav}>
        <button
          type="button"
          className={styles.railItem}
          aria-label="Home"
          aria-current="page"
        >
          <HomeIcon size={20} />
        </button>
        <button type="button" className={styles.railItem} aria-label="Starred">
          <StarIcon size={20} />
        </button>
        <button
          type="button"
          className={styles.railItem}
          aria-label="Shared"
          onClick={() => toast("This feature is currently not available")}
        >
          <ShareIcon size={20} />
        </button>
        <button
          type="button"
          className={styles.railItem}
          aria-label="Workspaces"
        >
          <WorkspacesIcon size={20} />
        </button>

        <div className={styles.railDivider} />
        <div className={styles.railSpacer} />

        <div className={styles.railFooter}>
          <div className={styles.railDivider} />
          <button
            type="button"
            className={styles.railFooterItem}
            aria-label="Templates and apps"
            onClick={() => toast("This feature is currently not available")}
          >
            <TemplatesIcon size={16} />
          </button>
          <button
            type="button"
            className={styles.railFooterItem}
            aria-label="Marketplace"
            onClick={() => toast("This feature is currently not available")}
          >
            <MarketplaceIcon size={16} />
          </button>
          <button
            type="button"
            className={styles.railFooterItem}
            aria-label="Import"
            onClick={() => toast("This feature is currently not available")}
          >
            <GlobeIcon size={16} />
          </button>
          <button
            type="button"
            className={styles.railCreatePartial}
            aria-label="Create"
            onClick={onCreateClick}
          >
            <PlusIcon size={18} />
          </button>
        </div>
      </nav>
    </aside>
  );
}
