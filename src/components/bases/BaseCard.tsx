/**
 * BaseCard component
 * Displays a single base card with icon, name, and timestamp
 */

"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./bases.module.css";
import { getBaseColor, getBaseBorderColor, getBaseTextColor, getBaseInitials, formatRelativeTime } from "./useBases";
import { useBaseCardActions } from "./useBaseCardActions";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { MENU_WIDTH, MENU_HEIGHT, VIEWPORT_EDGE_BUFFER, HOVER_RESET_DELAY } from "~/shared/constants";
import { 
  DatabaseIcon, 
  StarOutlineIcon, 
  StarFilledIcon,
  OverflowIcon,
  PencilIcon,
  CopyIcon,
  ArrowRightIcon,
  WorkspacesIcon,
  PaintBrushIcon,
  TrashIcon,
} from "~/components/home/Icons";

export interface BaseCardProps {
  base: {
    id: string;
    name: string;
    lastOpenedAt: Date;
    isStarred: boolean;
  };
}

export function BaseCard({ base }: BaseCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRight, setMenuRight] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(base.name);
  const [isHoveringActions, setIsHoveringActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Handle click animation and navigation
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements or in special states
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
  const borderColor = getBaseBorderColor(base.id);
  const textColor = getBaseTextColor(base.id);
  const initials = getBaseInitials(base.name);
  const timeAgo = formatRelativeTime(base.lastOpenedAt);

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
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Horizontal: If menu left-aligned would overflow right edge of viewport
      setMenuRight(buttonRect.left + MENU_WIDTH > viewportWidth - VIEWPORT_EDGE_BUFFER);
      
      // Vertical: If menu below would overflow bottom of viewport
      setMenuUp(buttonRect.bottom + MENU_HEIGHT > viewportHeight - VIEWPORT_EDGE_BUFFER);
    }
  };

  // Handle rename
  const handleRenameClick = () => {
    setMenuOpen(false);
    setIsHoveringActions(false); // Reset hover state when entering rename mode
    setEditName(base.name);
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== base.name) {
      actions.rename(base.id, trimmedName);
    }
    setIsRenaming(false);
    setIsHoveringActions(false);
    setTimeout(() => setIsHoveringActions(false), HOVER_RESET_DELAY);
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

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Handle delete
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
      className={`${styles.baseCard} ${isRenaming ? styles.baseCardRenaming : ""} ${showDeleteConfirm ? styles.baseCardDeleteConfirm : ""} ${menuOpen ? styles.baseCardMenuOpen : ""} ${isClicked ? styles.baseCardClicked : ""}`} 
      role="region" 
      aria-label={base.name}
      onClick={handleCardClick}
    >
      {/* Hover tooltip - hidden when renaming, hovering over actions, menu open, or delete confirm shown */}
      {!isRenaming && !isHoveringActions && !menuOpen && !showDeleteConfirm && (
        <span className={styles.baseCardTooltip} role="tooltip">
          {base.name}
          {"\n"}
          app
        </span>
      )}

      {/* Starred indicator - shown in non-hover state when starred */}
      {base.isStarred && (
        <div className={styles.baseCardStarredIndicator}>
          <StarFilledIcon size={16} color="#FFBA06" />
        </div>
      )}

      <div className={styles.baseCardInner}>
        {/* Left: Icon area with smaller rounded square */}
        <div className={styles.baseCardIconArea} aria-hidden="true">
          <div
            className={styles.baseCardIconSquare}
            style={{ 
              backgroundColor: color,
              border: `1px solid ${borderColor}`,
            }}
          >
            <span className={styles.baseCardInitials} style={{ color: textColor }}>{initials}</span>
          </div>
        </div>

        {/* Right: Content area */}
        <div className={styles.baseCardContent}>
          <div className={styles.baseCardHeader}>
            {isRenaming ? (
              <input
                ref={inputRef}
                type="text"
                className={styles.baseCardNameInput}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleRenameKeyDown}
              />
            ) : (
              <Link 
                href={`/bases/${base.id}/tables/default`} 
                className={styles.baseCardLink}
                onClick={() => actions.recordOpen(base.id)}
              >
                <h3 className={styles.baseCardName}>{base.name}</h3>
              </Link>
            )}
          </div>
          <div className={styles.baseCardMeta}>
            {isRenaming ? (
              /* Show Open data when renaming */
              <Link 
                href={`/bases/${base.id}/tables/default`} 
                className={styles.baseCardOpenDataStatic}
                onClick={() => actions.recordOpen(base.id)}
              >
                <DatabaseIcon size={16} />
                <span>Open data</span>
              </Link>
            ) : (
              <>
                <span className={styles.baseCardTime}>{timeAgo}</span>
                {/* Open data link - shown on hover, replaces timeAgo */}
                <Link 
                  href={`/bases/${base.id}/tables/default`} 
                  className={styles.baseCardOpenData}
                  onClick={() => actions.recordOpen(base.id)}
                >
                  <DatabaseIcon size={16} />
                  <span>Open data</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Hover overlay with action buttons - hidden when renaming */}
        {!isRenaming && (
        <div 
          className={styles.baseCardHoverActions}
          onMouseEnter={() => setIsHoveringActions(true)}
          onMouseLeave={() => setIsHoveringActions(false)}
        >
          <div className={styles.baseCardActionButtonsWrapper} ref={menuRef}>
            <div className={styles.baseCardActionButtons}>
              <button 
                type="button" 
                className={styles.baseCardActionButton}
                aria-label={base.isStarred ? "Unstar this base" : "Star this base"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (showDeleteConfirm) return;
                  actions.toggleStar(base.id);
                }}
              >
                {base.isStarred ? (
                  <StarFilledIcon size={18} color="#FFBA06" />
                ) : (
                  <StarOutlineIcon size={18} />
                )}
              </button>
            <button 
              type="button" 
              className={styles.baseCardActionButton}
              aria-label="More options"
              ref={buttonRef}
              onClick={(e) => {
                e.stopPropagation();
                if (showDeleteConfirm) return;
                if (!menuOpen) {
                  checkMenuPosition();
                }
                setMenuOpen(!menuOpen);
              }}
            >
              <OverflowIcon size={18} />
            </button>
            </div>

            {/* Dropdown menu - positioned relative to button */}
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

            {/* Delete confirmation dialog */}
            {showDeleteConfirm && (
              <DeleteConfirmDialog
                baseName={base.name}
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
              />
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
