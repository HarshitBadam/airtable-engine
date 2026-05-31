"use client";

import styles from "./bases.module.css";
import {
  PencilIcon,
  CopyIcon,
  ArrowRightIcon,
  WorkspacesIcon,
  PaintBrushIcon,
  TrashIcon,
} from "~/components/home/Icons";

interface BaseOverflowMenuProps {
  menuUp?: boolean;
  menuRight?: boolean;
  onRename: () => void;
  onDelete: () => void;
}

export function BaseOverflowMenu({
  menuUp = false,
  menuRight = false,
  onRename,
  onDelete,
}: BaseOverflowMenuProps) {
  return (
    <ul
      className={`${styles.listItemMenu} ${menuUp ? styles.listItemMenuUp : ""} ${menuRight ? styles.listItemMenuRight : ""}`}
    >
      <li className={styles.baseCardMenuItem} onClick={onRename}>
        <PencilIcon size={16} />
        <span>Rename</span>
      </li>
      <li className={styles.baseCardMenuItem}>
        <CopyIcon size={16} />
        <span>Duplicate</span>
      </li>
      <li className={styles.baseCardMenuItem}>
        <ArrowRightIcon size={16} />
        <span>Move</span>
      </li>
      <li className={`${styles.baseCardMenuItem} ${styles.baseCardMenuItemWorkspace}`}>
        <WorkspacesIcon size={20} />
        <span>Go to workspace</span>
      </li>
      <li className={styles.baseCardMenuItem}>
        <PaintBrushIcon size={16} />
        <span>Customize appearance</span>
      </li>
      <li className={styles.baseCardMenuDivider} />
      <li className={styles.baseCardMenuItem} onClick={onDelete}>
        <TrashIcon size={16} />
        <span>Delete</span>
      </li>
    </ul>
  );
}
