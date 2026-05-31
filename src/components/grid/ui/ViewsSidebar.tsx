import React, { useRef, useEffect } from 'react';
import styles from './ViewsSidebar.module.css';
import { useGridStore } from '~/components/grid/GridStore';
import { useWorkspace } from './GridWorkspaceContext';
import { ViewListItem } from './ViewListItem';
import { CreateViewDropdown } from './CreateViewDropdown';
import { CreateViewForm } from './CreateViewForm';
import { useViewsDragDrop } from '../hooks/views/useViewsDragDrop';
import { ViewContextMenu } from './ViewContextMenu';

interface ViewsSidebarProps {
  tableId: string;
  onReorderViews?: (orderedViewIds: string[]) => void;
}

export function ViewsSidebar({ tableId, onReorderViews }: ViewsSidebarProps) {
  const {
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
    contextMenuViewId,
    setContextMenuViewId,
    contextMenuPosition,
    setContextMenuPosition,
    setIsViewDropdownOpen,
    deleteViewMut,
    renamingSidebarViewId,
    sidebarRenameValue,
    setSidebarRenameValue,
    startSidebarRename,
    commitSidebarRename,
    cancelSidebarRename,
    showDuplicateViewTooltip,
  } = useWorkspace();

  const parentColumnOrderIds = useGridStore((s) => s.columnOrderIds);
  const parentPermanentSorts = useGridStore((s) => s.permanentSorts);
  const parentRowOrderIds = useGridStore((s) => s.rowOrderIds);

  const viewsSidebarRef = useRef<HTMLDivElement>(null);
  const createNewButtonRef = useRef<HTMLButtonElement>(null);
  const createNewDropdownRef = useRef<HTMLUListElement>(null);
  const createViewBoxRef = useRef<HTMLDivElement>(null);
  const createViewInputRef = useRef<HTMLInputElement>(null);
  const sidebarRenameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isCreateNewDropdownOpen) return;
    const handler = (event: MouseEvent) => {
      if (createNewDropdownRef.current?.contains(event.target as Node)) return;
      if (createNewButtonRef.current?.contains(event.target as Node)) return;
      setIsCreateNewDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isCreateNewDropdownOpen]);

  useEffect(() => {
    if (!isCreateViewBoxOpen) return;
    const handler = (event: MouseEvent) => {
      if (createViewBoxRef.current?.contains(event.target as Node)) return;
      setIsCreateViewBoxOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isCreateViewBoxOpen]);

  useEffect(() => {
    if (isCreateViewBoxOpen && createViewInputRef.current) {
      createViewInputRef.current.focus();
      createViewInputRef.current.select();
    }
  }, [isCreateViewBoxOpen]);

  useEffect(() => {
    if (renamingSidebarViewId && sidebarRenameInputRef.current) {
      sidebarRenameInputRef.current.focus();
      sidebarRenameInputRef.current.select();
    }
  }, [renamingSidebarViewId]);

  useEffect(() => {
    if (!renamingSidebarViewId) return;
    const handler = (event: MouseEvent) => {
      if (sidebarRenameInputRef.current?.contains(event.target as Node)) return;
      commitSidebarRename();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [renamingSidebarViewId, commitSidebarRename]);

  const { viewListRef, orderedViews, dragActiveIndex, handleDragStart, getItemTransform } =
    useViewsDragDrop(views, viewSearchQuery, onReorderViews);

  const handleSubmitCreateView = () => {
    if (createViewName.trim() && !views.some((v) => v.name === createViewName.trim())) {
      createViewMut.mutate({
        tableId,
        name: createViewName.trim(),
        config: {
          search: '',
          filters: [],
          sorts: [],
          permanentSorts: parentPermanentSorts,
          autoSort: true,
          hiddenColumnIds: [],
          columnOrderIds: parentColumnOrderIds,
          rowOrderIds: parentRowOrderIds,
        },
      });
    }
  };

  return (
    <div
      ref={viewsSidebarRef}
      className={`${styles.viewsSidebar} ${!isViewsSidebarOpen ? styles.viewsSidebarCollapsed : ''}`}
      onMouseEnter={handleSidebarMouseEnter}
      onMouseLeave={handleSidebarMouseLeave}
    >
      <div className={styles.viewsSidebarInner}>
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

        {isCreateNewDropdownOpen && (() => {
          const rect = createNewButtonRef.current?.getBoundingClientRect();
          const dropdownStyle: React.CSSProperties = rect ? { top: rect.top, left: rect.right + 23 } : {};
          return (
            <CreateViewDropdown
              dropdownRef={createNewDropdownRef}
              style={dropdownStyle}
              onSelectGrid={() => {
                setIsCreateNewDropdownOpen(false);
                setCreateViewName(computeNextViewName());
                setIsCreateViewBoxOpen(true);
              }}
            />
          );
        })()}

        {isCreateViewBoxOpen && (() => {
          const rect = createNewButtonRef.current?.getBoundingClientRect();
          const boxStyle: React.CSSProperties = rect ? { top: rect.top, left: rect.right + 23 } : {};
          return (
            <CreateViewForm
              formRef={createViewBoxRef}
              inputRef={createViewInputRef}
              style={boxStyle}
              viewName={createViewName}
              onViewNameChange={setCreateViewName}
              existingViewNames={views.map((v) => v.name)}
              isPending={createViewMut.isPending}
              onCancel={() => setIsCreateViewBoxOpen(false)}
              onSubmit={handleSubmitCreateView}
            />
          );
        })()}

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

        <ul className={styles.viewsSidebarViewList} ref={viewListRef}>
          {orderedViews.map((view, viewIndex) => (
            <ViewListItem
              key={view.id}
              view={view}
              index={viewIndex}
              isActive={view.id === activeViewId}
              isRenaming={renamingSidebarViewId === view.id}
              sidebarRenameInputRef={sidebarRenameInputRef}
              renameValue={sidebarRenameValue}
              onRenameChange={setSidebarRenameValue}
              onRenameCommit={commitSidebarRename}
              onRenameCancel={cancelSidebarRename}
              showDuplicateTooltip={showDuplicateViewTooltip}
              isFavorited={favoritedViews.has(view.id)}
              onFavoriteToggle={handleToggleViewFavorite}
              onSelect={setActiveViewId}
              onDoubleClick={startSidebarRename}
              isDragging={dragActiveIndex === viewIndex}
              style={getItemTransform(viewIndex)}
              onDragStart={handleDragStart}
              isContextMenuOpen={contextMenuViewId === view.id}
              onContextMenuOpen={(viewId, position) => {
                setContextMenuViewId(viewId);
                setContextMenuPosition(position);
              }}
              onContextMenuClose={() => {
                setContextMenuViewId(null);
                setContextMenuPosition(null);
              }}
            />
          ))}
        </ul>

        {contextMenuViewId && contextMenuPosition && (
          <ViewContextMenu
            position={contextMenuPosition}
            canDelete={canDeleteView}
            onRename={() => { if (contextMenuViewId) startSidebarRename(contextMenuViewId); }}
            onDelete={() => {
              if (canDeleteView && contextMenuViewId) deleteViewMut.mutate({ viewId: contextMenuViewId });
            }}
            onClose={() => {
              setContextMenuViewId(null);
              setContextMenuPosition(null);
            }}
          />
        )}

      </div>
    </div>
  );
}
