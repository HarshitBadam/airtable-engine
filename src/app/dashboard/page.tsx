"use client";

/**
 * Dashboard / Home Page
 * Airtable-style home shell with sidebar navigation
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "~/components/home/HomeShell.module.css";
import {
  HamburgerIcon,
  HomeIcon,
  StarIcon,
  ShareIcon,
  WorkspacesIcon,
  TemplatesIcon,
  MarketplaceIcon,
  ImportIcon,
  GlobeIcon,
  PlusIcon,
  SearchIcon,
  HelpIcon,
  BellIcon,
  ChevronDownIcon,
  ListViewIcon,
  GridViewIcon,
  StarOutlineIcon,
  StarFilledIcon,
  CheckIcon,
  AirtableLogoMark,
  AirtableWordmark,
  DotsSixVerticalIcon,
} from "~/components/home/Icons";
import { AccountDropdown, CreateModal } from "~/components/home";
import { useBases, BasesGrid, BasesList, getBaseColor, getBaseTextColor, getBaseInitials } from "~/components/bases";
import { useBaseCardActions } from "~/components/bases/useBaseCardActions";
import { filterPendingDeletes } from "~/components/bases/pendingDeletes";
import { SIDEBAR_AUTO_COLLAPSE_WIDTH } from "~/shared/constants";
import { api } from "~/trpc/react";
import basesStyles from "~/components/bases/bases.module.css";
import { useSession } from "next-auth/react";

type FilterOption = "today" | "past7days" | "past30days" | "anytime";
type ViewMode = "list" | "grid";

export default function DashboardPage() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [starredExpanded, setStarredExpanded] = useState(true);
  const [workspacesExpanded, setWorkspacesExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<FilterOption>("anytime");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingBaseId, setPendingBaseId] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  // Track if sidebar was auto-collapsed due to narrow width (vs manually collapsed)
  const wasAutoCollapsedRef = useRef(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const { bases, isLoading, createBase } = useBases();
  const { data: session } = useSession();
  const router = useRouter();
  
  // Drag-and-drop state for starred sidebar items
  const [localStarredOrder, setLocalStarredOrder] = useState<string[]>([]);
  const [dragState, setDragState] = useState<{
    dragIndex: number;
    overIndex: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    /** Viewport position of the dragged item at drag start */
    itemTop: number;
    itemLeft: number;
    itemWidth: number;
  } | null>(null);
  const dragRef = useRef<typeof dragState>(null);
  
  // Restore viewMode from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem("dashboard-viewMode") as ViewMode | null;
    if (stored && stored !== viewMode) {
      setViewMode(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist viewMode to localStorage
  useEffect(() => {
    localStorage.setItem("dashboard-viewMode", viewMode);
  }, [viewMode]);

  // Get user info for the account dropdown
  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";
  const userInitial = userName.charAt(0).toUpperCase();
  
  // Auto-collapse sidebar when width is narrow, auto-restore when width increases
  useEffect(() => {
    let prevWidth = window.innerWidth;
    
    const handleResize = () => {
      const width = window.innerWidth;
      const wasNarrow = prevWidth <= SIDEBAR_AUTO_COLLAPSE_WIDTH;
      const isNarrow = width <= SIDEBAR_AUTO_COLLAPSE_WIDTH;
      
      // Crossing from wide to narrow
      if (!wasNarrow && isNarrow) {
        setSidebarExpanded((prev) => {
          if (prev) {
            // Was expanded, now auto-collapsing
            wasAutoCollapsedRef.current = true;
            return false;
          }
          return prev;
        });
      }
      
      // Crossing from narrow to wide
      if (wasNarrow && !isNarrow) {
        if (wasAutoCollapsedRef.current) {
          // Was auto-collapsed, now restore
          wasAutoCollapsedRef.current = false;
          setSidebarExpanded(true);
        }
      }
      
      prevWidth = width;
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Handle scroll to show/hide subheader shadow
  const handleContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setIsScrolled(target.scrollTop > 0);
  };
  
  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    }
    if (filterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [filterOpen]);
  
  // Fetch starred bases for sidebar
  const { data: starredBases = [] } = api.base.listStarred.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    select: filterPendingDeletes, // Exclude bases mid-deletion
  });
  
  // Use shared actions hook for star toggle
  const actions = useBaseCardActions();

  // Sync local starred order when server data changes (and not mid-drag)
  const starredIds = starredBases.map(b => b.id).join(",");
  useEffect(() => {
    if (!dragRef.current) {
      setLocalStarredOrder(starredIds.split(",").filter(Boolean));
    }
  }, [starredIds]);

  // Derive ordered starred bases from local order
  const orderedStarredBases = localStarredOrder
    .map(id => starredBases.find(b => b.id === id))
    .filter((b): b is NonNullable<typeof b> => b != null);

  const ITEM_HEIGHT = 39.5; // 35.5px height + 4px margin-bottom

  const startStarredDrag = useCallback((e: React.PointerEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Get the wrapper element's viewport rect for initial fixed positioning
    const handle = e.currentTarget as HTMLElement;
    const wrapper = handle.closest<HTMLElement>(`.${basesStyles.starredEntryWrapper}`);
    const rect = wrapper?.getBoundingClientRect();

    const startX = e.clientX;
    const startY = e.clientY;
    const itemCount = orderedStarredBases.length;
    const initial = {
      dragIndex: index,
      overIndex: index,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      itemTop: rect?.top ?? 0,
      itemLeft: rect?.left ?? 0,
      itemWidth: rect?.width ?? 275,
    };
    dragRef.current = initial;
    setDragState(initial);

    const onMove = (ev: PointerEvent) => {
      const currentX = ev.clientX;
      const currentY = ev.clientY;
      const offsetY = currentY - startY;
      const rawIndex = index + offsetY / ITEM_HEIGHT;
      const overIndex = Math.max(0, Math.min(itemCount - 1, Math.round(rawIndex)));
      const next = { ...initial, overIndex, currentX, currentY };
      dragRef.current = next;
      setDragState(next);
    };

    const onUp = () => {
      const final = dragRef.current;
      if (final && final.dragIndex !== final.overIndex) {
        setLocalStarredOrder(prev => {
          const arr = [...prev];
          const [moved] = arr.splice(final.dragIndex, 1);
          if (moved) arr.splice(final.overIndex, 0, moved);
          return arr;
        });
      }
      dragRef.current = null;
      setDragState(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [orderedStarredBases.length]);

  // Compute transform style for each starred item during drag
  const getStarredItemStyle = useCallback((index: number): React.CSSProperties => {
    if (!dragState) return {};
    const { dragIndex, overIndex, startY, currentY } = dragState;

    if (index === dragIndex) {
      // Ghost stays in place - no transform
      return {};
    }

    if (dragIndex < overIndex) {
      // Dragging down: items between drag and target shift up
      if (index > dragIndex && index <= overIndex) {
        return { transform: `translateY(-${ITEM_HEIGHT}px)`, transition: "transform 200ms ease" };
      }
    } else if (dragIndex > overIndex) {
      // Dragging up: items between target and drag shift down
      if (index >= overIndex && index < dragIndex) {
        return { transform: `translateY(${ITEM_HEIGHT}px)`, transition: "transform 200ms ease" };
      }
    }

    return { transition: "transform 200ms ease" };
  }, [dragState]);

  // Floating (lifted) item style — fixed to viewport so it's never clipped
  const getFloatingStyle = useCallback((): React.CSSProperties => {
    if (!dragState) return { display: "none" };
    const dx = dragState.currentX - dragState.startX;
    const dy = dragState.currentY - dragState.startY;
    return {
      position: "fixed",
      top: dragState.itemTop + dy,
      left: dragState.itemLeft + dx,
      width: dragState.itemWidth,
      zIndex: 9999,
      pointerEvents: "none",
    };
  }, [dragState]);

  // Poll for the newly created base's tables — navigate once ready
  const pendingTablesQ = api.table.listByBase.useQuery(
    { baseId: pendingBaseId! },
    {
      enabled: !!pendingBaseId,
      refetchInterval: 400,
      retry: true,
      retryDelay: 400,
    },
  );

  useEffect(() => {
    if (!pendingBaseId) return;
    const tables = pendingTablesQ.data;
    if (tables && tables.length > 0) {
      const tableId = tables[0]!.id;
      // Navigate to the real table — keep skeleton visible until the route
      // transition unmounts this component (don't clear pendingBaseId here)
      router.push(`/bases/${pendingBaseId}/tables/${tableId}`);
    }
  }, [pendingBaseId, pendingTablesQ.data, router]);

  const handleCreateBase = () => {
    if (isCreating) return;
    
    setCreateModalOpen(false);
    setIsCreating(true);
    
    // Create fires in background, show skeleton overlay immediately
    const { id } = createBase("Untitled");
    setPendingBaseId(id);
  };

  const filterLabels: Record<FilterOption, string> = {
    today: "Today",
    past7days: "In the past 7 days",
    past30days: "In the past 30 days",
    anytime: "Anytime",
  };

  const getFilterDisplayText = () => {
    if (filter === "anytime") return "Opened anytime";
    if (filter === "today") return "Opened today";
    if (filter === "past7days") return "Opened in the past 7 days";
    if (filter === "past30days") return "Opened in the past 30 days";
    return "Opened anytime";
  };

  return (
    <div className={styles.shell}>
      {/* ========================================
          Top Bar
          ======================================== */}
      <header className={styles.topbar} role="banner">
        <nav className={styles.topbarNav} aria-label="Top bar">
          {/* Left: hamburger + logo */}
          <div className={styles.topbarLeft}>
            <div className={styles.hamburgerWrapper}>
              <button
                type="button"
                className={styles.hamburgerButton}
                aria-label="Toggle sidebar"
                onClick={() => setSidebarExpanded(!sidebarExpanded)}
              >
                <HamburgerIcon size={20} />
              </button>
              <span className={styles.hamburgerTooltip} role="tooltip">
                {sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
              </span>
            </div>

            <Link href="/dashboard" aria-label="Airtable home" className={styles.brand}>
              <span className={styles.brandMark}>
                <AirtableLogoMark size={30} />
              </span>
              <span className={styles.brandWordmark}>
                <AirtableWordmark height={15} />
              </span>
            </Link>
          </div>

          {/* Center: search pill (no tooltip) */}
          <div className={styles.topbarCenter}>
            <button
              type="button"
              className={styles.searchPill}
              aria-label="Search"
            >
              <span className={styles.searchIcon}>
                <SearchIcon size={16} />
              </span>
              <span className={styles.searchPlaceholder}>Search...</span>
              <span className={styles.searchKbd} aria-hidden="true">
                <span>⌘</span> <span>K</span>
              </span>
            </button>
          </div>

          {/* Right: help + bell + avatar */}
          <div className={styles.topbarRight}>
            <button type="button" className={styles.helpButton} aria-label="Help">
              <HelpIcon size={16} />
              <span className={styles.helpText}>Help</span>
            </button>

            <div className={styles.tooltipWrapper}>
              <button
                type="button"
                className={styles.bellButton}
                aria-label="Notifications"
              >
                <BellIcon size={17} />
              </button>
              <span className={styles.hoverTooltip} role="tooltip">Notifications</span>
            </div>

            <AccountDropdown
              userName={userName}
              userEmail={userEmail}
              userInitial={userInitial}
            />
          </div>
        </nav>
      </header>

      {/* ========================================
          Body (Rail + Sidebar + Main)
          ======================================== */}
      <div className={styles.body}>
        {/* Sidebar Container (Rail + Expandable Panel) */}
        <div className={`${styles.sidebarContainer} ${sidebarExpanded ? styles.sidebarContainerExpanded : ''}`}>
          {/* Left icon rail (always visible) */}
          <aside className={styles.rail} aria-label="Primary navigation">
            <nav className={styles.railNav}>
              <button
                type="button"
                className={styles.railItem}
                aria-label="Home"
                aria-current="page"
              >
                <HomeIcon size={20} />
              </button>
              <button
                type="button"
                className={styles.railItem}
                aria-label="Starred"
              >
                <StarIcon size={20} />
              </button>
              <button
                type="button"
                className={styles.railItem}
                aria-label="Shared"
              >
                <ShareIcon size={20} />
              </button>
              <button
                type="button"
                className={styles.railItem}
                aria-label="Workspaces"
              >
                <WorkspacesIcon size={20} />
              </button>

              <div className={styles.railDivider} />
              <div className={styles.railSpacer} />

              <div className={styles.railFooter}>
                <div className={styles.railDivider} />
                <button
                  type="button"
                  className={styles.railFooterItem}
                  aria-label="Templates and apps"
                >
                  <TemplatesIcon size={16} />
                </button>
                <button
                  type="button"
                  className={styles.railFooterItem}
                  aria-label="Marketplace"
                >
                  <MarketplaceIcon size={16} />
                </button>
                <button
                  type="button"
                  className={styles.railFooterItem}
                  aria-label="Import"
                >
                  <GlobeIcon size={16} />
                </button>
                <button
                  type="button"
                  className={styles.railCreatePartial}
                  aria-label="Create"
                  onClick={() => setCreateModalOpen(true)}
                >
                  <PlusIcon size={18} />
                </button>
              </div>
            </nav>
          </aside>

          {/* Expanded sidebar panel (shows on hover or when toggled) */}
          <aside 
            className={`${styles.sidebar} ${sidebarExpanded ? styles.sidebarExpanded : ''} ${dragState ? styles.sidebarDragActive : ''}`} 
            aria-label="Sidebar"
          >
          <nav className={styles.sidebarNav} aria-label="Homescreen navigation">
            <div className={`${styles.sidebarNavTop} ${!starredExpanded ? styles.starredCollapsed : ''}`}>
            {/* Home */}
            <Link
              href="/dashboard"
              className={`${styles.navItem} ${styles.navItemActive}`}
            >
              <span className={styles.navIcon}>
                <HomeIcon size={20} />
              </span>
              <span className={styles.navLabel}>Home</span>
            </Link>

            {/* Starred row + collapse toggle */}
            <div className={styles.navRow}>
              <button type="button" className={styles.navItem}>
                <span className={styles.navIcon}>
                  <StarIcon size={20} />
                </span>
                <span className={styles.navLabel}>Starred</span>
              </button>
              <button
                type="button"
                className={`${styles.disclosureButton} ${starredExpanded ? styles.disclosureExpanded : styles.disclosureCollapsed}`}
                aria-label={starredExpanded ? "Collapse starred" : "Expand starred"}
                aria-expanded={starredExpanded}
                onClick={() => setStarredExpanded(!starredExpanded)}
              >
                <ChevronDownIcon size={20} />
              </button>
            </div>

            {/* Starred items section */}
            {starredExpanded && (
              <section className={styles.navSection} aria-label="Starred items">
                {starredBases.length === 0 ? (
                  <div className={styles.starredEmpty}>
                    <span className={styles.starredEmptyIcon}>
                      <StarOutlineIcon size={18} />
                    </span>
                    <p className={styles.starredEmptyText}>
                      Your starred bases, interfaces, and workspaces will appear here
                    </p>
                  </div>
                ) : (
                  <div className={styles.starredList}>
                    {orderedStarredBases.map((base, index) => (
                      <div
                        key={base.id}
                        className={`${basesStyles.starredEntryWrapper} ${dragState?.dragIndex === index ? basesStyles.starredEntryGhost : ""}`}
                        style={getStarredItemStyle(index)}
                      >
                        <Link
                          href={`/bases/${base.id}/tables/default`}
                          className={basesStyles.starredEntry}
                          draggable={false}
                          onClick={(e) => {
                            if (dragRef.current) { e.preventDefault(); return; }
                            actions.recordOpen(base.id);
                          }}
                        >
                          <div 
                            className={basesStyles.starredEntryLogo}
                            style={{ backgroundColor: getBaseColor(base.id) }}
                          >
                            <span style={{ color: getBaseTextColor(base.id) }}>
                              {getBaseInitials(base.name)}
                            </span>
                          </div>
                          <p className={basesStyles.starredEntryTitle}>{base.name}</p>
                          <span className={basesStyles.starredEntryAppLabel}>App</span>
                          <span 
                            className={basesStyles.starredEntryStar}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              actions.toggleStar(base.id);
                            }}
                          >
                            <StarFilledIcon size={16} color="#FFBA06" />
                          </span>
                          <span 
                            className={basesStyles.starredEntryDragHandle}
                            onPointerDown={(e) => startStarredDrag(e, index)}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          >
                            <DotsSixVerticalIcon size={16} />
                          </span>
                        </Link>
                      </div>
                    ))}

                    
                  </div>
                )}
              </section>
            )}

            {/* Shared */}
            <button type="button" className={styles.navItem}>
              <span className={styles.navIcon}>
                <ShareIcon size={20} />
              </span>
              <span className={styles.navLabel}>Shared</span>
            </button>

            {/* Workspaces row */}
            <div className={styles.navRow}>
              <button type="button" className={styles.navItem}>
                <span className={`${styles.navIcon} ${styles.navIconWorkspaces}`}>
                  <WorkspacesIcon size={20} />
                </span>
                <span className={styles.navLabel}>Workspaces</span>
              </button>
              <button
                type="button"
                className={styles.addButton}
                aria-label="Create a workspace"
              >
                <PlusIcon size={16} />
              </button>
              <button
                type="button"
                className={`${styles.disclosureButton} ${workspacesExpanded ? styles.disclosureExpanded : styles.disclosureCollapsed}`}
                aria-label={workspacesExpanded ? "Collapse workspaces" : "Expand workspaces"}
                aria-expanded={workspacesExpanded}
                onClick={() => setWorkspacesExpanded(!workspacesExpanded)}
              >
                <ChevronDownIcon size={20} />
              </button>
            </div>
            </div>

            {/* Bottom links + Create button */}
            <div className={styles.sidebarBottom}>
              <div className={styles.bottomLinksWrap}>
                <button type="button" className={styles.bottomLink}>
                  <span className={styles.bottomLinkIcon}>
                    <TemplatesIcon size={16} />
                  </span>
                  <span className={styles.bottomLinkText}>Templates and apps</span>
                </button>

                <a
                  href="https://airtable.com/marketplace"
                  className={styles.bottomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.bottomLinkIcon}>
                    <MarketplaceIcon size={16} />
                  </span>
                  <span className={styles.bottomLinkText}>Marketplace</span>
                </a>

                <button type="button" className={styles.bottomLink}>
                  <span className={styles.bottomLinkIcon}>
                    <ImportIcon size={16} />
                  </span>
                  <span className={styles.bottomLinkText}>Import</span>
                </button>
              </div>

              <button type="button" className={styles.createButton} onClick={() => setCreateModalOpen(true)}>
                <span className={styles.createButtonIcon}>
                  <PlusIcon size={14} />
                </span>
                <span className={styles.createButtonText}>Create</span>
              </button>
            </div>
          </nav>
        </aside>
        </div>

        {/* ========================================
            Main Content
            ======================================== */}
        <main className={styles.main} role="region" aria-label="Home">
          <div className={styles.mainInner}>
            <h1 className={styles.title}>Home</h1>

            {/* Subheader: Filter + View Toggle */}
            <div className={`${styles.subheader} ${isScrolled ? styles.subheaderScrolled : ''}`}>
              <div className={styles.filterWrapper} ref={filterRef}>
                <button
                  type="button"
                  className={styles.filterButton}
                  aria-label="Filter items"
                  aria-expanded={filterOpen}
                  onClick={() => setFilterOpen(!filterOpen)}
                >
                  <span>{getFilterDisplayText()}</span>
                  <span className={styles.filterChevron}>
                    <ChevronDownIcon size={14} />
                  </span>
                </button>

                {filterOpen && (
                  <div className={styles.filterDropdown} role="listbox">
                    {(Object.keys(filterLabels) as FilterOption[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={styles.filterOption}
                        role="option"
                        aria-selected={filter === option}
                        onClick={() => {
                          setFilter(option);
                          setFilterOpen(false);
                        }}
                      >
                        <span>{filterLabels[option]}</span>
                        {filter === option && (
                          <span className={styles.filterCheck}>
                            <CheckIcon size={16} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View Toggle - right side of subheader via justify-content: space-between */}
              <div
                className={styles.viewToggle}
                role="radiogroup"
                aria-label="View mode"
              >
                <div className={styles.tooltipWrapper}>
                  <button
                    type="button"
                    className={styles.viewToggleButton}
                    role="radio"
                    aria-checked={viewMode === "list"}
                    aria-label="List view"
                    onClick={() => setViewMode("list")}
                  >
                    <ListViewIcon size={20} />
                  </button>
                  <span className={styles.hoverTooltip} role="tooltip">View items in a list</span>
                </div>
                <div className={styles.tooltipWrapper}>
                  <button
                    type="button"
                    className={styles.viewToggleButton}
                    role="radio"
                    aria-checked={viewMode === "grid"}
                    aria-label="Grid view"
                    onClick={() => setViewMode("grid")}
                  >
                    <GridViewIcon size={20} />
                  </button>
                  <span className={styles.hoverTooltip} role="tooltip">View items in a grid</span>
                </div>
              </div>
            </div>

            {/* Content: Empty state or bases list */}
            <div 
              onScroll={handleContentScroll}
              className={`${styles.contentArea} ${bases.length > 0 || isLoading ? styles.contentAreaWithBases : ''}`}
            >
              {isLoading ? (
                <div className={basesStyles.basesGridWrapper}>
                  <div className={basesStyles.basesGrid}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className={basesStyles.skeletonCard} />
                    ))}
                  </div>
                </div>
              ) : bases.length === 0 ? (
                <section className={styles.emptyState} aria-label="Empty state">
                  <h2 className={styles.emptyTitle}>
                    You haven&apos;t opened anything recently
                  </h2>
                  <p className={styles.emptySubtitle}>
                    Apps that you have recently opened will appear here.
                  </p>
                  <button type="button" className={styles.emptyCta}>
                    Go to all workspaces
                  </button>
                </section>
              ) : viewMode === "list" ? (
                <BasesList bases={bases} />
              ) : (
                <BasesGrid bases={bases} />
              )}
            </div>
          </div>

        </main>
      </div>

      {/* Create Modal */}
      <CreateModal
        isOpen={createModalOpen}
        isCreating={isCreating}
        onClose={() => setCreateModalOpen(false)}
        onCreateBase={handleCreateBase}
      />

      {/* Floating dragged starred item — portaled to body to avoid ancestor transform issues */}
      {dragState && orderedStarredBases[dragState.dragIndex] && createPortal(
        (() => {
          const base = orderedStarredBases[dragState.dragIndex]!;
          return (
            <div
              className={basesStyles.starredEntryFloating}
              style={getFloatingStyle()}
            >
              <div className={`${basesStyles.starredEntry} ${basesStyles.starredEntryLifted}`}>
                <div 
                  className={basesStyles.starredEntryLogo}
                  style={{ backgroundColor: getBaseColor(base.id) }}
                >
                  <span style={{ color: getBaseTextColor(base.id) }}>
                    {getBaseInitials(base.name)}
                  </span>
                </div>
                <p className={basesStyles.starredEntryTitle}>{base.name}</p>
                <span className={basesStyles.starredEntryAppLabel}>App</span>
                <span className={basesStyles.starredEntryStar}>
                  <StarFilledIcon size={16} color="#FFBA06" />
                </span>
                <span className={basesStyles.starredEntryDragHandle}>
                  <DotsSixVerticalIcon size={16} />
                </span>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* Full-screen loading skeleton while base is being created */}
      {pendingBaseId && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          flexDirection: "row",
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
          background: "#fff",
          fontFamily: '-apple-system, system-ui, "system-ui", "Segoe UI", Roboto, sans-serif',
          fontSize: 13,
          color: "rgb(29, 31, 37)",
        }}>
          {/* Sidebar rail */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 56,
            height: "100%",
            padding: "16px 8px",
            boxSizing: "border-box",
            borderRight: "1px solid rgba(0,0,0,0.1)",
            background: "#fff",
            flexShrink: 0,
          }} />
          {/* Main area */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            {/* Top bar */}
            <div style={{
              height: 56,
              borderBottom: "1px solid rgba(0,0,0,0.1)",
              background: "#fff",
              flexShrink: 0,
            }} />
            {/* Sub-header bar */}
            <div style={{
              height: 48,
              borderBottom: "1px solid rgba(0,0,0,0.1)",
              background: "#fff",
              flexShrink: 0,
            }} />
            {/* Main content area with spinner */}
            <main style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#F6F8FC",
              position: "relative",
            }}>
              <svg
                width="16.2"
                height="16.2"
                viewBox="0 0 54 54"
                style={{
                  shapeRendering: "geometricPrecision",
                  animation: "dashSkeletonSpin 1.8s cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite",
                }}
              >
                <g>
                  <path d="M10.9,48.6c-1.6-1.3-2-3.6-0.7-5.3c1.3-1.6,3.6-2.1,5.3-0.8c0.8,0.5,1.5,1.1,2.4,1.5c7.5,4.1,16.8,2.7,22.8-3.4c1.5-1.5,3.8-1.5,5.3,0c1.4,1.5,1.4,3.9,0,5.3c-8.4,8.5-21.4,10.6-31.8,4.8C13,50.1,11.9,49.3,10.9,48.6z" fill="#616670" />
                  <path d="M53.6,31.4c-0.3,2.1-2.3,3.5-4.4,3.2c-2.1-0.3-3.4-2.3-3.1-4.4c0.2-1.1,0.2-2.2,0.2-3.3c0-8.7-5.7-16.2-13.7-18.5c-2-0.5-3.2-2.7-2.6-4.7s2.6-3.2,4.7-2.6C46,4.4,53.9,14.9,53.9,27C53.9,28.5,53.8,30,53.6,31.4z" fill="#616670" />
                  <path d="M16.7,1.9c1.9-0.8,4.1,0.2,4.8,2.2s-0.2,4.2-2.1,5c-7.2,2.9-12,10-12,18.1c0,1.6,0.2,3.2,0.6,4.7c0.5,2-0.7,4.1-2.7,4.6c-2,0.5-4-0.7-4.5-2.8C0.3,31.5,0,29.3,0,27.1C0,15.8,6.7,5.9,16.7,1.9z" fill="#616670" />
                </g>
              </svg>
              <style>{`
                @keyframes dashSkeletonSpin {
                  0% { transform: rotate(0deg) scale(1); }
                  50% { transform: rotate(360deg) scale(1.15); }
                  100% { transform: rotate(720deg) scale(1); }
                }
              `}</style>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
