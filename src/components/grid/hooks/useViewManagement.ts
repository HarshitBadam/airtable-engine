"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { skipToken } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import { useGridStore } from "~/components/grid/GridStore";
import { normalizeViewConfig } from "~/shared/grid";
import { reconcileColumnOrder } from "~/components/grid/utils/reconcileColumnOrder";
import type { GridColumnDef } from "~/components/grid/ui/GridRow";

interface UseViewManagementProps {
  tableId: string;
  isValidTable: boolean;
  columns: GridColumnDef[];
  utils: ReturnType<typeof api.useUtils>;
}

export function useViewManagement({ tableId, isValidTable, columns, utils }: UseViewManagementProps) {
  const viewsQ = api.view.list.useQuery(
    isValidTable ? { tableId } : skipToken,
    { staleTime: 60_000 },
  );
  const views = viewsQ.data ?? [];

  const [activeViewId, setActiveViewIdRaw] = useState<string | null>(null);

  const setActiveViewId = useCallback((id: string | null) => {
    setActiveViewIdRaw(id);
    if (id) localStorage.setItem(`table-lastView-${tableId}`, id);
  }, [tableId]);

  useEffect(() => {
    if (views.length === 0) return;
    const activeExists = activeViewId && views.some(v => v.id === activeViewId);
    if (!activeExists) {
      const lastViewId = localStorage.getItem(`table-lastView-${tableId}`);
      const preferred = lastViewId && views.some(v => v.id === lastViewId) ? lastViewId : views[0]!.id;
      setActiveViewIdRaw(preferred);
    }
  }, [views, activeViewId, tableId]);

  const activeView = views.find(v => v.id === activeViewId);
  const activeViewName = activeView?.name ?? 'Grid view';
  const canDeleteView = views.length > 1;

  const storeActiveViewId = useGridStore((s) => s.activeViewId);
  const initializeFromView = useGridStore((s) => s.initializeFromView);

  useEffect(() => {
    if (!activeViewId || views.length === 0) return;
    if (storeActiveViewId === activeViewId) return;
    const view = views.find(v => v.id === activeViewId);
    if (!view) return;
    const config = normalizeViewConfig(view.config);
    const tableColumnIds = columns.map((c) => c.id);
    const reconciledConfig = tableColumnIds.length > 0
      ? reconcileColumnOrder(config, tableColumnIds)
      : config;
    initializeFromView(activeViewId, reconciledConfig);
  }, [activeViewId, views, columns, storeActiveViewId, initializeFromView]);

  const computeNextViewName = () => {
    const existingNames = new Set(views.map(v => v.name));
    let num = 2;
    while (existingNames.has(`Grid ${num}`)) num++;
    return `Grid ${num}`;
  };

  const [isCreateViewBoxOpen, setIsCreateViewBoxOpen] = useState(false);
  const [createViewName, setCreateViewName] = useState('Grid 2');

  const createViewMut = api.view.create.useMutation({
    onSuccess: (newView) => {
      utils.view.list.setData({ tableId }, (old) => {
        if (!old) return undefined;
        if (old.some((v) => v.id === newView.id)) return old;
        return [...old, { ...newView, createdAt: new Date(), updatedAt: new Date(), ranksStale: true }];
      });
      setActiveViewId(newView.id);
      setIsCreateViewBoxOpen(false);
      void utils.view.list.invalidate({ tableId });
    },
  });

  const [showViewLoadingSpinner, setShowViewLoadingSpinner] = useState(false);
  useEffect(() => {
    if (createViewMut.isPending) {
      const timer = setTimeout(() => setShowViewLoadingSpinner(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShowViewLoadingSpinner(false);
    }
  }, [createViewMut.isPending]);

  const deleteViewMut = api.view.delete.useMutation({
    onSuccess: () => {
      void utils.view.list.invalidate({ tableId });
      setIsViewDropdownOpen(false);
      setContextMenuViewId(null);
    },
  });

  const renameViewMut = api.view.update.useMutation({
    onSuccess: () => { void utils.view.list.invalidate({ tableId }); },
  });

  const viewDropdownRef = useRef<HTMLUListElement>(null);
  const viewDropdownButtonRef = useRef<HTMLDivElement>(null);
  const renameViewInputRef = useRef<HTMLInputElement>(null);

  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);

  const [isViewsSidebarOpen, setIsViewsSidebarOpen] = useState(false);
  const [isViewsSidebarPinned, setIsViewsSidebarPinned] = useState(false);
  const [viewSearchQuery, setViewSearchQuery] = useState('');
  const [favoritedViews, setFavoritedViews] = useState<Set<string>>(new Set());
  const [isCreateNewDropdownOpen, setIsCreateNewDropdownOpen] = useState(false);
  const viewsSidebarCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contextMenuViewId, setContextMenuViewId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const [isRenamingView, setIsRenamingView] = useState(false);
  const [renameViewValue, setRenameViewValue] = useState('');

  const [renamingSidebarViewId, setRenamingSidebarViewId] = useState<string | null>(null);
  const [sidebarRenameValue, setSidebarRenameValue] = useState('');

  const [showDuplicateViewTooltip, setShowDuplicateViewTooltip] = useState(false);
  const duplicateViewTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isViewDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (viewDropdownRef.current?.contains(event.target as Node)) return;
      if (viewDropdownButtonRef.current?.contains(event.target as Node)) return;
      setIsViewDropdownOpen(false);
    }
    const timeoutId = setTimeout(() => { document.addEventListener("mousedown", handleClickOutside); }, 10);
    return () => { clearTimeout(timeoutId); document.removeEventListener("mousedown", handleClickOutside); };
  }, [isViewDropdownOpen]);

  useEffect(() => {
    if (isRenamingView && renameViewInputRef.current) {
      renameViewInputRef.current.focus();
      renameViewInputRef.current.select();
    }
  }, [isRenamingView]);

  const clearSidebarCollapseTimer = useCallback(() => {
    if (viewsSidebarCollapseTimerRef.current) {
      clearTimeout(viewsSidebarCollapseTimerRef.current);
      viewsSidebarCollapseTimerRef.current = null;
    }
  }, []);

  const startSidebarCollapseTimer = useCallback(() => {
    if (isViewsSidebarPinned) return;
    clearSidebarCollapseTimer();
    viewsSidebarCollapseTimerRef.current = setTimeout(() => {
      if (isCreateNewDropdownOpen || isCreateViewBoxOpen || contextMenuViewId) return;
      setIsViewsSidebarOpen(false);
    }, 500);
  }, [isViewsSidebarPinned, isCreateNewDropdownOpen, isCreateViewBoxOpen, contextMenuViewId, clearSidebarCollapseTimer]);

  const handleToggleViewsSidebar = useCallback(() => {
    clearSidebarCollapseTimer();
    if (isViewsSidebarOpen && isViewsSidebarPinned) {
      setIsViewsSidebarOpen(false);
      setIsViewsSidebarPinned(false);
    } else if (isViewsSidebarOpen && !isViewsSidebarPinned) {
      setIsViewsSidebarPinned(true);
    } else {
      setIsViewsSidebarOpen(true);
      setIsViewsSidebarPinned(true);
    }
  }, [clearSidebarCollapseTimer, isViewsSidebarOpen, isViewsSidebarPinned]);

  const handleListButtonMouseEnter = useCallback(() => {
    if (!isViewsSidebarOpen) {
      clearSidebarCollapseTimer();
      setIsViewsSidebarOpen(true);
      setIsViewsSidebarPinned(false);
    } else {
      clearSidebarCollapseTimer();
    }
  }, [clearSidebarCollapseTimer, isViewsSidebarOpen]);

  const handleListButtonMouseLeave = useCallback(() => {
    startSidebarCollapseTimer();
  }, [startSidebarCollapseTimer]);

  const handleSidebarMouseEnter = useCallback(() => {
    clearSidebarCollapseTimer();
  }, [clearSidebarCollapseTimer]);

  const handleSidebarMouseLeave = useCallback(() => {
    startSidebarCollapseTimer();
  }, [startSidebarCollapseTimer]);

  const handleToggleViewFavorite = (viewId: string) => {
    setFavoritedViews(prev => {
      const next = new Set(prev);
      if (next.has(viewId)) { next.delete(viewId); } else { next.add(viewId); }
      return next;
    });
  };

  const startRenamingView = () => {
    setRenameViewValue(activeViewName);
    setIsRenamingView(true);
    setIsViewDropdownOpen(false);
    setIsCreateNewDropdownOpen(false);
    setContextMenuViewId(null);
    setContextMenuPosition(null);
  };

  const commitRenameView = () => {
    const trimmed = renameViewValue.trim();
    if (!trimmed || !activeViewId) { setIsRenamingView(false); return; }
    if (trimmed === activeViewName) { setIsRenamingView(false); setShowDuplicateViewTooltip(false); return; }
    const isDuplicate = views.some(v => v.id !== activeViewId && v.name === trimmed);
    if (isDuplicate) {
      setShowDuplicateViewTooltip(true);
      if (duplicateViewTooltipTimerRef.current) clearTimeout(duplicateViewTooltipTimerRef.current);
      duplicateViewTooltipTimerRef.current = setTimeout(() => setShowDuplicateViewTooltip(false), 10000);
      return;
    }
    setShowDuplicateViewTooltip(false);
    if (duplicateViewTooltipTimerRef.current) clearTimeout(duplicateViewTooltipTimerRef.current);
    renameViewMut.mutate({ viewId: activeViewId, name: trimmed });
    setIsRenamingView(false);
  };

  const cancelRenameView = () => {
    setIsRenamingView(false);
    setShowDuplicateViewTooltip(false);
    if (duplicateViewTooltipTimerRef.current) clearTimeout(duplicateViewTooltipTimerRef.current);
  };

  const startSidebarRename = useCallback((viewId: string) => {
    const view = views.find(v => v.id === viewId);
    if (view) {
      setRenamingSidebarViewId(viewId);
      setSidebarRenameValue(view.name);
      setContextMenuViewId(null);
      setContextMenuPosition(null);
      setIsCreateNewDropdownOpen(false);
    }
  }, [views]);

  const commitSidebarRename = useCallback(() => {
    const trimmed = sidebarRenameValue.trim();
    if (!trimmed || !renamingSidebarViewId) { setRenamingSidebarViewId(null); return; }
    const view = views.find(v => v.id === renamingSidebarViewId);
    if (trimmed === view?.name) { setRenamingSidebarViewId(null); setShowDuplicateViewTooltip(false); return; }
    const isDuplicate = views.some(v => v.id !== renamingSidebarViewId && v.name === trimmed);
    if (isDuplicate) {
      setShowDuplicateViewTooltip(true);
      if (duplicateViewTooltipTimerRef.current) clearTimeout(duplicateViewTooltipTimerRef.current);
      duplicateViewTooltipTimerRef.current = setTimeout(() => setShowDuplicateViewTooltip(false), 10000);
      return;
    }
    setShowDuplicateViewTooltip(false);
    if (duplicateViewTooltipTimerRef.current) clearTimeout(duplicateViewTooltipTimerRef.current);
    renameViewMut.mutate({ viewId: renamingSidebarViewId, name: trimmed });
    setRenamingSidebarViewId(null);
  }, [sidebarRenameValue, renamingSidebarViewId, views, renameViewMut]);

  const cancelSidebarRename = useCallback(() => {
    setRenamingSidebarViewId(null);
    setShowDuplicateViewTooltip(false);
    if (duplicateViewTooltipTimerRef.current) clearTimeout(duplicateViewTooltipTimerRef.current);
  }, []);

  return {
    views,
    activeViewId,
    setActiveViewId,
    activeViewName,
    canDeleteView,
    isCreateViewBoxOpen, setIsCreateViewBoxOpen,
    createViewName, setCreateViewName,
    computeNextViewName,
    createViewMut,
    showViewLoadingSpinner,
    deleteViewMut,
    renameViewMut,
    isViewDropdownOpen, setIsViewDropdownOpen,
    viewDropdownRef, viewDropdownButtonRef,
    isViewsSidebarOpen, setIsViewsSidebarOpen,
    isViewsSidebarPinned,
    viewSearchQuery, setViewSearchQuery,
    favoritedViews,
    isCreateNewDropdownOpen, setIsCreateNewDropdownOpen,
    contextMenuViewId, setContextMenuViewId,
    contextMenuPosition, setContextMenuPosition,
    handleToggleViewsSidebar,
    handleListButtonMouseEnter,
    handleListButtonMouseLeave,
    handleSidebarMouseEnter,
    handleSidebarMouseLeave,
    handleToggleViewFavorite,
    isRenamingView, setIsRenamingView,
    renameViewValue, setRenameViewValue,
    renameViewInputRef,
    startRenamingView,
    commitRenameView,
    cancelRenameView,
    showDuplicateViewTooltip,
    renamingSidebarViewId,
    sidebarRenameValue, setSidebarRenameValue,
    startSidebarRename,
    commitSidebarRename,
    cancelSidebarRename,
  };
}
