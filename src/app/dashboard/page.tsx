"use client";

/**
 * Dashboard / Home Page
 * Airtable-style home shell with sidebar navigation
 */

import { useState } from "react";
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
  CheckIcon,
  AirtableLogoMark,
  AirtableWordmark,
} from "~/components/home/Icons";
import { useBases } from "~/components/home/useBases";

type FilterOption = "today" | "past7days" | "past30days" | "anytime";
type ViewMode = "list" | "grid";

export default function DashboardPage() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [starredExpanded, setStarredExpanded] = useState(true);
  const [workspacesExpanded, setWorkspacesExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<FilterOption>("anytime");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const { bases } = useBases();

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
            <button
              type="button"
              className={styles.hamburgerButton}
              aria-label="Toggle sidebar"
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
            >
              <HamburgerIcon size={20} />
            </button>

            <Link href="/dashboard" aria-label="Airtable home" className={styles.brand}>
              <span className={styles.brandMark}>
                <AirtableLogoMark size={30} />
              </span>
              <span className={styles.brandWordmark}>
                <AirtableWordmark height={15} />
              </span>
            </Link>
          </div>

          {/* Center: search pill */}
          <div className={styles.topbarCenter}>
            <button
              type="button"
              className={styles.searchPill}
              aria-label="Search"
            >
              <span className={styles.searchIcon}>
                <SearchIcon size={14} />
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
              <span>Help</span>
            </button>

            <button
              type="button"
              className={styles.bellButton}
              aria-label="Notifications"
            >
              <BellIcon size={17} />
            </button>

            <button type="button" className={styles.avatar} aria-label="Account">
              H
            </button>
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
                <WorkspacesIcon size={28} />
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
                <div className={styles.starredEmpty}>
                  <span className={styles.starredEmptyIcon}>
                    <StarOutlineIcon size={18} />
                  </span>
                  <p className={styles.starredEmptyText}>
                    Your starred bases, interfaces, and workspaces will appear here
                  </p>
                </div>
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
                <span className={styles.navIconWide}>
                  <WorkspacesIcon size={32} />
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

              <button type="button" className={styles.createButton}>
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
            <div className={styles.subheader}>
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
              </div>
            </div>

            {/* Content: Empty state or bases list */}
            <div className={styles.contentArea}>
              {bases.length === 0 ? (
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
              ) : (
                <section aria-label="Recently opened bases">
                  {/* TODO: Render bases list/grid */}
                </section>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
