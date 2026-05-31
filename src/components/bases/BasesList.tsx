"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./bases.module.css";
import { getBaseColor, getBaseTextColor, getBaseInitials, formatRelativeTime } from "./baseUtils";
import { useBaseCardActions } from "./useBaseCardActions";
import { BaseOverflowMenu } from "./BaseOverflowMenu";
import { useBaseItemState } from "./useBaseItemState";
import {
  StarOutlineIcon,
  StarFilledIcon,
  OverflowIcon,
  QuestionMarkCircleIcon,
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
  const [deleteDialogOffset, setDeleteDialogOffset] = useState(0);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const actions = useBaseCardActions();

  const {
    menuOpen, setMenuOpen,
    menuRight, menuUp,
    menuRef, buttonRef, inputRef,
    isRenaming,
    editName, setEditName,
    showDeleteConfirm, setShowDeleteConfirm,
    isClicked, setIsClickedFn,
    checkMenuPosition,
    handleRenameClick,
    handleRenameSubmit,
    handleRenameKeyDown,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useBaseItemState({
    baseName: base.name,
    onRename: (newName) => actions.rename(base.id, newName),
  });

  const handleItemClick = (e: React.MouseEvent) => {
    if (isRenaming || menuOpen || showDeleteConfirm) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input')) return;
    setIsClickedFn(true);
    actions.recordOpen(base.id);
    router.push(`/bases/${base.id}/tables/default`);
  };

  const color = getBaseColor(base.id);
  const textColor = getBaseTextColor(base.id);
  const initials = getBaseInitials(base.name);
  const timeAgo = formatRelativeTime(base.lastOpenedAt);

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

  return (
    <div 
      className={`${styles.listItem} ${showDeleteConfirm ? styles.listItemDeleteConfirm : ""} ${menuOpen ? styles.listItemMenuOpen : ""} ${isRenaming ? styles.listItemRenaming : ""} ${isClicked ? styles.listItemClicked : ""}`}
      onClick={handleItemClick}
    >
      {/* Hover highlight (real element so it can be positioned; 16px left) */}
      <div className={styles.listItemHoverHighlight} aria-hidden />
      {!isRenaming && <Link href={`/bases/${base.id}/tables/default`} className={styles.listItemLink} onClick={() => actions.recordOpen(base.id)} />}
      
      <div className={styles.listItemContent}>
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
                {menuOpen && (
                  <BaseOverflowMenu
                    menuUp={menuUp}
                    menuRight={menuRight}
                    onRename={handleRenameClick}
                    onDelete={handleDeleteClick}
                  />
                )}
              </div>
            </div>
          </div>
          
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
        
        <span className={`${styles.listItemColumn} ${styles.listItemColumnShift} ${styles.listItemLastOpened}`}>
          {timeAgo.replace("Opened ", "")}
          <span className={styles.listItemLastOpenedTooltip}>{fullDateTime}</span>
        </span>
        
        <span className={`${styles.listItemColumn} ${styles.listItemColumnShift} ${styles.listItemWorkspaceShift}`}>My First Workspace</span>
      </div>

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
                onClick={() => handleDeleteConfirm(() => actions.delete(base.id))}
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
      <div className={styles.listViewHeader}>
        <span className={`${styles.listViewHeaderColumn} ${styles.listViewHeaderNameShift}`}>Name</span>
        <span className={`${styles.listViewHeaderColumn} ${styles.listViewHeaderColumnShift}`}>Last opened</span>
        <span className={`${styles.listViewHeaderColumn} ${styles.listViewHeaderColumnShift} ${styles.listViewHeaderWorkspaceShift}`}>Workspace</span>
      </div>
      
      <div className={styles.listViewDivider} />
      
      <div className={styles.listViewList}>
        {bases.map((base) => (
          <ListItem key={base.id} base={base} />
        ))}
      </div>
    </div>
  );
}
