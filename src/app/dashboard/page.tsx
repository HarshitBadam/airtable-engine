"use client";

/**
 * Dashboard / Home Page
 * Airtable-style home shell with sidebar navigation
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
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
} from "~/components/home/Icons";
import { AccountDropdown, CreateModal } from "~/components/home";
import { useBases, BasesGrid, BasesList, getBaseColor, getBaseTextColor, getBaseInitials } from "~/components/bases";
import { useBaseCardActions } from "~/components/bases/useBaseCardActions";
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
  const [isScrolled, setIsScrolled] = useState(false);
  // Track if sidebar was auto-collapsed due to narrow width (vs manually collapsed)
  // Using ref to avoid re-triggering useEffect when this changes
  const wasAutoCollapsedRef = useRef(false);
  const { bases, isLoading, createBase } = useBases();
  const { data: session } = useSession();
  
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
  
  // Fetch starred bases for sidebar
  const { data: starredBases = [] } = api.base.listStarred.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  
  // Use shared actions hook for star toggle
  const actions = useBaseCardActions();

  const handleCreateBase = () => {
    if (isCreating) return;
    
    setCreateModalOpen(false);
    setIsCreating(true);
    
    createBase("Untitled")
      .catch(() => {
        // Error handled by optimistic update rollback
      })
      .finally(() => {
        setIsCreating(false);
      });
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
        <div className={styles.sidebarContainer}>
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
            className={`${styles.sidebar} ${sidebarExpanded ? styles.sidebarExpanded : ''}`} 
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
                    {starredBases.map((base) => (
                      <Link
                        key={base.id}
                        href={`/bases/${base.id}`}
                        className={basesStyles.starredEntry}
                        draggable={false}
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
                      </Link>
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
        <main className={`${styles.main} ${sidebarExpanded ? styles.mainShifted : ''}`} role="region" aria-label="Home">
          <div className={styles.mainInner}>
            <h1 className={styles.title}>Home</h1>

            {/* Subheader: Filter + View Toggle */}
            <div className={`${styles.subheader} ${isScrolled ? styles.subheaderScrolled : ''}`}>
              <div className={styles.filterWrapper}>
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
              className={`${styles.contentArea} ${bases.length > 0 ? styles.contentAreaWithBases : ''}`}
            >
              {isLoading ? (
                <section className={styles.emptyState} aria-label="Loading">
                  <p className={styles.emptySubtitle}>Loading...</p>
                </section>
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
    </div>
  );
}
