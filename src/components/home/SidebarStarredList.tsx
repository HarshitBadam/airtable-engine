"use client";

import Link from "next/link";
import styles from "./DashboardSidebar.module.css";
import {
  StarIcon,
  ChevronDownIcon,
  StarOutlineIcon,
  StarFilledIcon,
  DotsSixVerticalIcon,
} from "~/components/home/Icons";
import {
  getBaseColor,
  getBaseTextColor,
  getBaseInitials,
} from "~/components/bases";
import type { DragState } from "~/hooks/useStarredDragDrop";
import type React from "react";

type StarredBase = { id: string; name: string };

interface SidebarStarredListProps {
  starredExpanded: boolean;
  setStarredExpanded: (v: boolean) => void;
  bases: Array<{ id: string }>;
  orderedStarredBases: StarredBase[];
  dragState: DragState;
  dragRef: React.RefObject<DragState>;
  startStarredDrag: (e: React.PointerEvent, index: number) => void;
  getStarredItemStyle: (index: number) => React.CSSProperties;
  actions: {
    recordOpen: (id: string) => void;
    toggleStar: (id: string) => void;
  };
}

export function SidebarStarredList({
  starredExpanded,
  setStarredExpanded,
  bases,
  orderedStarredBases,
  dragState,
  dragRef,
  startStarredDrag,
  getStarredItemStyle,
  actions,
}: SidebarStarredListProps) {
  return (
    <>
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
                  className={`${styles.starredEntryWrapper} ${dragState?.dragIndex === index ? styles.starredEntryGhost : ""}`}
                  style={getStarredItemStyle(index)}
                >
                  <Link
                    href={`/bases/${base.id}/tables/default`}
                    className={styles.starredEntry}
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
                      className={styles.starredEntryLogo}
                      style={{ backgroundColor: getBaseColor(base.id) }}
                    >
                      <span style={{ color: getBaseTextColor(base.id) }}>
                        {getBaseInitials(base.name)}
                      </span>
                    </div>
                    <p className={styles.starredEntryTitle}>{base.name}</p>
                    <span className={styles.starredEntryAppLabel}>App</span>
                    <span
                      className={styles.starredEntryStar}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        actions.toggleStar(base.id);
                      }}
                    >
                      <StarFilledIcon size={16} color="#FFBA06" />
                    </span>
                    <span
                      className={styles.starredEntryDragHandle}
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
    </>
  );
}
