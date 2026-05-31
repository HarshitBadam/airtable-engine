"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import styles from "~/components/home/HomeShell.module.css";
import basesStyles from "~/components/bases/bases.module.css";
import {
  HomeIcon,
  StarIcon,
  ShareIcon,
  WorkspacesIcon,
  TemplatesIcon,
  MarketplaceIcon,
  ImportIcon,
  GlobeIcon,
  PlusIcon,
  ChevronDownIcon,
  StarOutlineIcon,
  StarFilledIcon,
  DotsSixVerticalIcon,
} from "~/components/home/Icons";
import { getBaseColor, getBaseTextColor, getBaseInitials } from "~/components/bases";
import type { DragState } from "~/hooks/useStarredDragDrop";
import type React from "react";

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
  /** Raw starred bases from the server (used for empty-state check). */
  bases: Array<{ id: string }>;
  onCreateClick: () => void;
}

export function DashboardSidebar({
  sidebarExpanded,
  starredExpanded,
  setStarredExpanded,
  workspacesExpanded,
  setWorkspacesExpanded,
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
            <button type="button" className={styles.railItem} aria-label="Shared">
              <ShareIcon size={20} />
            </button>
            <button type="button" className={styles.railItem} aria-label="Workspaces">
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
              >
                <TemplatesIcon size={16} />
              </button>
              <button
                type="button"
                className={styles.railFooterItem}
                aria-label="Marketplace"
              >
                <MarketplaceIcon size={16} />
              </button>
              <button
                type="button"
                className={styles.railFooterItem}
                aria-label="Import"
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

              <div className={styles.navRow}>
                <button type="button" className={styles.navItem}>
                  <span className={styles.navIcon}>
                    <StarIcon size={20} />
                  </span>
                  <span className={styles.navLabel}>Starred</span>
                </button>
                <button
                  type="button"
                  className={`${styles.disclosureButton} ${starredExpanded ? styles.disclosureExpanded : styles.disclosureCollapsed}`}
                  aria-label={starredExpanded ? "Collapse starred" : "Expand starred"}
                  aria-expanded={starredExpanded}
                  onClick={() => setStarredExpanded(!starredExpanded)}
                >
                  <ChevronDownIcon size={20} />
                </button>
              </div>

              {starredExpanded && (
                <section className={styles.navSection} aria-label="Starred items">
                  {bases.length === 0 ? (
                    <div className={styles.starredEmpty}>
                      <span className={styles.starredEmptyIcon}>
                        <StarOutlineIcon size={18} />
                      </span>
                      <p className={styles.starredEmptyText}>
                        Your starred bases, interfaces, and workspaces will appear here
                      </p>
                    </div>
                  ) : (
                    <div className={styles.starredList}>
                      {orderedStarredBases.map((base, index) => (
                        <div
                          key={base.id}
                          className={`${basesStyles.starredEntryWrapper} ${dragState?.dragIndex === index ? basesStyles.starredEntryGhost : ""}`}
                          style={getStarredItemStyle(index)}
                        >
                          <Link
                            href={`/bases/${base.id}/tables/default`}
                            className={basesStyles.starredEntry}
                            draggable={false}
                            onClick={(e) => {
                              if (dragRef.current) {
                                e.preventDefault();
                                return;
                              }
                              actions.recordOpen(base.id);
                            }}
                          >
                            <div
                              className={basesStyles.starredEntryLogo}
                              style={{ backgroundColor: getBaseColor(base.id) }}
                            >
                              <span style={{ color: getBaseTextColor(base.id) }}>
                                {getBaseInitials(base.name)}
                              </span>
                            </div>
                            <p className={basesStyles.starredEntryTitle}>{base.name}</p>
                            <span className={basesStyles.starredEntryAppLabel}>App</span>
                            <span
                              className={basesStyles.starredEntryStar}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                actions.toggleStar(base.id);
                              }}
                            >
                              <StarFilledIcon size={16} color="#FFBA06" />
                            </span>
                            <span
                              className={basesStyles.starredEntryDragHandle}
                              onPointerDown={(e) => startStarredDrag(e, index)}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <DotsSixVerticalIcon size={16} />
                            </span>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <button type="button" className={styles.navItem}>
                <span className={styles.navIcon}>
                  <ShareIcon size={20} />
                </span>
                <span className={styles.navLabel}>Shared</span>
              </button>

              <div className={styles.navRow}>
                <button type="button" className={styles.navItem}>
                  <span className={`${styles.navIcon} ${styles.navIconWorkspaces}`}>
                    <WorkspacesIcon size={20} />
                  </span>
                  <span className={styles.navLabel}>Workspaces</span>
                </button>
                <button
                  type="button"
                  className={styles.addButton}
                  aria-label="Create a workspace"
                >
                  <PlusIcon size={16} />
                </button>
                <button
                  type="button"
                  className={`${styles.disclosureButton} ${workspacesExpanded ? styles.disclosureExpanded : styles.disclosureCollapsed}`}
                  aria-label={workspacesExpanded ? "Collapse workspaces" : "Expand workspaces"}
                  aria-expanded={workspacesExpanded}
                  onClick={() => setWorkspacesExpanded(!workspacesExpanded)}
                >
                  <ChevronDownIcon size={20} />
                </button>
              </div>
            </div>

            <div className={styles.sidebarBottom}>
              <div className={styles.bottomLinksWrap}>
                <button type="button" className={styles.bottomLink}>
                  <span className={styles.bottomLinkIcon}>
                    <TemplatesIcon size={16} />
                  </span>
                  <span className={styles.bottomLinkText}>Templates and apps</span>
                </button>

                <a
                  href="https://airtable.com/marketplace"
                  className={styles.bottomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.bottomLinkIcon}>
                    <MarketplaceIcon size={16} />
                  </span>
                  <span className={styles.bottomLinkText}>Marketplace</span>
                </a>

                <button type="button" className={styles.bottomLink}>
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

      {/* Floating dragged starred item — portaled to body to avoid ancestor transform issues */}
      {dragState &&
        orderedStarredBases[dragState.dragIndex] &&
        createPortal(
          (() => {
            const base = orderedStarredBases[dragState.dragIndex]!;
            return (
              <div className={basesStyles.starredEntryFloating} style={getFloatingStyle()}>
                <div
                  className={`${basesStyles.starredEntry} ${basesStyles.starredEntryLifted}`}
                >
                  <div
                    className={basesStyles.starredEntryLogo}
                    style={{ backgroundColor: getBaseColor(base.id) }}
                  >
                    <span style={{ color: getBaseTextColor(base.id) }}>
                      {getBaseInitials(base.name)}
                    </span>
                  </div>
                  <p className={basesStyles.starredEntryTitle}>{base.name}</p>
                  <span className={basesStyles.starredEntryAppLabel}>App</span>
                  <span className={basesStyles.starredEntryStar}>
                    <StarFilledIcon size={16} color="#FFBA06" />
                  </span>
                  <span className={basesStyles.starredEntryDragHandle}>
                    <DotsSixVerticalIcon size={16} />
                  </span>
                </div>
              </div>
            );
          })(),
          document.body
        )}
    </>
  );
}
