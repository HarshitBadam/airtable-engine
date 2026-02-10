import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './ViewsSidebar.module.css';

interface ViewsSidebarProps {
  // Sidebar state
  isViewsSidebarOpen: boolean;
  handleSidebarMouseEnter: () => void;
  handleSidebarMouseLeave: () => void;

  // Views data
  views: { id: string; name: string }[];
  activeViewId: string | null;
  setActiveViewId: (id: string) => void;
  favoritedViews: Set<string>;
  handleToggleViewFavorite: (viewId: string) => void;
  viewSearchQuery: string;
  setViewSearchQuery: (q: string) => void;
  canDeleteView: boolean;

  // Create new dropdown
  isCreateNewDropdownOpen: boolean;
  setIsCreateNewDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Create view box
  isCreateViewBoxOpen: boolean;
  setIsCreateViewBoxOpen: React.Dispatch<React.SetStateAction<boolean>>;
  createViewName: string;
  setCreateViewName: React.Dispatch<React.SetStateAction<string>>;
  computeNextViewName: () => string;
  createViewMut: { isPending: boolean; mutate: (args: { tableId: string; name: string; config: { search: string; filters: never[]; sort: null; hiddenColumnIds: never[] } }) => void };
  tableId: string;

  // Context menu
  contextMenuViewId: string | null;
  setContextMenuViewId: React.Dispatch<React.SetStateAction<string | null>>;
  contextMenuPosition: { top: number; left: number } | null;
  setContextMenuPosition: React.Dispatch<React.SetStateAction<{ top: number; left: number } | null>>;

  // Rename
  setRenameViewValue: (val: string) => void;
  setIsRenamingView: (val: boolean) => void;
  setIsViewDropdownOpen: (val: boolean) => void;

  // Delete
  deleteViewMut: { mutate: (args: { viewId: string }) => void };

  // Sidebar inline rename
  renamingSidebarViewId: string | null;
  sidebarRenameValue: string;
  setSidebarRenameValue: (val: string) => void;
  startSidebarRename: (viewId: string) => void;
  commitSidebarRename: () => void;
  cancelSidebarRename: () => void;
}

