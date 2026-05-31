import React from 'react';
import { createPortal } from 'react-dom';
import styles from './ViewsSidebar.module.css';

interface ViewListItemProps {
  view: { id: string; name: string };
  index: number;
  isActive: boolean;
  isRenaming: boolean;
  sidebarRenameInputRef: React.RefObject<HTMLInputElement | null>;
  renameValue: string;
  onRenameChange: (val: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  showDuplicateTooltip: boolean;
  isFavorited: boolean;
  onFavoriteToggle: (viewId: string) => void;
  onSelect: (viewId: string) => void;
  onDoubleClick: (viewId: string) => void;
  isDragging: boolean;
  style: React.CSSProperties;
  onDragStart: (e: React.MouseEvent, index: number) => void;
  isContextMenuOpen: boolean;
  onContextMenuOpen: (viewId: string, position: { top: number; left: number }) => void;
  onContextMenuClose: () => void;
}

export function ViewListItem({
  view,
  index,
  isActive,
  isRenaming,
  sidebarRenameInputRef,
  renameValue,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  showDuplicateTooltip,
  isFavorited,
  onFavoriteToggle,
  onSelect,
  onDoubleClick,
  isDragging,
  style,
  onDragStart,
  isContextMenuOpen,
  onContextMenuOpen,
  onContextMenuClose,
}: ViewListItemProps) {
  return (
    <li
      data-view-drag-item
      className={`${styles.viewsSidebarViewItem} ${isActive ? styles.viewsSidebarViewItemActive : ''} ${isRenaming ? styles.viewsSidebarViewItemRenaming : ''} ${isDragging ? styles.viewsSidebarViewItemDragging : ''}`}
      style={style}
      onClick={() => { if (!isRenaming && !isDragging) onSelect(view.id); }}
      onDoubleClick={() => onDoubleClick(view.id)}
    >
      <div className={styles.viewsSidebarViewItemRow}>
        <svg
          className={styles.viewsSidebarViewItemGridIcon}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M2.5 2C1.67157 2 1 2.67157 1 3.5V12.5C1 13.3284 1.67157 14 2.5 14H13.5C14.3284 14 15 13.3284 15 12.5V3.5C15 2.67157 14.3284 2 13.5 2H2.5ZM2 3.5C2 3.22386 2.22386 3 2.5 3H13.5C13.7761 3 14 3.22386 14 3.5V5H2V3.5ZM8.5 6H14V9H8.5V6ZM7.5 9V6H2V9H7.5ZM2 10V12.5C2 12.7761 2.22386 13 2.5 13H7.5V10H2ZM8.5 10H14V12.5C14 12.7761 13.7761 13 13.5 13H8.5V10Z" />
        </svg>

        <svg
          className={`${styles.viewsSidebarViewItemStarIcon} ${isFavorited ? styles.viewsSidebarViewItemStarIconFavorited : ''}`}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          style={{ shapeRendering: "geometricPrecision" }}
          onClick={(e) => { e.stopPropagation(); onFavoriteToggle(view.id); }}
        >
          {isFavorited ? (
            <path fillRule="nonzero" d="M7.99975 0.996094C7.57318 0.996128 7.18836 1.26571 7.04259 1.66663L5.67284 5.11548C5.66565 5.13431 5.66096 5.1378 5.65221 5.13831L1.96166 5.37598C1.51229 5.40516 1.16169 5.73277 1.04735 6.10218C0.933105 6.47128 1.03046 6.92969 1.37353 7.21521L4.19848 9.57142C4.21392 9.58422 4.21899 9.59964 4.21471 9.61707L3.37182 12.9387C3.2506 13.4131 3.44889 13.8848 3.78808 14.1426C4.12727 14.4004 4.64722 14.4608 5.06213 14.1968L7.99255 12.3412C7.99764 12.338 8.00161 12.3375 8.00671 12.3407L11.157 14.3408C11.5342 14.5789 12.0093 14.5257 12.3175 14.2924C12.6257 14.059 12.8055 13.6299 12.6971 13.2023L11.7853 9.61706C11.781 9.59967 11.786 9.58428 11.7998 9.57287L14.6261 7.21545C14.9694 6.92994 15.0669 6.4714 14.9526 6.10217C14.8383 5.73276 14.4881 5.40527 14.0387 5.37609L10.3508 5.13854C10.3389 5.13779 10.3343 5.13439 10.3313 5.12621L8.95213 1.65295C8.81167 1.26574 8.4264 0.996056 7.99975 0.996094Z" />
          ) : (
            <path fillRule="nonzero" d="M7.99975 0.996094C7.57318 0.996128 7.18836 1.26571 7.04259 1.66663L7.04784 1.65295L5.67284 5.11548C5.67142 5.119 5.67004 5.12254 5.66869 5.1261C5.66565 5.13431 5.66096 5.1378 5.65221 5.13831L5.64916 5.13855L1.96166 5.37598V5.37598C1.51229 5.40516 1.16169 5.73277 1.04735 6.10218C0.933105 6.47128 1.03046 6.92969 1.37353 7.21521L4.19848 9.57142L4.20007 9.57276C4.21392 9.58422 4.21899 9.59964 4.21471 9.61707V9.61707L3.37182 12.9387C3.2506 13.4131 3.44889 13.8848 3.78808 14.1426C4.12727 14.4004 4.64722 14.4608 5.06213 14.1968L7.99255 12.3412V12.3412C7.99764 12.338 8.00161 12.3375 8.00671 12.3407V12.3407L11.157 14.3408L11.1582 14.3417C11.5342 14.5789 12.0093 14.5257 12.3175 14.2924C12.6257 14.059 12.8055 13.6299 12.6971 13.2023V13.2023L11.7853 9.61706C11.781 9.59967 11.786 9.58428 11.7998 9.57287L11.8015 9.57141L14.6261 7.21545C14.9694 6.92994 15.0669 6.4714 14.9526 6.10217C14.8383 5.73276 14.4881 5.40527 14.0387 5.37609V5.37609L10.3508 5.13854L10.3476 5.1383C10.3389 5.13779 10.3343 5.13439 10.3313 5.12621C10.3299 5.12262 10.3286 5.11904 10.3271 5.11547L8.95213 1.65295L8.95738 1.66674C8.81167 1.26574 8.4264 0.996056 7.99975 0.996094ZM7.99987 1.99609V1.99609C8.00935 1.99609 8.01434 1.99939 8.01758 2.0083C8.01926 2.01292 8.02101 2.01752 8.02283 2.02209L9.39783 5.4845L9.39368 5.47375C9.53379 5.85173 9.88715 6.11327 10.2896 6.13672L13.9741 6.37402C14.006 6.37609 13.9898 6.37346 13.9973 6.39782C14.0048 6.42217 14.0118 6.42588 13.9868 6.44665L13.986 6.44728L11.1627 8.80214C10.8543 9.05717 10.7183 9.46962 10.8147 9.85805L10.8154 9.86073L11.7278 13.4478C11.7382 13.4889 11.7274 13.4848 11.7137 13.4951C11.7001 13.5055 11.722 13.5149 11.6918 13.4959L8.54296 11.4967C8.21256 11.2868 7.78728 11.2867 7.4569 11.4967V11.4967L4.52623 13.3525L4.52526 13.3532C4.45892 13.3954 4.43836 13.3808 4.39318 13.3465C4.34799 13.3121 4.31816 13.2744 4.34068 13.1863V13.1863L5.18468 9.86049L5.18529 9.8578C5.28156 9.46947 5.14573 9.05742 4.83752 8.80237L2.01403 6.44727L2.01318 6.44664C1.98816 6.42587 1.99514 6.42216 2.00268 6.39781C2.01021 6.37347 1.99424 6.37596 2.02612 6.37389L5.71337 6.13646L5.71032 6.13659C6.11276 6.11317 6.46615 5.85184 6.60632 5.47387L7.97717 2.02209C7.97898 2.01751 7.98073 2.01292 7.98242 2.00829C7.98567 1.99933 7.99034 1.99609 7.99987 1.99609Z" />
          )}
        </svg>

        {isRenaming ? (
          <>
            <input
              ref={sidebarRenameInputRef}
              type="text"
              className={styles.viewsSidebarViewItemRenameInput}
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); onRenameCommit(); }
                if (e.key === 'Escape') { e.preventDefault(); onRenameCancel(); }
              }}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            />
            {showDuplicateTooltip && sidebarRenameInputRef.current && createPortal(
              <div
                className={styles.viewRenameTooltipPortal}
                style={{
                  top: sidebarRenameInputRef.current.getBoundingClientRect().bottom,
                  left: sidebarRenameInputRef.current.getBoundingClientRect().left,
                }}
              >
                <div className={styles.viewRenameTooltipContent}>
                  Please enter a unique view name
                </div>
              </div>,
              document.body
            )}
          </>
        ) : (
          <span className={styles.viewsSidebarViewItemText}>{view.name}</span>
        )}

        <div className={styles.viewsSidebarViewItemActions}>
          <svg
            className={styles.viewsSidebarViewItemOverflowIcon}
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              if (isContextMenuOpen) {
                onContextMenuClose();
              } else {
                onContextMenuOpen(view.id, { top: rect.bottom + 4, left: rect.left - 40 });
              }
            }}
          >
            <path fillRule="nonzero" d="M5 8C5 8.55228 4.55228 9 4 9C3.44772 9 3 8.55228 3 8C3 7.44772 3.44772 7 4 7C4.55228 7 5 7.44772 5 8Z M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z M13 8C13 8.55228 12.5523 9 12 9C11.4477 9 11 8.55228 11 8C11 7.44772 11.4477 7 12 7C12.5523 7 13 7.44772 13 8Z" />
          </svg>

          <svg
            className={styles.viewsSidebarViewItemDragIcon}
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
            onMouseDown={(e) => onDragStart(e, index)}
            style={{ cursor: 'grab' }}
          >
            <path fillRule="nonzero" d="M5.75 4.5C6.16419 4.5 6.5 4.16419 6.5 3.75C6.5 3.33581 6.16419 3 5.75 3C5.33581 3 5 3.33581 5 3.75C5 4.16419 5.33581 4.5 5.75 4.5Z M10.25 4.5C10.6642 4.5 11 4.16419 11 3.75C11 3.33581 10.6642 3 10.25 3C9.83581 3 9.5 3.33581 9.5 3.75C9.5 4.16419 9.83581 4.5 10.25 4.5Z M5.75 8.75C6.16419 8.75 6.5 8.41419 6.5 8C6.5 7.58581 6.16419 7.25 5.75 7.25C5.33581 7.25 5 7.58581 5 8C5 8.41419 5.33581 8.75 5.75 8.75Z M10.25 8.75C10.6642 8.75 11 8.41419 11 8C11 7.58581 10.6642 7.25 10.25 7.25C9.83581 7.25 9.5 7.58581 9.5 8C9.5 8.41419 9.83581 8.75 10.25 8.75Z M5.75 13C6.16419 13 6.5 12.6642 6.5 12.25C6.5 11.8358 6.16419 11.5 5.75 11.5C5.33581 11.5 5 11.8358 5 12.25C5 12.6642 5.33581 13 5.75 13Z M10.25 13C10.6642 13 11 12.6642 11 12.25C11 11.8358 10.6642 11.5 10.25 11.5C9.83581 11.5 9.5 11.8358 9.5 12.25C9.5 12.6642 9.83581 13 10.25 13Z" />
          </svg>
        </div>
      </div>
    </li>
  );
}
