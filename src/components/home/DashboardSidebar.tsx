"use client";

import Link from "next/link";
import styles from "./DashboardSidebar.module.css";
import {
  HomeIcon,
  ShareIcon,
  WorkspacesIcon,
  TemplatesIcon,
  MarketplaceIcon,
  ImportIcon,
  PlusIcon,
  ChevronDownIcon,
} from "~/components/home/Icons";
import { SidebarIconRail } from "./SidebarIconRail";
import { SidebarStarredList } from "./SidebarStarredList";
import { SidebarDragPreview } from "./SidebarDragPreview";
import type { DragState } from "~/hooks/useStarredDragDrop";
import type React from "react";
import { toast } from "sonner";

type StarredBase = { id: string; name: string };

interface DashboardSidebarProps {
  sidebarExpanded: boolean;
  starredExpanded: boolean;
  setStarredExpanded: (v: boolean) => void;
  workspacesExpanded: boolean;
  setWorkspacesExpanded: (v: boolean) => void;
  orderedStarredBases: StarredBase[];
  dragState: DragState;
  dragRef: React.RefObject<DragState>;
  startStarredDrag: (e: React.PointerEvent, index: number) => void;
  getStarredItemStyle: (index: number) => React.CSSProperties;
  getFloatingStyle: () => React.CSSProperties;
  actions: {
    recordOpen: (id: string) => void;
    toggleStar: (id: string) => void;
  };
  bases: Array<{ id: string }>;
  onCreateClick: () => void;
}

export function DashboardSidebar({
  sidebarExpanded,
  starredExpanded,
  setStarredExpanded,
  workspacesExpanded,
  orderedStarredBases,
  dragState,
  dragRef,
  startStarredDrag,
  getStarredItemStyle,
  getFloatingStyle,
  actions,
  bases,
  onCreateClick,
}: DashboardSidebarProps) {
  return (
    <>
      <div
        className={`${styles.sidebarContainer} ${sidebarExpanded ? styles.sidebarContainerExpanded : ""}`}
      >
        <SidebarIconRail onCreateClick={onCreateClick} />

        <aside
          className={`${styles.sidebar} ${sidebarExpanded ? styles.sidebarExpanded : ""} ${dragState ? styles.sidebarDragActive : ""}`}
          aria-label="Sidebar"
        >
          <nav className={styles.sidebarNav} aria-label="Homescreen navigation">
            <div
              className={`${styles.sidebarNavTop} ${!starredExpanded ? styles.starredCollapsed : ""}`}
            >
              <Link
                href="/dashboard"
                className={`${styles.navItem} ${styles.navItemActive}`}
              >
                <span className={styles.navIcon}>
                  <HomeIcon size={20} />
                </span>
                <span className={styles.navLabel}>Home</span>
              </Link>

              <SidebarStarredList
                starredExpanded={starredExpanded}
                setStarredExpanded={setStarredExpanded}
                bases={bases}
                orderedStarredBases={orderedStarredBases}
                dragState={dragState}
                dragRef={dragRef}
                startStarredDrag={startStarredDrag}
                getStarredItemStyle={getStarredItemStyle}
                actions={actions}
              />

              <button
                type="button"
                className={styles.navItem}
                onClick={() => toast("This feature is currently not available")}
              >
                <span className={styles.navIcon}>
                  <ShareIcon size={20} />
                </span>
                <span className={styles.navLabel}>Shared</span>
              </button>

              <div className={styles.navRow}>
                <button
                  type="button"
                  className={styles.navItem}
                  onClick={() =>
                    toast("This feature is currently not available")
                  }
                >
                  <span
                    className={`${styles.navIcon} ${styles.navIconWorkspaces}`}
                  >
                    <WorkspacesIcon size={20} />
                  </span>
                  <span className={styles.navLabel}>Workspaces</span>
                </button>
                <button
                  type="button"
                  className={styles.addButton}
                  aria-label="Create a workspace"
                  onClick={() =>
                    toast("This feature is currently not available")
                  }
                >
                  <PlusIcon size={16} />
                </button>
                <button
                  type="button"
                  className={`${styles.disclosureButton} ${workspacesExpanded ? styles.disclosureExpanded : styles.disclosureCollapsed}`}
                  aria-label="Workspaces"
                  aria-expanded={workspacesExpanded}
                  onClick={() =>
                    toast("This feature is currently not available")
                  }
                >
                  <ChevronDownIcon size={20} />
                </button>
              </div>
            </div>

            <div className={styles.sidebarBottom}>
              <div className={styles.bottomLinksWrap}>
                <button
                  type="button"
                  className={styles.bottomLink}
                  onClick={() =>
                    toast("This feature is currently not available")
                  }
                >
                  <span className={styles.bottomLinkIcon}>
                    <TemplatesIcon size={16} />
                  </span>
                  <span className={styles.bottomLinkText}>
                    Templates and apps
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.bottomLink}
                  onClick={() =>
                    toast("This feature is currently not available")
                  }
                >
                  <span className={styles.bottomLinkIcon}>
                    <MarketplaceIcon size={16} />
                  </span>
                  <span className={styles.bottomLinkText}>Marketplace</span>
                </button>

                <button
                  type="button"
                  className={styles.bottomLink}
                  onClick={() =>
                    toast("This feature is currently not available")
                  }
                >
                  <span className={styles.bottomLinkIcon}>
                    <ImportIcon size={16} />
                  </span>
                  <span className={styles.bottomLinkText}>Import</span>
                </button>
              </div>

              <button
                type="button"
                className={styles.createButton}
                onClick={onCreateClick}
              >
                <span className={styles.createButtonIcon}>
                  <PlusIcon size={14} />
                </span>
                <span className={styles.createButtonText}>Create</span>
              </button>
            </div>
          </nav>
        </aside>
      </div>

      <SidebarDragPreview
        dragState={dragState}
        orderedStarredBases={orderedStarredBases}
        getFloatingStyle={getFloatingStyle}
      />
    </>
  );
}