export function ViewsSidebar({
  isViewsSidebarOpen,
  handleSidebarMouseEnter,
  handleSidebarMouseLeave,
  views,
  activeViewId,
  setActiveViewId,
  favoritedViews,
  handleToggleViewFavorite,
  viewSearchQuery,
  setViewSearchQuery,
  canDeleteView,
  isCreateNewDropdownOpen,
  setIsCreateNewDropdownOpen,
  isCreateViewBoxOpen,
  setIsCreateViewBoxOpen,
  createViewName,
  setCreateViewName,
  computeNextViewName,
  createViewMut,
  tableId,
  contextMenuViewId,
  setContextMenuViewId,
  contextMenuPosition,
  setContextMenuPosition,
  setRenameViewValue,
  setIsRenamingView,
  setIsViewDropdownOpen,
  deleteViewMut,
  renamingSidebarViewId,
  sidebarRenameValue,
  setSidebarRenameValue,
  startSidebarRename,
  commitSidebarRename,
  cancelSidebarRename,
}: ViewsSidebarProps) {
  // refs
  const viewsSidebarRef = useRef<HTMLDivElement>(null);
  const createNewButtonRef = useRef<HTMLButtonElement>(null);
  const createNewDropdownRef = useRef<HTMLUListElement>(null);
  const createViewBoxRef = useRef<HTMLDivElement>(null);
  const createViewInputRef = useRef<HTMLInputElement>(null);
  const viewItemContextMenuRef = useRef<HTMLUListElement>(null);
  const sidebarRenameInputRef = useRef<HTMLInputElement>(null);

  // Click-outside for createNewDropdown
  useEffect(() => {
    if (!isCreateNewDropdownOpen) return;
    const handler = (event: MouseEvent) => {
      if (createNewDropdownRef.current && createNewDropdownRef.current.contains(event.target as Node)) return;
      if (createNewButtonRef.current && createNewButtonRef.current.contains(event.target as Node)) return;
      setIsCreateNewDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isCreateNewDropdownOpen]);

  // Click-outside for createViewBox
  useEffect(() => {
    if (!isCreateViewBoxOpen) return;
    const handler = (event: MouseEvent) => {
      if (createViewBoxRef.current && createViewBoxRef.current.contains(event.target as Node)) return;
      setIsCreateViewBoxOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isCreateViewBoxOpen]);

  // Click-outside for contextMenu
  useEffect(() => {
    if (!contextMenuViewId) return;
    const handler = (event: MouseEvent) => {
      if (viewItemContextMenuRef.current && viewItemContextMenuRef.current.contains(event.target as Node)) return;
      setContextMenuViewId(null);
      setContextMenuPosition(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenuViewId]);

  // Auto-focus create view input
  useEffect(() => {
    if (isCreateViewBoxOpen && createViewInputRef.current) {
      createViewInputRef.current.focus();
      createViewInputRef.current.select();
    }
  }, [isCreateViewBoxOpen]);

  // Auto-focus sidebar rename input
  useEffect(() => {
    if (renamingSidebarViewId && sidebarRenameInputRef.current) {
      sidebarRenameInputRef.current.focus();
      sidebarRenameInputRef.current.select();
    }
  }, [renamingSidebarViewId]);

  // Click-outside for sidebar rename
  useEffect(() => {
    if (!renamingSidebarViewId) return;
    const handler = (event: MouseEvent) => {
      if (sidebarRenameInputRef.current && sidebarRenameInputRef.current.contains(event.target as Node)) return;
      commitSidebarRename();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [renamingSidebarViewId, commitSidebarRename]);

  return (
    <div
      ref={viewsSidebarRef}
      className={`${styles.viewsSidebar} ${!isViewsSidebarOpen ? styles.viewsSidebarCollapsed : ''}`}
      onMouseEnter={handleSidebarMouseEnter}
      onMouseLeave={handleSidebarMouseLeave}
    >
      <div className={styles.viewsSidebarInner}>
      {/* "+ Create new..." button */}
      <button
        ref={createNewButtonRef}
        type="button"
        className={styles.viewsSidebarCreateButton}
        onClick={() => {
          setIsCreateNewDropdownOpen((prev) => !prev);
          setIsViewDropdownOpen(false);
        }}
      >
        <svg
          className={styles.viewsSidebarCreateButtonIcon}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="nonzero" d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z" />
        </svg>
        <span className={styles.viewsSidebarCreateButtonText}>Create new...</span>
      </button>

      {/* Create New Dropdown (rendered via portal to escape stacking contexts) */}
      {isCreateNewDropdownOpen && (() => {
        const rect = createNewButtonRef.current?.getBoundingClientRect();
        const dropdownStyle: React.CSSProperties = rect
          ? { top: rect.top, left: rect.right + 23 }
          : {};
        return createPortal(
        <ul ref={createNewDropdownRef} className={styles.createNewDropdownContainer} style={dropdownStyle}>
          {/* Grid */}
          <li
            className={styles.createNewDropdownItem}
            onClick={() => {
              setIsCreateNewDropdownOpen(false);
              setCreateViewName(computeNextViewName());
              setIsCreateViewBoxOpen(true);
            }}
          >
            <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#156EE1" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
              <path fillRule="evenodd" d="M2.5 2C1.67157 2 1 2.67157 1 3.5V12.5C1 13.3284 1.67157 14 2.5 14H13.5C14.3284 14 15 13.3284 15 12.5V3.5C15 2.67157 14.3284 2 13.5 2H2.5ZM2 3.5C2 3.22386 2.22386 3 2.5 3H13.5C13.7761 3 14 3.22386 14 3.5V5H2V3.5ZM8.5 6H14V9H8.5V6ZM7.5 9V6H2V9H7.5ZM2 10V12.5C2 12.7761 2.22386 13 2.5 13H7.5V10H2ZM8.5 10H14V12.5C14 12.7761 13.7761 13 13.5 13H8.5V10Z" />
            </svg>
            <span className={styles.createNewDropdownItemText}>Grid</span>
          </li>

          {/* Calendar */}
          <li className={styles.createNewDropdownItem}>
            <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#D54402" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
              <path fillRule="evenodd" d="M5.75 7.5C5.61739 7.5 5.49021 7.55268 5.39645 7.64645C5.30268 7.74021 5.25 7.86739 5.25 8C5.25 8.13261 5.30268 8.25979 5.39645 8.35355C5.49021 8.44732 5.61739 8.5 5.75 8.5H6.45972L6.10962 8.93762C6.05075 9.01123 6.01388 9.09999 6.00326 9.19365C5.99265 9.28731 6.00872 9.38206 6.04963 9.46698C6.09054 9.55189 6.15462 9.62352 6.23448 9.6736C6.31433 9.72367 6.40672 9.75016 6.50098 9.75C6.87529 9.74929 7.10696 10.0953 6.96375 10.4412C6.96379 10.4411 6.9637 10.4412 6.96375 10.4412C6.89965 10.5961 6.76358 10.7079 6.59912 10.7405C6.59916 10.7405 6.59908 10.7405 6.59912 10.7405C6.43467 10.7731 6.26622 10.7219 6.14782 10.6032C6.10146 10.5567 6.04638 10.5197 5.98575 10.4945C5.92512 10.4693 5.86011 10.4563 5.79445 10.4562C5.72878 10.4561 5.66374 10.4689 5.60304 10.494C5.54234 10.519 5.48716 10.5558 5.44067 10.6022C5.39417 10.6485 5.35726 10.7036 5.33204 10.7642C5.30683 10.8249 5.2938 10.8899 5.29371 10.9556C5.29362 11.0212 5.30646 11.0863 5.33151 11.147C5.35656 11.2077 5.39332 11.2628 5.43969 11.3093C5.79332 11.6639 6.30238 11.8188 6.79357 11.7213C7.28484 11.6239 7.6962 11.2865 7.88769 10.8237C8.17053 10.1406 7.88369 9.40065 7.32678 9.01697L7.89038 8.31238C7.9492 8.23883 7.98605 8.15017 7.9967 8.0566C8.00735 7.96303 7.99136 7.86835 7.95057 7.78347C7.90979 7.69858 7.84585 7.62694 7.76614 7.57679C7.68643 7.52665 7.59418 7.50003 7.5 7.5H5.75Z M10.0472 7.50232C9.92336 7.49052 9.79953 7.52534 9.69995 7.59998L8.69995 8.34997C8.64741 8.38937 8.60315 8.43874 8.56969 8.49524C8.53624 8.55175 8.51424 8.61429 8.50495 8.6793C8.49567 8.74431 8.49928 8.81051 8.51559 8.87413C8.53189 8.93774 8.56057 8.99752 8.59998 9.05005C8.63937 9.10259 8.68874 9.14685 8.74524 9.1803C8.80175 9.21376 8.86429 9.23576 8.9293 9.24505C8.99431 9.25433 9.06052 9.25072 9.12413 9.23441C9.18774 9.21811 9.24752 9.18943 9.30005 9.15002L9.5 9V11.25C9.5 11.3826 9.55268 11.5098 9.64645 11.6036C9.74021 11.6973 9.86739 11.75 10 11.75C10.1326 11.75 10.2598 11.6973 10.3536 11.6036C10.4473 11.5098 10.5 11.3826 10.5 11.25V8C10.5 7.87559 10.4536 7.75566 10.3698 7.66363C10.2861 7.5716 10.1711 7.51409 10.0472 7.50232Z M5 1C4.86739 1 4.74021 1.05268 4.64645 1.14645C4.55268 1.24021 4.5 1.36739 4.5 1.5V2H3C2.45364 2 2 2.45364 2 3V13C2 13.5464 2.45364 14 3 14H13C13.5464 14 14 13.5464 14 13V3C14 2.45364 13.5464 2 13 2H11.5V1.5C11.5 1.36739 11.4473 1.24021 11.3536 1.14645C11.2598 1.05268 11.1326 1 11 1C10.8674 1 10.7402 1.05268 10.6464 1.14645C10.5527 1.24021 10.5 1.36739 10.5 1.5V2H5.5V1.5C5.5 1.36739 5.44732 1.24021 5.35355 1.14645C5.25979 1.05268 5.13261 1 5 1ZM3 3H4.5V3.5C4.5 3.63261 4.55268 3.75979 4.64645 3.85355C4.74021 3.94732 4.86739 4 5 4C5.13261 4 5.25979 3.94732 5.35355 3.85355C5.44732 3.75979 5.5 3.63261 5.5 3.5V3H10.5V3.5C10.5 3.63261 10.5527 3.75979 10.6464 3.85355C10.7402 3.94732 10.8674 4 11 4C11.1326 4 11.2598 3.94732 11.3536 3.85355C11.4473 3.75979 11.5 3.63261 11.5 3.5V3H13V5H3V3ZM3 6H13V13H3V6Z" />
            </svg>
            <span className={styles.createNewDropdownItemText}>Calendar</span>
          </li>

          {/* Gallery */}
          <li className={styles.createNewDropdownItem}>
            <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#7D37EF" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
              <path fillRule="nonzero" d="M1.5 3.5C1.5 2.67157 2.17157 2 3 2H6C6.82843 2 7.5 2.67157 7.5 3.5V6C7.5 6.82843 6.82843 7.5 6 7.5H3C2.17157 7.5 1.5 6.82843 1.5 6V3.5ZM3 3C2.72386 3 2.5 3.22386 2.5 3.5V6C2.5 6.27614 2.72386 6.5 3 6.5H6C6.27614 6.5 6.5 6.27614 6.5 6V3.5C6.5 3.22386 6.27614 3 6 3H3Z M8.5 3.5C8.5 2.67157 9.17157 2 10 2H13C13.8284 2 14.5 2.67157 14.5 3.5V6C14.5 6.82843 13.8284 7.5 13 7.5H10C9.17157 7.5 8.5 6.82843 8.5 6V3.5ZM10 3C9.72386 3 9.5 3.22386 9.5 3.5V6C9.5 6.27614 9.72386 6.5 10 6.5H13C13.2761 6.5 13.5 6.27614 13.5 6V3.5C13.5 3.22386 13.2761 3 13 3H10Z M1.5 10C1.5 9.17157 2.17157 8.5 3 8.5H6C6.82843 8.5 7.5 9.17157 7.5 10V12.5C7.5 13.3284 6.82843 14 6 14H3C2.17157 14 1.5 13.3284 1.5 12.5V10ZM3 9.5C2.72386 9.5 2.5 9.72386 2.5 10V12.5C2.5 12.7761 2.72386 13 3 13H6C6.27614 13 6.5 12.7761 6.5 12.5V10C6.5 9.72386 6.27614 9.5 6 9.5H3Z M8.5 10C8.5 9.17157 9.17157 8.5 10 8.5H13C13.8284 8.5 14.5 9.17157 14.5 10V12.5C14.5 13.3284 13.8284 14 13 14H10C9.17157 14 8.5 13.3284 8.5 12.5V10ZM10 9.5C9.72386 9.5 9.5 9.72386 9.5 10V12.5C9.5 12.7761 9.72386 13 10 13H13C13.2761 13 13.5 12.7761 13.5 12.5V10C13.5 9.72386 13.2761 9.5 13 9.5H10Z" />
            </svg>
            <span className={styles.createNewDropdownItemText}>Gallery</span>
          </li>

          {/* Kanban */}
          <li className={styles.createNewDropdownItem}>
            <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#068A0D" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
              <path fillRule="nonzero" d="M1 3.5C1 2.67157 1.67157 2 2.5 2H13.5C14.3284 2 15 2.67157 15 3.5V9.5C15 10.3284 14.3284 11 13.5 11H11.5C11.3247 11 11.1564 10.9699 11 10.9146V12.5C11 13.3284 10.3284 14 9.5 14H6.5C5.67157 14 5 13.3284 5 12.5V7.91465C4.84361 7.96992 4.67532 8 4.5 8H2.5C1.67157 8 1 7.32843 1 6.5V3.5ZM6 12.5C6 12.7761 6.22386 13 6.5 13H9.5C9.77614 13 10 12.7761 10 12.5V3H6V12.5ZM5 3H2.5C2.22386 3 2 3.22386 2 3.5V6.5C2 6.77614 2.22386 7 2.5 7H4.5C4.77614 7 5 6.77614 5 6.5V3ZM11 3V9.5C11 9.77614 11.2239 10 11.5 10H13.5C13.7761 10 14 9.77614 14 9.5V3.5C14 3.22386 13.7761 3 13.5 3H11Z" />
            </svg>
            <span className={styles.createNewDropdownItemText}>Kanban</span>
          </li>

          {/* Timeline + Team badge */}
          <li className={styles.createNewDropdownItem} style={{ transform: 'translateY(1px)' }}>
            <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#DC043B" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision', transform: 'translateY(-0.5px)' }}>
              <path fillRule="evenodd" d="M9 0.5C9 0.223858 8.77614 0 8.5 0C8.22386 0 8 0.223858 8 0.5V15.5C8 15.7761 8.22386 16 8.5 16C8.77614 16 9 15.7761 9 15.5V14H11.5C12.3284 14 13 13.3284 13 12.5V10.5C13 9.67157 12.3284 9 11.5 9H9V7H14.5C15.3284 7 16 6.32843 16 5.5V3.5C16 2.67157 15.3284 2 14.5 2H9V0.5ZM9 3V6H14.5C14.7761 6 15 5.77614 15 5.5V3.5C15 3.22386 14.7761 3 14.5 3H9ZM9 10V13H11.5C11.7761 13 12 12.7761 12 12.5V10.5C12 10.2239 11.7761 10 11.5 10H9Z M4.5 2H7V3H4.5C4.22386 3 4 3.22386 4 3.5V5.5C4 5.77614 4.22386 6 4.5 6H7V7H4.5C3.67157 7 3 6.32843 3 5.5V3.5C3 2.67157 3.67157 2 4.5 2Z M7 9H1.5C0.671573 9 0 9.67157 0 10.5V12.5C0 13.3284 0.671573 14 1.5 14H7V13H1.5C1.22386 13 1 12.7761 1 12.5V10.5C1 10.2239 1.22386 10 1.5 10H7V9Z" />
            </svg>
            <span className={styles.createNewDropdownItemText}>
              Timeline
              <span className={styles.createNewDropdownTeamBadge}>
                <svg className={styles.createNewDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                </svg>
                Team
              </span>
            </span>
          </li>

          {/* List */}
          <li className={styles.createNewDropdownItem} style={{ transform: 'translateY(1px)' }}>
            <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#0D52AC" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
              <path fillRule="nonzero" d="M8.5 10C8.5 9.72386 8.72386 9.5 9 9.5H12C12.2761 9.5 12.5 9.72386 12.5 10C12.5 10.2761 12.2761 10.5 12 10.5H9C8.72386 10.5 8.5 10.2761 8.5 10Z M8.5 6.5C8.5 6.22386 8.72386 6 9 6H12C12.2761 6 12.5 6.22386 12.5 6.5C12.5 6.77614 12.2761 7 12 7H9C8.72386 7 8.5 6.77614 8.5 6.5Z M7.61756 5.16104C7.80477 5.36404 7.79196 5.68036 7.58896 5.86756L5.42021 7.86756C5.22853 8.04433 4.93319 8.04412 4.74176 7.86708L3.66051 6.86708C3.45778 6.67958 3.44543 6.36324 3.63292 6.16051C3.82042 5.95778 4.13676 5.94543 4.33949 6.13292L5.08174 6.8194L6.91104 5.13244C7.11404 4.94523 7.43036 4.95804 7.61756 5.16104Z M7.61756 8.66104C7.80477 8.86404 7.79196 9.18036 7.58896 9.36756L5.42021 11.3676C5.22853 11.5443 4.93319 11.5441 4.74176 11.3671L3.66051 10.3671C3.45778 10.1796 3.44543 9.86324 3.63292 9.66051C3.82042 9.45778 4.13676 9.44543 4.33949 9.63292L5.08174 10.3194L6.91104 8.63244C7.11404 8.44523 7.43036 8.45804 7.61756 8.66104Z M1 3.5C1 2.67157 1.67157 2 2.5 2H13.5C14.3284 2 15 2.67157 15 3.5V12.5C15 13.3284 14.3284 14 13.5 14H2.5C1.67157 14 1 13.3284 1 12.5V3.5ZM2.5 3C2.22386 3 2 3.22386 2 3.5V12.5C2 12.7761 2.22386 13 2.5 13H13.5C13.7761 13 14 12.7761 14 12.5V3.5C14 3.22386 13.7761 3 13.5 3H2.5Z" />
            </svg>
            <span className={styles.createNewDropdownItemText}>List</span>
          </li>

          {/* Gantt + Team badge */}
          <li className={styles.createNewDropdownItem} style={{ transform: 'translateY(2px)' }}>
            <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#0C7F78" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
              <path fillRule="nonzero" d="M0 3.5C0 2.67157 0.671573 2 1.5 2H11.5C12.3284 2 13 2.67157 13 3.5V5.5C13 6.32843 12.3284 7 11.5 7H4.5V10C4.5 10.5523 4.94771 11 5.5 11H7.5V10.5C7.5 9.67157 8.17157 9 9 9H14.5C15.3284 9 16 9.67157 16 10.5V12.5C16 13.3284 15.3284 14 14.5 14H9C8.17157 14 7.5 13.3284 7.5 12.5V12H5.5C4.39543 12 3.5 11.1046 3.5 10V7H1.5C0.671573 7 0 6.32843 0 5.5V3.5ZM8.5 12.5C8.5 12.7761 8.72386 13 9 13H14.5C14.7761 13 15 12.7761 15 12.5V10.5C15 10.2239 14.7761 10 14.5 10H9C8.72386 10 8.5 10.2239 8.5 10.5V12.5ZM1.5 3C1.22386 3 1 3.22386 1 3.5V5.5C1 5.77614 1.22386 6 1.5 6H11.5C11.7761 6 12 5.77614 12 5.5V3.5C12 3.22386 11.7761 3 11.5 3H1.5Z" />
            </svg>
            <span className={styles.createNewDropdownItemText}>
              Gantt
              <span className={styles.createNewDropdownTeamBadge}>
                <svg className={styles.createNewDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                </svg>
                Team
              </span>
            </span>
          </li>

          {/* Divider 1 */}
          <li className={styles.createNewDropdownDivider} aria-hidden="true" style={{ transform: 'translateY(2px)' }} />

          {/* Form */}
          <li className={styles.createNewDropdownItem} style={{ transform: 'translateY(2px)' }}>
            <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#DD04A8" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
              <path fillRule="nonzero" d="M4.5 6.5C4.5 6.22386 4.72386 6 5 6H7.5C7.77614 6 8 6.22386 8 6.5C8 6.77614 7.77614 7 7.5 7H5C4.72386 7 4.5 6.77614 4.5 6.5Z M5.5 8C4.67157 8 4 8.67157 4 9.5C4 10.3284 4.67157 11 5.5 11H10.5C11.3284 11 12 10.3284 12 9.5C12 8.67157 11.3284 8 10.5 8H5.5ZM5 9.5C5 9.22386 5.22386 9 5.5 9H10.5C10.7761 9 11 9.22386 11 9.5C11 9.77614 10.7761 10 10.5 10H5.5C5.22386 10 5 9.77614 5 9.5Z M1 3.5C1 2.67157 1.67157 2 2.5 2H13.5C14.3284 2 15 2.67157 15 3.5V12.5C15 13.3284 14.3284 14 13.5 14H2.5C1.67157 14 1 13.3284 1 12.5V3.5ZM2.5 3C2.22386 3 2 3.22386 2 3.5V12.5C2 12.7761 2.22386 13 2.5 13H13.5C13.7761 13 14 12.7761 14 12.5V3.5C14 3.22386 13.7761 3 13.5 3H2.5Z" />
            </svg>
            <span className={styles.createNewDropdownItemText}>Form</span>
          </li>

          {/* Divider 2 */}
          <li className={styles.createNewDropdownDivider} aria-hidden="true" style={{ transform: 'translateY(2px)' }} />

          {/* Section + Team badge */}
          <li className={styles.createNewDropdownItem} style={{ transform: 'translateY(3px)' }}>
            <svg className={styles.createNewDropdownItemIcon} viewBox="0 0 16 16" fill="#1D1F25" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision', transform: 'translateY(-0.5px)' }}>
              <path fillRule="nonzero" d="M1 3.5C1 2.67157 1.67157 2 2.5 2H13.5C14.3284 2 15 2.67157 15 3.5V12.5C15 13.3284 14.3284 14 13.5 14H2.5C1.67157 14 1 13.3284 1 12.5V3.5ZM2.5 3C2.22386 3 2 3.22386 2 3.5V5.5L14 5.5V3.5C14 3.22386 13.7761 3 13.5 3H2.5ZM2 10.5L2 12.5C2 12.7761 2.22386 13 2.5 13H13.5C13.7761 13 14 12.7761 14 12.5V10.5L2 10.5ZM2 6.5L2 9.5L14 9.5V6.5L2 6.5Z" />
            </svg>
            <span className={styles.createNewDropdownItemText}>
              Section
              <span className={styles.createNewDropdownTeamBadge}>
                <svg className={styles.createNewDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                </svg>
                Team
              </span>
            </span>
          </li>
        </ul>,
        document.body
        );
      })()}

      {/* Create View Box (rendered via portal) */}
      {isCreateViewBoxOpen && (() => {
        const rect = createNewButtonRef.current?.getBoundingClientRect();
        const boxStyle: React.CSSProperties = rect
          ? { top: rect.top, left: rect.right + 23 }
          : {};
        return createPortal(
          <div ref={createViewBoxRef} className={styles.createViewBoxContainer} style={boxStyle}>
            {/* Name input section */}
            <div className={styles.createViewBoxInputSection}>
              <input
                ref={createViewInputRef}
                type="text"
                className={styles.createViewBoxInput}
                value={createViewName}
                onChange={(e) => setCreateViewName(e.target.value)}
              />
            </div>

            {/* "Who can edit" label */}
            <div className={styles.createViewBoxWhoCanEditLabel}>Who can edit</div>

            {/* Three options container */}
            <ul className={styles.createViewBoxOptionsContainer}>
              {/* Option 1: Collaborative (selected) */}
              <li className={styles.createViewBoxOption} style={{ marginRight: 16 }}>
                {/* Radio circle (selected) */}
                <div className={styles.createViewBoxRadioCircleSelected}>
                  <div className={styles.createViewBoxRadioDot} />
                </div>
                {/* UsersThree icon */}
                <svg className={styles.createViewBoxOptionIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                  <path fillRule="nonzero" d="M3.68726 2.76918C3.00369 2.77619 2.31788 3.05605 1.8208 3.65761C0.919321 4.74857 1.17576 6.24775 2.08557 7.09572C1.40673 7.38504 0.802933 7.84404 0.349488 8.4507C0.310181 8.50329 0.281619 8.56312 0.265432 8.62675C0.249245 8.69038 0.24575 8.75658 0.255147 8.82157C0.264544 8.88656 0.286648 8.94905 0.320199 9.00549C0.353749 9.06194 0.398088 9.11122 0.450684 9.15053C0.503281 9.18983 0.563104 9.21839 0.626738 9.23458C0.690373 9.25077 0.756572 9.25426 0.821558 9.24487C0.886543 9.23547 0.949041 9.21337 1.00548 9.17981C1.06193 9.14626 1.11121 9.10193 1.15051 9.04933C1.76315 8.2297 2.72586 7.74834 3.74915 7.75001C3.74907 7.75005 3.74923 7.74997 3.74915 7.75001C3.74953 7.75001 3.75011 7.75001 3.75049 7.75001C3.87664 7.74769 3.99725 7.69777 4.08814 7.61024C4.09539 7.60337 4.10243 7.59629 4.10925 7.589C4.19691 7.49831 4.24706 7.37783 4.24963 7.25172C4.24951 7.252 4.24976 7.25144 4.24963 7.25172C4.24959 7.25147 4.24992 7.25038 4.24988 7.25013C4.24984 7.25034 4.24992 7.24993 4.24988 7.25013C4.24976 7.24984 4.24976 7.24894 4.24963 7.24865C4.24718 7.12237 4.19703 7.0017 4.10925 6.91088C4.10254 6.90377 4.09562 6.89685 4.0885 6.89013C3.99767 6.80248 3.87706 6.75243 3.75086 6.75001C3.75044 6.75001 3.75005 6.75014 3.74963 6.75014C3.74967 6.75018 3.74959 6.7501 3.74963 6.75014C2.44509 6.75147 1.76078 5.30012 2.59168 4.29457C3.42258 3.28902 4.97671 3.68735 5.22131 4.96876C5.23363 5.03326 5.25853 5.09471 5.29459 5.14958C5.33066 5.20446 5.37718 5.25169 5.4315 5.28859C5.48582 5.32549 5.54687 5.35132 5.61118 5.36462C5.67548 5.37792 5.74178 5.37843 5.80628 5.3661C5.93651 5.34123 6.05154 5.26564 6.12605 5.15596C6.20057 5.04629 6.22847 4.91151 6.20361 4.78126C5.95974 3.50367 4.82653 2.7575 3.68726 2.76918Z M12.3127 2.76918C11.1735 2.7575 10.0403 3.50367 9.79639 4.78126C9.77154 4.91151 9.79943 5.04629 9.87395 5.15596C9.94846 5.26564 10.0635 5.34123 10.1937 5.3661C10.2582 5.37843 10.3245 5.37792 10.3888 5.36462C10.4531 5.35132 10.5142 5.32549 10.5685 5.28859C10.6228 5.25169 10.6693 5.20446 10.7054 5.14958C10.7415 5.09471 10.7664 5.03326 10.7787 4.96876C11.0233 3.68735 12.5774 3.28902 13.4083 4.29457C14.2392 5.30012 13.555 6.75134 12.2505 6.75001C12.2505 6.74997 12.2504 6.75005 12.2505 6.75001C12.25 6.75001 12.2496 6.75001 12.2491 6.75001C12.1871 6.76292 12.1282 6.78748 12.0753 6.8224C12.0115 6.83534 11.9508 6.86064 11.8966 6.89686C11.8603 6.95112 11.835 7.01196 11.8221 7.07594C11.7873 7.12872 11.7629 7.18762 11.75 7.24952C11.75 7.24931 11.7501 7.24973 11.75 7.24952C11.75 7.24976 11.7501 7.25064 11.75 7.25088C11.7629 7.31289 11.7875 7.37187 11.8224 7.42471C11.8353 7.48856 11.8606 7.54927 11.8969 7.60342C11.9511 7.63969 12.0119 7.66499 12.0759 7.67788C12.1287 7.71269 12.1876 7.73717 12.2495 7.75003C12.2499 7.75003 12.2502 7.7499 12.2506 7.7499C12.2505 7.74986 12.2507 7.74994 12.2506 7.7499C13.2738 7.7481 14.237 8.22964 14.8495 9.04934C14.8888 9.10194 14.9381 9.14628 14.9945 9.17983C15.051 9.21338 15.1135 9.23548 15.1785 9.24488C15.2434 9.25428 15.3096 9.25078 15.3733 9.2346C15.4369 9.21841 15.4967 9.18985 15.5493 9.15054C15.6019 9.11123 15.6463 9.06195 15.6798 9.00551C15.7134 8.94907 15.7355 8.88657 15.7449 8.82158C15.7543 8.7566 15.7508 8.6904 15.7346 8.62676C15.7184 8.56313 15.6898 8.50331 15.6505 8.45071C15.1971 7.844 14.5934 7.38493 13.9146 7.09561C14.8243 6.24762 15.0806 4.74853 14.1792 3.65762C13.6821 3.05606 12.9962 2.77619 12.3127 2.76918Z M8 5.75001C6.34908 5.75001 5 7.0991 5 8.75001C5 9.72266 5.47549 10.5819 6.19788 11.1309C5.23485 11.5518 4.42849 12.3022 3.95068 13.2808C3.92187 13.3398 3.90497 13.4039 3.90093 13.4694C3.8969 13.535 3.90582 13.6007 3.92717 13.6628C3.94853 13.7249 3.98191 13.7821 4.0254 13.8313C4.0689 13.8805 4.12165 13.9207 4.18067 13.9495C4.29982 14.0076 4.4372 14.0161 4.56258 13.9729C4.68796 13.9298 4.79107 13.8386 4.84924 13.7195C5.43767 12.5144 6.65894 11.7517 8 11.7517C9.34106 11.7517 10.5623 12.5144 11.1508 13.7195C11.2089 13.8386 11.312 13.9298 11.4374 13.9729C11.5628 14.0161 11.7002 14.0076 11.8193 13.9495C11.8783 13.9207 11.9311 13.8805 11.9746 13.8313C12.0181 13.7821 12.0515 13.7249 12.0728 13.6628C12.0942 13.6007 12.1031 13.535 12.0991 13.4694C12.095 13.4039 12.0781 13.3398 12.0493 13.2808C11.5715 12.3022 10.7652 11.5518 9.80212 11.1309C10.5245 10.5819 11 9.72266 11 8.75001C11 7.0991 9.65092 5.75001 8 5.75001ZM8 6.75001C9.11046 6.75001 10 7.63956 10 8.75001C10 9.86047 9.11046 10.75 8 10.75C6.88955 10.75 6 9.86047 6 8.75001C6 7.63956 6.88955 6.75001 8 6.75001Z" />
                </svg>
                {/* Text */}
                <span className={styles.createViewBoxOptionText} style={{ marginRight: 4 }}>Collaborative</span>
              </li>

              {/* Option 2: Personal */}
              <li className={styles.createViewBoxOption} style={{ marginRight: 16 }}>
                {/* Radio circle (unselected) */}
                <div className={styles.createViewBoxRadioCircle} />
                {/* User icon */}
                <svg className={styles.createViewBoxOptionIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                  <path fillRule="nonzero" d="M8 9.49951C5.32109 9.49957 2.84382 10.93 1.50451 13.2501C1.43822 13.365 1.42025 13.5014 1.45457 13.6295C1.48888 13.7576 1.57267 13.8668 1.6875 13.9331C1.80235 13.9994 1.93883 14.0173 2.06691 13.983C2.195 13.9487 2.30419 13.8648 2.37048 13.75C3.53197 11.738 5.67677 10.4996 8 10.4995C10.3232 10.4995 12.4681 11.7379 13.6295 13.75C13.6958 13.8648 13.805 13.9487 13.9331 13.983C14.0612 14.0173 14.1976 13.9994 14.3125 13.9331C14.4273 13.8668 14.5111 13.7576 14.5454 13.6295C14.5797 13.5014 14.5618 13.365 14.4955 13.2501C13.1563 10.9299 10.679 9.49944 8 9.49951Z M8 1.5C5.52065 1.5 3.5 3.52065 3.5 6C3.5 8.47935 5.52065 10.4995 8 10.4995C10.4793 10.4995 12.5 8.47935 12.5 6C12.5 3.52065 10.4793 1.5 8 1.5ZM8 2.5C9.9389 2.5 11.5 4.0611 11.5 6C11.5 7.9389 9.9389 9.49951 8 9.49951C6.0611 9.49951 4.5 7.9389 4.5 6C4.5 4.0611 6.0611 2.5 8 2.5Z" />
                </svg>
                {/* Text */}
                <span className={styles.createViewBoxOptionText} style={{ marginRight: 4 }}>Personal</span>
                {/* Upsell star */}
                <svg className={styles.createViewBoxUpsellStar} viewBox="0 0 16 16" fill="rgb(22, 110, 225)" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                  <path fillRule="nonzero" d="M9.84928 11.9396C9.96786 12.0088 10.106 12.0487 10.2443 12.0496C10.4026 12.0486 10.5606 11.9986 10.6893 11.8996C10.9293 11.7196 11.0393 11.3996 10.9693 11.1096L10.4293 8.98961L12.0993 7.59961C12.3393 7.40961 12.4293 7.07961 12.3393 6.78961C12.2393 6.48961 11.9793 6.27961 11.6693 6.25961L9.49928 6.11961L8.68928 4.07961C8.58928 3.78961 8.29928 3.59961 7.99928 3.59961C7.69928 3.59961 7.41928 3.78961 7.30928 4.07961L6.49928 6.11961L4.32928 6.25961C4.01928 6.27961 3.74928 6.48961 3.65928 6.78961C3.56928 7.07961 3.66928 7.40961 3.89928 7.59961L5.55928 8.98961L5.05928 10.9496C4.97928 11.2696 5.09928 11.6096 5.35928 11.8096C5.62928 12.0096 5.99928 12.0296 6.27928 11.8496L7.99928 10.7596L9.84928 11.9396ZM8.40928 9.98961C8.28928 9.91961 8.14928 9.87961 8.00928 9.87961V9.88961C7.86928 9.88961 7.72928 9.91961 7.60928 9.99961L5.92928 11.0596L6.41928 9.13961C6.48928 8.85961 6.38928 8.54961 6.16928 8.36961L4.64928 7.09961L6.62928 6.96961C6.91928 6.94961 7.17928 6.75961 7.27928 6.48961L8.00928 4.64961L8.73928 6.48961C8.83928 6.76961 9.09928 6.94961 9.38928 6.96961L11.3693 7.09961L9.84928 8.36961C9.61928 8.54961 9.51928 8.84961 9.58928 9.10961L10.0893 11.0596L8.40928 9.98961Z M7.99999 1C4.134 1 0.999992 4.13401 0.999992 8C0.999992 11.866 4.134 15 7.99999 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 7.99999 1ZM1.99999 8C1.99999 4.68629 4.68628 2 7.99999 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 7.99999 14C4.68628 14 1.99999 11.3137 1.99999 8Z" />
                </svg>
              </li>

              {/* Option 3: Locked */}
              <li className={styles.createViewBoxOption} style={{ marginRight: 16 }}>
                {/* Radio circle (unselected) */}
                <div className={styles.createViewBoxRadioCircle} />
                {/* Lock icon */}
                <svg className={styles.createViewBoxOptionIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                  <path fillRule="nonzero" d="M8 10.25C8.41419 10.25 8.75 9.91419 8.75 9.5C8.75 9.08581 8.41419 8.75 8 8.75C7.58581 8.75 7.25 9.08581 7.25 9.5C7.25 9.91419 7.58581 10.25 8 10.25Z M8 0.5C6.48714 0.5 5.25 1.73714 5.25 3.25V5H3C2.45364 5 2 5.45364 2 6V13C2 13.5464 2.45364 14 3 14H13C13.5464 14 14 13.5464 14 13V6C14 5.45364 13.5464 5 13 5H10.75V3.25C10.75 1.73714 9.51286 0.5 8 0.5ZM8 1.5C8.97242 1.5 9.75 2.27758 9.75 3.25V5H6.25V3.25C6.25 2.27758 7.02758 1.5 8 1.5ZM3 6H13V13H3V6Z" />
                </svg>
                {/* Text */}
                <span className={styles.createViewBoxOptionText} style={{ marginRight: 4 }}>Locked</span>
                {/* Upsell star */}
                <svg className={styles.createViewBoxUpsellStar} viewBox="0 0 16 16" fill="rgb(22, 110, 225)" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                  <path fillRule="nonzero" d="M9.84928 11.9396C9.96786 12.0088 10.106 12.0487 10.2443 12.0496C10.4026 12.0486 10.5606 11.9986 10.6893 11.8996C10.9293 11.7196 11.0393 11.3996 10.9693 11.1096L10.4293 8.98961L12.0993 7.59961C12.3393 7.40961 12.4293 7.07961 12.3393 6.78961C12.2393 6.48961 11.9793 6.27961 11.6693 6.25961L9.49928 6.11961L8.68928 4.07961C8.58928 3.78961 8.29928 3.59961 7.99928 3.59961C7.69928 3.59961 7.41928 3.78961 7.30928 4.07961L6.49928 6.11961L4.32928 6.25961C4.01928 6.27961 3.74928 6.48961 3.65928 6.78961C3.56928 7.07961 3.66928 7.40961 3.89928 7.59961L5.55928 8.98961L5.05928 10.9496C4.97928 11.2696 5.09928 11.6096 5.35928 11.8096C5.62928 12.0096 5.99928 12.0296 6.27928 11.8496L7.99928 10.7596L9.84928 11.9396ZM8.40928 9.98961C8.28928 9.91961 8.14928 9.87961 8.00928 9.87961V9.88961C7.86928 9.88961 7.72928 9.91961 7.60928 9.99961L5.92928 11.0596L6.41928 9.13961C6.48928 8.85961 6.38928 8.54961 6.16928 8.36961L4.64928 7.09961L6.62928 6.96961C6.91928 6.94961 7.17928 6.75961 7.27928 6.48961L8.00928 4.64961L8.73928 6.48961C8.83928 6.76961 9.09928 6.94961 9.38928 6.96961L11.3693 7.09961L9.84928 8.36961C9.61928 8.54961 9.51928 8.84961 9.58928 9.10961L10.0893 11.0596L8.40928 9.98961Z M7.99999 1C4.134 1 0.999992 4.13401 0.999992 8C0.999992 11.866 4.134 15 7.99999 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 7.99999 1ZM1.99999 8C1.99999 4.68629 4.68628 2 7.99999 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 7.99999 14C4.68628 14 1.99999 11.3137 1.99999 8Z" />
                </svg>
              </li>
            </ul>

            {/* Description text */}
            <div className={styles.createViewBoxDescription}>All collaborators can edit the configuration</div>

            {/* Buttons container */}
            <div className={styles.createViewBoxButtonsContainer}>
              <button
                type="button"
                className={styles.createViewBoxCancelButton}
                onClick={() => setIsCreateViewBoxOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.createViewBoxCreateButton}
                disabled={createViewMut.isPending || !createViewName.trim()}
                onClick={() => {
                  if (createViewName.trim()) {
                    createViewMut.mutate({
                      tableId,
                      name: createViewName.trim(),
                      config: { search: '', filters: [], sort: null, hiddenColumnIds: [] },
                    });
                  }
                }}
              >
                {createViewMut.isPending ? 'Creating...' : 'Create new view'}
              </button>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* "Find a view" search bar */}
      <div className={styles.viewsSidebarSearchWrapper}>
        <svg
          className={styles.viewsSidebarSearchIcon}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="nonzero" d="M7.25 1.5C4.08028 1.5 1.5 4.08028 1.5 7.25C1.5 10.4197 4.08028 13 7.25 13C8.65529 13 9.94315 12.4911 10.9432 11.6503L13.6465 14.3534C13.7402 14.4471 13.8674 14.4998 14 14.4998C14.1326 14.4998 14.2598 14.4471 14.3535 14.3534C14.4473 14.2596 14.4999 14.1325 14.4999 13.9999C14.4999 13.8673 14.4473 13.7401 14.3535 13.6464L11.6504 10.9431C12.4912 9.94305 13 8.65523 13 7.25C13 4.08028 10.4197 1.5 7.25 1.5ZM7.25 2.5C9.87928 2.5 12 4.62072 12 7.25C12 8.56227 11.4715 9.74761 10.6154 10.6061C10.6132 10.607 10.611 10.6079 10.6089 10.6088C10.608 10.611 10.6071 10.6132 10.6062 10.6154C9.74772 11.4715 8.5623 12 7.25 12C4.62072 12 2.5 9.87928 2.5 7.25C2.5 4.62072 4.62072 2.5 7.25 2.5Z" />
        </svg>
        <input
          type="text"
          className={styles.viewsSidebarSearchInput}
          placeholder="Find a view"
          value={viewSearchQuery}
          onChange={(e) => setViewSearchQuery(e.target.value)}
        />
      </div>

      {/* View items list */}
      <ul className={styles.viewsSidebarViewList}>
        {views
          .filter(v => !viewSearchQuery || v.name.toLowerCase().includes(viewSearchQuery.toLowerCase()))
          .map((view) => (
          <li
            key={view.id}
            className={`${styles.viewsSidebarViewItem} ${view.id === activeViewId ? styles.viewsSidebarViewItemActive : ''} ${view.id === renamingSidebarViewId ? styles.viewsSidebarViewItemRenaming : ''}`}
            onClick={() => { if (renamingSidebarViewId !== view.id) setActiveViewId(view.id); }}
            onDoubleClick={() => startSidebarRename(view.id)}
          >
            <div className={styles.viewsSidebarViewItemRow}>
              {/* Grid Feature icon (shown by default, hidden on hover) */}
              <svg
                className={styles.viewsSidebarViewItemGridIcon}
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path fillRule="evenodd" d="M2.5 2C1.67157 2 1 2.67157 1 3.5V12.5C1 13.3284 1.67157 14 2.5 14H13.5C14.3284 14 15 13.3284 15 12.5V3.5C15 2.67157 14.3284 2 13.5 2H2.5ZM2 3.5C2 3.22386 2.22386 3 2.5 3H13.5C13.7761 3 14 3.22386 14 3.5V5H2V3.5ZM8.5 6H14V9H8.5V6ZM7.5 9V6H2V9H7.5ZM2 10V12.5C2 12.7761 2.22386 13 2.5 13H7.5V10H2ZM8.5 10H14V12.5C14 12.7761 13.7761 13 13.5 13H8.5V10Z" />
              </svg>

              {/* Star icon (hidden by default, shown on hover) */}
              <svg
                className={`${styles.viewsSidebarViewItemStarIcon} ${favoritedViews.has(view.id) ? styles.viewsSidebarViewItemStarIconFavorited : ''}`}
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
                style={{ shapeRendering: "geometricPrecision" }}
                onClick={(e) => { e.stopPropagation(); handleToggleViewFavorite(view.id); }}
              >
                {favoritedViews.has(view.id) ? (
                  <path fillRule="nonzero" d="M7.99975 0.996094C7.57318 0.996128 7.18836 1.26571 7.04259 1.66663L5.67284 5.11548C5.66565 5.13431 5.66096 5.1378 5.65221 5.13831L1.96166 5.37598C1.51229 5.40516 1.16169 5.73277 1.04735 6.10218C0.933105 6.47128 1.03046 6.92969 1.37353 7.21521L4.19848 9.57142C4.21392 9.58422 4.21899 9.59964 4.21471 9.61707L3.37182 12.9387C3.2506 13.4131 3.44889 13.8848 3.78808 14.1426C4.12727 14.4004 4.64722 14.4608 5.06213 14.1968L7.99255 12.3412C7.99764 12.338 8.00161 12.3375 8.00671 12.3407L11.157 14.3408C11.5342 14.5789 12.0093 14.5257 12.3175 14.2924C12.6257 14.059 12.8055 13.6299 12.6971 13.2023L11.7853 9.61706C11.781 9.59967 11.786 9.58428 11.7998 9.57287L14.6261 7.21545C14.9694 6.92994 15.0669 6.4714 14.9526 6.10217C14.8383 5.73276 14.4881 5.40527 14.0387 5.37609L10.3508 5.13854C10.3389 5.13779 10.3343 5.13439 10.3313 5.12621L8.95213 1.65295C8.81167 1.26574 8.4264 0.996056 7.99975 0.996094Z" />
                ) : (
                  <path fillRule="nonzero" d="M7.99975 0.996094C7.57318 0.996128 7.18836 1.26571 7.04259 1.66663L7.04784 1.65295L5.67284 5.11548C5.67142 5.119 5.67004 5.12254 5.66869 5.1261C5.66565 5.13431 5.66096 5.1378 5.65221 5.13831L5.64916 5.13855L1.96166 5.37598V5.37598C1.51229 5.40516 1.16169 5.73277 1.04735 6.10218C0.933105 6.47128 1.03046 6.92969 1.37353 7.21521L4.19848 9.57142L4.20007 9.57276C4.21392 9.58422 4.21899 9.59964 4.21471 9.61707V9.61707L3.37182 12.9387C3.2506 13.4131 3.44889 13.8848 3.78808 14.1426C4.12727 14.4004 4.64722 14.4608 5.06213 14.1968L7.99255 12.3412V12.3412C7.99764 12.338 8.00161 12.3375 8.00671 12.3407V12.3407L11.157 14.3408L11.1582 14.3417C11.5342 14.5789 12.0093 14.5257 12.3175 14.2924C12.6257 14.059 12.8055 13.6299 12.6971 13.2023V13.2023L11.7853 9.61706C11.781 9.59967 11.786 9.58428 11.7998 9.57287L11.8015 9.57141L14.6261 7.21545C14.9694 6.92994 15.0669 6.4714 14.9526 6.10217C14.8383 5.73276 14.4881 5.40527 14.0387 5.37609V5.37609L10.3508 5.13854L10.3476 5.1383C10.3389 5.13779 10.3343 5.13439 10.3313 5.12621C10.3299 5.12262 10.3286 5.11904 10.3271 5.11547L8.95213 1.65295L8.95738 1.66674C8.81167 1.26574 8.4264 0.996056 7.99975 0.996094ZM7.99987 1.99609V1.99609C8.00935 1.99609 8.01434 1.99939 8.01758 2.0083C8.01926 2.01292 8.02101 2.01752 8.02283 2.02209L9.39783 5.4845L9.39368 5.47375C9.53379 5.85173 9.88715 6.11327 10.2896 6.13672L13.9741 6.37402C14.006 6.37609 13.9898 6.37346 13.9973 6.39782C14.0048 6.42217 14.0118 6.42588 13.9868 6.44665L13.986 6.44728L11.1627 8.80214C10.8543 9.05717 10.7183 9.46962 10.8147 9.85805L10.8154 9.86073L11.7278 13.4478C11.7382 13.4889 11.7274 13.4848 11.7137 13.4951C11.7001 13.5055 11.722 13.5149 11.6918 13.4959L8.54296 11.4967C8.21256 11.2868 7.78728 11.2867 7.4569 11.4967V11.4967L4.52623 13.3525L4.52526 13.3532C4.45892 13.3954 4.43836 13.3808 4.39318 13.3465C4.34799 13.3121 4.31816 13.2744 4.34068 13.1863V13.1863L5.18468 9.86049L5.18529 9.8578C5.28156 9.46947 5.14573 9.05742 4.83752 8.80237L2.01403 6.44727L2.01318 6.44664C1.98816 6.42587 1.99514 6.42216 2.00268 6.39781C2.01021 6.37347 1.99424 6.37596 2.02612 6.37389L5.71337 6.13646L5.71032 6.13659C6.11276 6.11317 6.46615 5.85184 6.60632 5.47387L7.97717 2.02209C7.97898 2.01751 7.98073 2.01292 7.98242 2.00829C7.98567 1.99933 7.99034 1.99609 7.99987 1.99609Z" />
                )}
              </svg>

              {/* View name text OR inline rename input */}
              {renamingSidebarViewId === view.id ? (
                <input
                  ref={sidebarRenameInputRef}
                  type="text"
                  className={styles.viewsSidebarViewItemRenameInput}
                  value={sidebarRenameValue}
                  onChange={(e) => setSidebarRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitSidebarRename(); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelSidebarRename(); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className={styles.viewsSidebarViewItemText}>{view.name}</span>
              )}

              {/* Actions (shown on hover, hidden when renaming) */}
              <div className={styles.viewsSidebarViewItemActions}>
                {/* Overflow (three dots) icon */}
                <svg
                  className={styles.viewsSidebarViewItemOverflowIcon}
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    if (contextMenuViewId === view.id) {
                      setContextMenuViewId(null);
                      setContextMenuPosition(null);
                    } else {
                      setContextMenuViewId(view.id);
                      setContextMenuPosition({ top: rect.bottom + 4, left: rect.left - 40 });
                    }
                  }}
                >
                  <path fillRule="nonzero" d="M5 8C5 8.55228 4.55228 9 4 9C3.44772 9 3 8.55228 3 8C3 7.44772 3.44772 7 4 7C4.55228 7 5 7.44772 5 8Z M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z M13 8C13 8.55228 12.5523 9 12 9C11.4477 9 11 8.55228 11 8C11 7.44772 11.4477 7 12 7C12.5523 7 13 7.44772 13 8Z" />
                </svg>

                {/* DotsSixVertical (drag handle) icon */}
                <svg
                  className={styles.viewsSidebarViewItemDragIcon}
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path fillRule="nonzero" d="M5.75 4.5C6.16419 4.5 6.5 4.16419 6.5 3.75C6.5 3.33581 6.16419 3 5.75 3C5.33581 3 5 3.33581 5 3.75C5 4.16419 5.33581 4.5 5.75 4.5Z M10.25 4.5C10.6642 4.5 11 4.16419 11 3.75C11 3.33581 10.6642 3 10.25 3C9.83581 3 9.5 3.33581 9.5 3.75C9.5 4.16419 9.83581 4.5 10.25 4.5Z M5.75 8.75C6.16419 8.75 6.5 8.41419 6.5 8C6.5 7.58581 6.16419 7.25 5.75 7.25C5.33581 7.25 5 7.58581 5 8C5 8.41419 5.33581 8.75 5.75 8.75Z M10.25 8.75C10.6642 8.75 11 8.41419 11 8C11 7.58581 10.6642 7.25 10.25 7.25C9.83581 7.25 9.5 7.58581 9.5 8C9.5 8.41419 9.83581 8.75 10.25 8.75Z M5.75 13C6.16419 13 6.5 12.6642 6.5 12.25C6.5 11.8358 6.16419 11.5 5.75 11.5C5.33581 11.5 5 11.8358 5 12.25C5 12.6642 5.33581 13 5.75 13Z M10.25 13C10.6642 13 11 12.6642 11 12.25C11 11.8358 10.6642 11.5 10.25 11.5C9.83581 11.5 9.5 11.8358 9.5 12.25C9.5 12.6642 9.83581 13 10.25 13Z" />
                </svg>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* View Item Context Menu (rendered via portal) */}
      {contextMenuViewId && contextMenuPosition && (() => {
        const menuStyle: React.CSSProperties = {
          top: contextMenuPosition.top,
          left: contextMenuPosition.left,
        };
        return createPortal(
          <ul ref={viewItemContextMenuRef} className={styles.viewItemContextMenuContainer} style={menuStyle} onClick={(e) => e.stopPropagation()}>
            {/* Add to 'My favorites' */}
            <li className={styles.viewItemContextMenuItem}>
              {/* Star icon */}
              <svg className={styles.viewItemContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
                <path fillRule="nonzero" d="M7.99975 0.996094C7.57318 0.996128 7.18836 1.26571 7.04259 1.66663L7.04784 1.65295L5.67284 5.11548C5.67142 5.119 5.67004 5.12254 5.66869 5.1261C5.66565 5.13431 5.66096 5.1378 5.65221 5.13831L5.64916 5.13855L1.96166 5.37598V5.37598C1.51229 5.40516 1.16169 5.73277 1.04735 6.10218C0.933105 6.47128 1.03046 6.92969 1.37353 7.21521L4.19848 9.57142L4.20007 9.57276C4.21392 9.58422 4.21899 9.59964 4.21471 9.61707V9.61707L3.37182 12.9387C3.2506 13.4131 3.44889 13.8848 3.78808 14.1426C4.12727 14.4004 4.64722 14.4608 5.06213 14.1968L7.99255 12.3412V12.3412C7.99764 12.338 8.00161 12.3375 8.00671 12.3407V12.3407L11.157 14.3408L11.1582 14.3417C11.5342 14.5789 12.0093 14.5257 12.3175 14.2924C12.6257 14.059 12.8055 13.6299 12.6971 13.2023V13.2023L11.7853 9.61706C11.781 9.59967 11.786 9.58428 11.7998 9.57287L11.8015 9.57141L14.6261 7.21545C14.9694 6.92994 15.0669 6.4714 14.9526 6.10217C14.8383 5.73276 14.4881 5.40527 14.0387 5.37609V5.37609L10.3508 5.13854L10.3476 5.1383C10.3389 5.13779 10.3343 5.13439 10.3313 5.12621C10.3299 5.12262 10.3286 5.11904 10.3271 5.11547L8.95213 1.65295L8.95738 1.66674C8.81167 1.26574 8.4264 0.996056 7.99975 0.996094ZM7.99987 1.99609V1.99609C8.00935 1.99609 8.01434 1.99939 8.01758 2.0083C8.01926 2.01292 8.02101 2.01752 8.02283 2.02209L9.39783 5.4845L9.39368 5.47375C9.53379 5.85173 9.88715 6.11327 10.2896 6.13672L13.9741 6.37402C14.006 6.37609 13.9898 6.37346 13.9973 6.39782C14.0048 6.42217 14.0118 6.42588 13.9868 6.44665L13.986 6.44728L11.1627 8.80214C10.8543 9.05717 10.7183 9.46962 10.8147 9.85805L10.8154 9.86073L11.7278 13.4478C11.7382 13.4889 11.7274 13.4848 11.7137 13.4951C11.7001 13.5055 11.722 13.5149 11.6918 13.4959L8.54296 11.4967C8.21256 11.2868 7.78728 11.2867 7.4569 11.4967V11.4967L4.52623 13.3525L4.52526 13.3532C4.45892 13.3954 4.43836 13.3808 4.39318 13.3465C4.34799 13.3121 4.31816 13.2744 4.34068 13.1863V13.1863L5.18468 9.86049L5.18529 9.8578C5.28156 9.46947 5.14573 9.05742 4.83752 8.80237L2.01403 6.44727L2.01318 6.44664C1.98816 6.42587 1.99514 6.42216 2.00268 6.39781C2.01021 6.37347 1.99424 6.37596 2.02612 6.37389L5.71337 6.13646L5.71032 6.13659C6.11276 6.11317 6.46615 5.85184 6.60632 5.47387L7.97717 2.02209C7.97898 2.01751 7.98073 2.01292 7.98242 2.00829C7.98567 1.99933 7.99034 1.99609 7.99987 1.99609Z" />
              </svg>
              {/* Text + Team badge container */}
              <div className={styles.viewItemContextMenuFavContainer}>
                <span className={styles.viewItemContextMenuFavText}>Add to &apos;My favorites&apos;</span>
                {/* Team badge */}
                <span className={styles.createNewDropdownTeamBadge} style={{ marginLeft: 0, transform: 'translate(-8px, 0px)' }}>
                  <svg className={styles.createNewDropdownTeamBadgeIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path fillRule="nonzero" d="M9.00026 1.17993C9.11617 1.06472 9.27338 1 9.4373 1C9.60123 1 9.75844 1.06472 9.87435 1.17993C9.99026 1.29514 10.0554 1.4514 10.0554 1.61433V2.843H11.2915C11.4555 2.843 11.6127 2.90772 11.7286 3.02293C11.8445 3.13814 11.9096 3.2944 11.9096 3.45733C11.9096 3.62026 11.8445 3.77652 11.7286 3.89173C11.6127 4.00694 11.4555 4.07167 11.2915 4.07167H10.0554V5.30033C10.0554 5.46326 9.99026 5.61952 9.87435 5.73473C9.75844 5.84994 9.60123 5.91467 9.4373 5.91467C9.27338 5.91467 9.11617 5.84994 9.00026 5.73473C8.88435 5.61952 8.81923 5.46326 8.81923 5.30033V4.07167H7.58307C7.41915 4.07167 7.26194 4.00694 7.14603 3.89173C7.03011 3.77652 6.965 3.62026 6.965 3.45733C6.965 3.2944 7.03011 3.13814 7.14603 3.02293C7.26194 2.90772 7.41915 2.843 7.58307 2.843H8.81923V1.61433C8.81923 1.4514 8.88435 1.29514 9.00026 1.17993Z M12.7087 5.48027C12.8246 5.36506 12.9818 5.30033 13.1458 5.30033C13.3097 5.30033 13.4669 5.36506 13.5828 5.48027C13.6987 5.59548 13.7638 5.75173 13.7638 5.91467V6.529H14.3819C14.5458 6.529 14.7031 6.59372 14.819 6.70893C14.9349 6.82414 15 6.9804 15 7.14333C15 7.30626 14.9349 7.46252 14.819 7.57773C14.7031 7.69294 14.5458 7.75767 14.3819 7.75767H13.7638V8.372C13.7638 8.53493 13.6987 8.69119 13.5828 8.8064C13.4669 8.92161 13.3097 8.98633 13.1458 8.98633C12.9818 8.98633 12.8246 8.92161 12.7087 8.8064C12.5928 8.69119 12.5277 8.53493 12.5277 8.372V7.75767H11.9096C11.7457 7.75767 11.5885 7.69294 11.4726 7.57773C11.3567 7.46252 11.2915 7.30626 11.2915 7.14333C11.2915 6.9804 11.3567 6.82414 11.4726 6.70893C11.5885 6.59372 11.7457 6.529 11.9096 6.529H12.5277V5.91467C12.5277 5.75173 12.5928 5.59548 12.7087 5.48027Z M5.51799 6.69319L1.74576 8.24464C1.53598 8.33092 1.53815 8.62708 1.74924 8.71024L5.53727 10.2033C5.87011 10.3345 6.24077 10.3345 6.57355 10.2033L10.3616 8.71024C10.5727 8.62708 10.5749 8.33092 10.3651 8.24464L6.59289 6.69319C6.24872 6.55165 5.8621 6.55165 5.51799 6.69319Z M6.39149 14.7485V11.0186C6.39149 10.9156 6.45474 10.8231 6.55105 10.7851L10.7721 9.15666C10.9379 9.09129 11.1179 9.21277 11.1179 9.39017V13.1201C11.1179 13.2231 11.0547 13.3156 10.9584 13.3536L6.73737 14.9821C6.57146 15.0474 6.39149 14.9259 6.39149 14.7485Z M5.40585 11.2111L4.02596 11.8734L1.38158 13.1328C1.21395 13.2132 1 13.0917 1 12.9067V9.40585C1 9.33888 1.03454 9.28108 1.08087 9.23753C1.1002 9.21826 1.1221 9.2024 1.14486 9.18984C1.20806 9.15215 1.29819 9.14209 1.37483 9.17221L5.38481 10.7514C5.58863 10.8318 5.60464 11.1157 5.40585 11.2111Z" />
                  </svg>
                  Team
                </span>
              </div>
            </li>

            {/* Separator */}
            <li className={styles.viewItemContextMenuSeparator} />

            {/* Rename view */}
            <li
              className={styles.viewItemContextMenuItem}
              onClick={() => {
                if (contextMenuViewId) {
                  startSidebarRename(contextMenuViewId);
                }
              }}
            >
              <svg className={styles.viewItemContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M10.5 1.71045C10.2406 1.71045 9.9813 1.80867 9.7876 2.00525L2.29017 9.50269L2.28931 9.50354C2.10332 9.69048 1.9991 9.94419 2.00001 10.2079V12.9999C2.00007 13.5462 2.45358 13.9998 2.99988 13.9999H5.79212C6.05578 14.0008 6.30942 13.8966 6.49635 13.7107L6.49732 13.7097L13.9948 6.21228C14.3878 5.82489 14.3878 5.17499 13.9948 4.7876L11.2124 2.00525C11.0187 1.80867 10.7594 1.71045 10.5 1.71045ZM10.4999 2.70715C10.4955 2.70269 10.5043 2.70269 10.4999 2.70715L10.5027 2.70972L13.2902 5.49719L13.2927 5.49976C13.2972 5.49534 13.2972 5.50418 13.2927 5.49976L13.2902 5.50269L12 6.79297L9.20704 4L10.4973 2.70972L10.4999 2.70715ZM8.50001 4.70703L11.293 7.5L5.79297 12.9999H3.00013L3.00001 10.207L8.50001 4.70703Z" />
              </svg>
              <span className={styles.viewItemContextMenuItemText}>Rename view</span>
            </li>

            {/* Duplicate view */}
            <li className={styles.viewItemContextMenuItem} style={{ transform: 'translateY(-1px)' }}>
              <svg className={styles.viewItemContextMenuItemIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M2.5 5C2.3674 5.00001 2.24023 5.0527 2.14646 5.14646C2.0527 5.24023 2.00001 5.3674 2 5.5V13.5C2.00001 13.6326 2.0527 13.7598 2.14646 13.8535C2.24023 13.9473 2.3674 14 2.5 14H10.5C10.6326 14 10.7598 13.9473 10.8535 13.8535C10.9473 13.7598 11 13.6326 11 13.5V5.5C11 5.3674 10.9473 5.24023 10.8535 5.14646C10.7598 5.0527 10.6326 5.00001 10.5 5H2.5ZM3 6H10V13H3V6Z M5.5 2C5.3674 2.00001 5.24023 2.0527 5.14646 2.14646C5.0527 2.24023 5.00001 2.3674 5 2.5V5.5C5 5.63261 5.05268 5.75979 5.14645 5.85355C5.24021 5.94732 5.36739 6 5.5 6C5.63261 6 5.75979 5.94732 5.85355 5.85355C5.94732 5.75979 6 5.63261 6 5.5V3H13V10H10.5C10.3674 10 10.2402 10.0527 10.1464 10.1464C10.0527 10.2402 10 10.3674 10 10.5C10 10.6326 10.0527 10.7598 10.1464 10.8536C10.2402 10.9473 10.3674 11 10.5 11H13.5C13.6326 11 13.7598 10.9473 13.8535 10.8535C13.9473 10.7598 14 10.6326 14 10.5V2.5C14 2.3674 13.9473 2.24023 13.8535 2.14646C13.7598 2.0527 13.6326 2.00001 13.5 2H5.5Z" />
              </svg>
              <span className={styles.viewItemContextMenuItemText}>Duplicate view</span>
            </li>

            {/* Delete view */}
            <li
              className={styles.viewItemContextMenuItem}
              style={canDeleteView ? { cursor: 'pointer', transform: 'translateY(-2px)' } : { opacity: 0.5, cursor: 'default', transform: 'translateY(-2px)' }}
              onClick={() => {
                if (canDeleteView && contextMenuViewId) {
                  deleteViewMut.mutate({ viewId: contextMenuViewId });
                }
              }}
            >
              <svg className={styles.viewItemContextMenuDeleteIcon} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "geometricPrecision" }}>
                <path fillRule="nonzero" d="M6.5 6C6.36739 6 6.24021 6.05268 6.14645 6.14645C6.05268 6.24021 6 6.36739 6 6.5V10.5C6 10.6326 6.05268 10.7598 6.14645 10.8536C6.24021 10.9473 6.36739 11 6.5 11C6.63261 11 6.75979 10.9473 6.85355 10.8536C6.94732 10.7598 7 10.6326 7 10.5V6.5C7 6.36739 6.94732 6.24021 6.85355 6.14645C6.75979 6.05268 6.63261 6 6.5 6Z M9.5 6C9.36739 6 9.24021 6.05268 9.14645 6.14645C9.05268 6.24021 9 6.36739 9 6.5V10.5C9 10.6326 9.05268 10.7598 9.14645 10.8536C9.24021 10.9473 9.36739 11 9.5 11C9.63261 11 9.75979 10.9473 9.85355 10.8536C9.94732 10.7598 10 10.6326 10 10.5V6.5C10 6.36739 9.94732 6.24021 9.85355 6.14645C9.75979 6.05268 9.63261 6 9.5 6Z M6.5 1C5.6775 1 5 1.6775 5 2.5V3H2.5C2.36739 3 2.24021 3.05268 2.14645 3.14645C2.05268 3.24021 2 3.36739 2 3.5C2 3.63261 2.05268 3.75979 2.14645 3.85355C2.24021 3.94732 2.36739 4 2.5 4H3V13C3.00007 13.5463 3.45357 13.9999 3.99988 14H12C12.5464 14 13 13.5464 13 13V4H13.5C13.6326 4 13.7598 3.94732 13.8536 3.85355C13.9473 3.75979 14 3.63261 14 3.5C14 3.36739 13.9473 3.24021 13.8536 3.14645C13.7598 3.05268 13.6326 3 13.5 3H11V2.5C11 1.6775 10.3225 1 9.5 1H6.5ZM6.5 2H9.5C9.78214 2 10 2.21786 10 2.5V3H6V2.5C6 2.21786 6.21786 2 6.5 2ZM4 4H12V13H4V4Z" />
              </svg>
              <span className={styles.viewItemContextMenuDeleteText}>Delete view</span>
            </li>
          </ul>,
          document.body
        );
      })()}

      </div>{/* end viewsSidebarInner */}
    </div>
  );
}
