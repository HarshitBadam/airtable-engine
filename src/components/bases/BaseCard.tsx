/**
 * BaseCard component
 * Displays a single base card with icon, name, and timestamp
 */

"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import styles from "./bases.module.css";
import { getBaseColor, getBaseBorderColor, getBaseTextColor, getBaseInitials, formatRelativeTime } from "./useBases";
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
  QuestionMarkCircleIcon
} from "~/components/home/Icons";
import { api } from "~/trpc/react";

export interface BaseCardProps {
  base: {
    id: string;
    name: string;
    updatedAt: Date;
    isStarred: boolean;
  };
  isLast?: boolean;
}

export function BaseCard({ base, isLast = false }: BaseCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRight, setMenuRight] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(base.name);
  const [isHoveringActions, setIsHoveringActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteDialogOffset, setDeleteDialogOffset] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  
  const utils = api.useUtils();
  
  // Optimistic rename mutation
  const renameMutation = api.base.rename.useMutation({
    onMutate: async ({ id, name }) => {
      // Cancel outgoing refetches
      await utils.base.listMine.cancel();
      
      // Snapshot previous state
      const previousMine = utils.base.listMine.getData();
      
      // Optimistically update
      utils.base.listMine.setData(undefined, (old) =>
        old?.map((b) => (b.id === id ? { ...b, name } : b))
      );
      
      return { previousMine };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousMine) {
        utils.base.listMine.setData(undefined, context.previousMine);
      }
    },
    onSettled: () => {
      void utils.base.listMine.invalidate();
    },
  });
  
  // Optimistic delete mutation
  const deleteMutation = api.base.delete.useMutation({
    onMutate: async ({ id }) => {
      // Cancel outgoing refetches
      await utils.base.listMine.cancel();
      await utils.base.listStarred.cancel();
      
      // Snapshot previous state
      const previousMine = utils.base.listMine.getData();
      const previousStarred = utils.base.listStarred.getData();
      
      // Optimistically remove from lists
      utils.base.listMine.setData(undefined, (old) =>
        old?.filter((b) => b.id !== id)
      );
      utils.base.listStarred.setData(undefined, (old) =>
        old?.filter((b) => b.id !== id)
      );
      
      return { previousMine, previousStarred };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousMine) {
        utils.base.listMine.setData(undefined, context.previousMine);
      }
      if (context?.previousStarred) {
        utils.base.listStarred.setData(undefined, context.previousStarred);
      }
    },
    onSettled: () => {
      void utils.base.listMine.invalidate();
      void utils.base.listStarred.invalidate();
    },
  });

  // Optimistic star toggle mutation
  const toggleStarMutation = api.base.toggleStar.useMutation({
    onMutate: async ({ id }) => {
      // Cancel outgoing refetches
      await utils.base.listMine.cancel();
      await utils.base.listStarred.cancel();
      
      // Snapshot previous state
      const previousMine = utils.base.listMine.getData();
      const previousStarred = utils.base.listStarred.getData();
      
      // Get the base being toggled
      const baseToToggle = previousMine?.find((b) => b.id === id);
      const newIsStarred = baseToToggle ? !baseToToggle.isStarred : false;
      
      // Optimistically update listMine
      utils.base.listMine.setData(undefined, (old) =>
        old?.map((b) => (b.id === id ? { ...b, isStarred: newIsStarred } : b))
      );
      
      // Optimistically update listStarred
      if (newIsStarred && baseToToggle) {
        // Add to starred list
        utils.base.listStarred.setData(undefined, (old) => 
          old ? [{ ...baseToToggle, isStarred: true }, ...old] : [{ ...baseToToggle, isStarred: true }]
        );
      } else {
        // Remove from starred list
        utils.base.listStarred.setData(undefined, (old) =>
          old?.filter((b) => b.id !== id)
        );
      }
      
      return { previousMine, previousStarred };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousMine) {
        utils.base.listMine.setData(undefined, context.previousMine);
      }
      if (context?.previousStarred) {
        utils.base.listStarred.setData(undefined, context.previousStarred);
      }
    },
    onSettled: () => {
      void utils.base.listMine.invalidate();
      void utils.base.listStarred.invalidate();
    },
  });

  const handleStarClick = () => {
    toggleStarMutation.mutate({ id: base.id });
  };
  
  const color = getBaseColor(base.id);
  const borderColor = getBaseBorderColor(base.id);
  const textColor = getBaseTextColor(base.id);
  const initials = getBaseInitials(base.name);
  const timeAgo = formatRelativeTime(base.updatedAt);

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
      renameMutation.mutate({ id: base.id, name: trimmedName });
    }
    setIsRenaming(false);
    setIsHoveringActions(false); // Reset hover state when exiting rename mode
    // Reset again after a short delay to handle race condition with onMouseEnter
    setTimeout(() => setIsHoveringActions(false), 50);
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

  // Adjust delete dialog position if it would overflow viewport
  useEffect(() => {
    if (showDeleteConfirm && deleteDialogRef.current) {
      // Double RAF ensures layout is fully stable before measuring
      // Single RAF can fire before browser completes layout calculations
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const dialog = deleteDialogRef.current;
          if (!dialog) return;
          
          const rect = dialog.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          
          // If dialog bottom extends past viewport, calculate offset needed (with 8px buffer)
          if (rect.bottom > viewportHeight - 8) {
            const overflow = rect.bottom - viewportHeight + 8;
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

  // Handle delete
  const handleDeleteClick = () => {
    setMenuOpen(false);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    deleteMutation.mutate({ id: base.id });
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div className={`${styles.baseCard} ${isRenaming ? styles.baseCardRenaming : ""} ${showDeleteConfirm ? styles.baseCardDeleteConfirm : ""} ${menuOpen ? styles.baseCardMenuOpen : ""}`} role="region" aria-label={base.name}>
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
              <Link href={`/bases/${base.id}`} className={styles.baseCardLink}>
                <h3 className={styles.baseCardName}>{base.name}</h3>
              </Link>
            )}
          </div>
          <div className={styles.baseCardMeta}>
            {isRenaming ? (
              /* Show Open data when renaming */
              <Link href={`/bases/${base.id}`} className={styles.baseCardOpenDataStatic}>
                <DatabaseIcon size={16} />
                <span>Open data</span>
              </Link>
            ) : (
              <>
                <span className={styles.baseCardTime}>{timeAgo}</span>
                {/* Open data link - shown on hover, replaces timeAgo */}
                <Link href={`/bases/${base.id}`} className={styles.baseCardOpenData}>
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
                  handleStarClick();
                }}
              >
                {base.isStarred ? (
                  <StarFilledIcon size={16} color="#FFBA06" />
                ) : (
                  <StarOutlineIcon size={16} />
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
              <OverflowIcon size={16} />
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
                  <WorkspacesIcon size={22} />
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
              <>
                <div 
                  className={styles.deleteConfirmOverlay} 
                  onClick={handleDeleteCancel}
                />
                <div 
                  ref={deleteDialogRef}
                  className={styles.deleteConfirmDialog}
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
        </div>
        )}
      </div>
    </div>
  );
}
