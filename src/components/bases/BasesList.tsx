/**
 * BasesList component
 * Displays bases in a list view format
 */

"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./bases.module.css";
import { getBaseColor, getBaseTextColor, getBaseInitials, formatRelativeTime } from "./useBases";
import { useBaseCardActions } from "./useBaseCardActions";
import { 
  StarOutlineIcon, 
  StarFilledIcon,
  OverflowIcon,
  PencilIcon,
  CopyIcon,
  ArrowRightIcon,
  WorkspacesIcon,
  PaintBrushIcon,
  TrashIcon,
  QuestionMarkCircleIcon
} from "~/components/home/Icons";

export interface BasesListProps {
  bases: Array<{
    id: string;
    name: string;
    lastOpenedAt: Date;
    isStarred: boolean;
  }>;
}

interface ListItemProps {
  base: {
    id: string;
    name: string;
    lastOpenedAt: Date;
    isStarred: boolean;
  };
}

function ListItem({ base }: ListItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRight, setMenuRight] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(base.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteDialogOffset, setDeleteDialogOffset] = useState(0);
  const [isClicked, setIsClicked] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Handle click animation and navigation
  const handleItemClick = (e: React.MouseEvent) => {
    // Don't navigate if in special states
    if (isRenaming || menuOpen || showDeleteConfirm) return;
    
    // Check if click was on an interactive element (buttons, links, inputs)
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input')) {
      return;
    }
    
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 300);
    // Record the open action to update lastOpenedAt
    actions.recordOpen(base.id);
    // Navigate to the table workspace page (default table for now)
    router.push(`/bases/${base.id}/tables/default`);
  };

  const actions = useBaseCardActions();

  const color = getBaseColor(base.id);
  const textColor = getBaseTextColor(base.id);
  const initials = getBaseInitials(base.name);
  const timeAgo = formatRelativeTime(base.lastOpenedAt);
  
  // Format full date/time for tooltip: "February 3, 2026 at 2:37 AM"
  const datePart = base.lastOpenedAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timePart = base.lastOpenedAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const fullDateTime = `${datePart} at ${timePart}`;

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  // Check if menu would overflow viewport
  const checkMenuPosition = () => {
    if (buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 240;
      const menuHeight = 260; // approximate menu height including margin
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Horizontal: If menu left-aligned would overflow right edge of viewport
      if (buttonRect.left + menuWidth > viewportWidth - 16) {
        setMenuRight(true);
      } else {
        setMenuRight(false);
      }
      
      // Vertical: If menu below would overflow bottom of viewport
      if (buttonRect.bottom + menuHeight > viewportHeight - 16) {
        setMenuUp(true);
      } else {
        setMenuUp(false);
      }
    }
  };

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Adjust delete dialog position if it would overflow viewport
  useEffect(() => {
    if (showDeleteConfirm && deleteDialogRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const dialog = deleteDialogRef.current;
          if (!dialog) return;
          
          const rect = dialog.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          
          if (rect.bottom > viewportHeight) {
            const overflow = rect.bottom - viewportHeight;
            setDeleteDialogOffset(-overflow);
          } else {
            setDeleteDialogOffset(0);
          }
        });
      });
    } else {
      setDeleteDialogOffset(0);
    }
  }, [showDeleteConfirm]);

  const handleRenameClick = () => {
    setMenuOpen(false);
    setEditName(base.name);
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== base.name) {
      actions.rename(base.id, trimmedName);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
      setEditName(base.name);
    }
  };

  const handleDeleteClick = () => {
    setMenuOpen(false);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    actions.delete(base.id);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div 
      className={`${styles.listItem} ${showDeleteConfirm ? styles.listItemDeleteConfirm : ""} ${menuOpen ? styles.listItemMenuOpen : ""} ${isRenaming ? styles.listItemRenaming : ""} ${isClicked ? styles.listItemClicked : ""}`}
      onClick={handleItemClick}
    >
      {/* Hover highlight (real element so it can be positioned; 16px left) */}
      <div className={styles.listItemHoverHighlight} aria-hidden />
      {/* Clickable link area */}
      {!isRenaming && <Link href={`/bases/${base.id}/tables/default`} className={styles.listItemLink} onClick={() => actions.recordOpen(base.id)} />}
      
      {/* Content grid */}
      <div className={styles.listItemContent}>
        {/* Name column with icon, name, and hover actions */}
        <div className={`${styles.listItemNameColumn} ${styles.listItemNameColumnShift}`} ref={menuRef}>
          <div 
            className={styles.listItemIcon}
            style={{ backgroundColor: color }}
          >
            <span style={{ color: textColor }}>{initials}</span>
          </div>
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              className={styles.baseCardNameInput}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleRenameKeyDown}
              style={{ pointerEvents: 'auto' }}
            />
          ) : (
            <span className={styles.listItemName}>{base.name}</span>
          )}
          
          {/* Open data link - left, beside title, visible on hover */}
          <Link 
            href={`/bases/${base.id}/tables/default`} 
            className={styles.listItemOpenData}
            onClick={(e) => {
              e.stopPropagation();
              actions.recordOpen(base.id);
            }}
          >
            <span>Open data</span>
          </Link>
          
          {/* Hover action buttons - right side */}
          <div className={styles.listItemHoverActions}>
            <div className={styles.listItemActionButtons}>
              <button
                type="button"
                className={styles.listItemActionButton}
                aria-label={base.isStarred ? "Unstar this base" : "Star this base"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (showDeleteConfirm) return;
                  actions.toggleStar(base.id);
                }}
              >
                {base.isStarred ? (
                  <StarFilledIcon size={16} color="#FFBA06" />
                ) : (
                  <StarOutlineIcon size={16} />
                )}
              </button>
              <div className={styles.listItemOverflowWrap}>
                <button
                  type="button"
                  className={styles.listItemActionButton}
                  aria-label="More options"
                  ref={buttonRef}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (showDeleteConfirm) return;
                    if (!menuOpen) {
                      checkMenuPosition();
                    }
                    setMenuOpen(!menuOpen);
                  }}
                >
                  <OverflowIcon size={16} />
                </button>
                {/* Dropdown menu - positioned based on viewport space */}
                {menuOpen && (
                  <ul className={`${styles.listItemMenu} ${menuUp ? styles.listItemMenuUp : ""} ${menuRight ? styles.listItemMenuRight : ""}`}>
              <li className={styles.baseCardMenuItem} onClick={handleRenameClick}>
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
              <li className={styles.baseCardMenuItem} onClick={handleDeleteClick}>
                <TrashIcon size={16} />
                <span>Delete</span>
              </li>
            </ul>
                )}
              </div>
            </div>
          </div>
          
          {/* Starred indicator - visible when not hovering */}
          {base.isStarred && (
            <span 
              className={styles.listItemStarredIndicator}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (showDeleteConfirm) return;
                actions.toggleStar(base.id);
              }}
            >
              <StarFilledIcon size={16} color="#FFBA06" />
            </span>
          )}
        </div>
        
        {/* Last opened column with hover tooltip */}
        <span className={`${styles.listItemColumn} ${styles.listItemColumnShift} ${styles.listItemLastOpened}`}>
          {timeAgo.replace("Opened ", "")}
          <span className={styles.listItemLastOpenedTooltip}>{fullDateTime}</span>
        </span>
        
        {/* Workspace column */}
        <span className={`${styles.listItemColumn} ${styles.listItemColumnShift} ${styles.listItemWorkspaceShift}`}>My First Workspace</span>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <>
          <div 
            className={styles.deleteConfirmOverlay} 
            onClick={handleDeleteCancel}
          />
          <div 
            ref={deleteDialogRef}
            className={styles.listItemDeleteDialog}
            style={deleteDialogOffset !== 0 ? { transform: `translateY(${deleteDialogOffset}px)` } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <p className={styles.deleteConfirmTitle}>
              Are you sure you want to delete {base.name}?
            </p>
            <span className={styles.deleteConfirmMessage}>
              Recently deleted apps can be restored from trash.
              <span className={styles.deleteConfirmHelpIcon}>
                <QuestionMarkCircleIcon size={15} />
              </span>
            </span>
            <div className={styles.deleteConfirmButtons}>
              <button 
                type="button"
                className={styles.deleteConfirmCancelButton}
                onClick={handleDeleteCancel}
              >
                Cancel
              </button>
              <button 
                type="button"
                className={styles.deleteConfirmDeleteButton}
                onClick={handleDeleteConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function BasesList({ bases }: BasesListProps) {
  if (bases.length === 0) {
    return null;
  }

  return (
    <div className={styles.listViewContainer}>
      {/* Header row */}
      <div className={styles.listViewHeader}>
        <span className={`${styles.listViewHeaderColumn} ${styles.listViewHeaderNameShift}`}>Name</span>
        <span className={`${styles.listViewHeaderColumn} ${styles.listViewHeaderColumnShift}`}>Last opened</span>
        <span className={`${styles.listViewHeaderColumn} ${styles.listViewHeaderColumnShift} ${styles.listViewHeaderWorkspaceShift}`}>Workspace</span>
      </div>
      
      {/* Divider */}
      <div className={styles.listViewDivider} />
      
      {/* List items */}
      <div className={styles.listViewList}>
        {bases.map((base) => (
          <ListItem key={base.id} base={base} />
        ))}
      </div>
    </div>
  );
}
