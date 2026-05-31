"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./bases.module.css";
import { getBaseColor, getBaseBorderColor, getBaseTextColor, getBaseInitials, formatRelativeTime } from "./baseUtils";
import { useBaseCardActions } from "./useBaseCardActions";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { BaseOverflowMenu } from "./BaseOverflowMenu";
import { useBaseItemState } from "./useBaseItemState";
import { DatabaseIcon, StarOutlineIcon, StarFilledIcon, OverflowIcon } from "~/components/home/Icons";

export interface BaseCardProps {
  base: {
    id: string;
    name: string;
    lastOpenedAt: Date;
    isStarred: boolean;
  };
}

export function BaseCard({ base }: BaseCardProps) {
  const [isHoveringActions, setIsHoveringActions] = useState(false);
  const router = useRouter();
  const actions = useBaseCardActions();

  const {
    menuOpen, setMenuOpen,
    menuRight, menuUp,
    menuRef, buttonRef, inputRef,
    isRenaming,
    editName, setEditName,
    showDeleteConfirm,
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (isRenaming || menuOpen || showDeleteConfirm) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input')) return;
    setIsClickedFn(true);
    actions.recordOpen(base.id);
    router.push(`/bases/${base.id}/tables/default`);
  };
  
  const color = getBaseColor(base.id);
  const borderColor = getBaseBorderColor(base.id);
  const textColor = getBaseTextColor(base.id);
  const initials = getBaseInitials(base.name);
  const timeAgo = formatRelativeTime(base.lastOpenedAt);

  return (
    <div 
      className={`${styles.baseCard} ${isRenaming ? styles.baseCardRenaming : ""} ${showDeleteConfirm ? styles.baseCardDeleteConfirm : ""} ${menuOpen ? styles.baseCardMenuOpen : ""} ${isClicked ? styles.baseCardClicked : ""}`} 
      role="region" 
      aria-label={base.name}
      onClick={handleCardClick}
    >
      {!isRenaming && !isHoveringActions && !menuOpen && !showDeleteConfirm && (
        <span className={styles.baseCardTooltip} role="tooltip">
          {base.name}
          {"\n"}
          app
        </span>
      )}

      {base.isStarred && (
        <div className={styles.baseCardStarredIndicator}>
          <StarFilledIcon size={16} color="#FFBA06" />
        </div>
      )}

      <div className={styles.baseCardInner}>
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

            {menuOpen && (
              <BaseOverflowMenu
                menuUp={menuUp}
                menuRight={menuRight}
                onRename={() => { setIsHoveringActions(false); handleRenameClick(); }}
                onDelete={handleDeleteClick}
              />
            )}

            {showDeleteConfirm && (
              <DeleteConfirmDialog
                baseName={base.name}
                onConfirm={() => handleDeleteConfirm(() => actions.delete(base.id))}
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
