"use client";

import { createPortal } from "react-dom";
import styles from "./DashboardSidebar.module.css";
import { StarFilledIcon, DotsSixVerticalIcon } from "~/components/home/Icons";
import {
  getBaseColor,
  getBaseTextColor,
  getBaseInitials,
} from "~/components/bases";
import type { DragState } from "~/hooks/useStarredDragDrop";
import type React from "react";

type StarredBase = { id: string; name: string };

interface SidebarDragPreviewProps {
  dragState: DragState;
  orderedStarredBases: StarredBase[];
  getFloatingStyle: () => React.CSSProperties;
}

/** Portaled to body to avoid ancestor transform issues while following the pointer. */
export function SidebarDragPreview({
  dragState,
  orderedStarredBases,
  getFloatingStyle,
}: SidebarDragPreviewProps) {
  const base = dragState ? orderedStarredBases[dragState.dragIndex] : undefined;
  if (!dragState || !base) return null;

  return createPortal(
    <div className={styles.starredEntryFloating} style={getFloatingStyle()}>
      <div className={`${styles.starredEntry} ${styles.starredEntryLifted}`}>
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
        <span className={styles.starredEntryStar}>
          <StarFilledIcon size={16} color="#FFBA06" />
        </span>
        <span className={styles.starredEntryDragHandle}>
          <DotsSixVerticalIcon size={16} />
        </span>
      </div>
    </div>,
    document.body,
  );
}
