"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./DashboardPage.module.css";
import basesStyles from "~/components/bases/bases.module.css";
import sidebarStyles from "~/components/home/DashboardSidebar.module.css";
import {
  ChevronDownIcon,
  ListViewIcon,
  GridViewIcon,
  CheckIcon,
} from "~/components/home/Icons";
import { CreateModal } from "~/components/home";
import { useBases, BasesGrid, BasesList } from "~/components/bases";
import { useBaseCardActions } from "~/components/bases/useBaseCardActions";
import { useStarredBases } from "~/components/bases/useStarredBases";
import { useAutoCollapseSidebar } from "~/hooks/useAutoCollapseSidebar";
import { useStarredDragDrop } from "~/hooks/useStarredDragDrop";
import { useClickOutside } from "~/hooks/useClickOutside";
import { useCreateBaseAndNavigate } from "~/hooks/useCreateBaseAndNavigate";
import { DashboardSidebar } from "~/components/home/DashboardSidebar";
import { DashboardTopBar } from "~/components/home/DashboardTopBar";
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
  const [isScrolled, setIsScrolled] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const { bases, isLoading, isError, createBase } = useBases();
  const { data: session } = useSession();

  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";
  const userInitial = userName.charAt(0).toUpperCase();

  // Restore viewMode from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem("dashboard-viewMode") as ViewMode | null;
    if (stored && stored !== viewMode) setViewMode(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem("dashboard-viewMode", viewMode);
  }, [viewMode]);

  useAutoCollapseSidebar(setSidebarExpanded);

  useClickOutside(filterRef, filterOpen, useCallback(() => setFilterOpen(false), []));

  const handleContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 0);
  };

  const { starredBases } = useStarredBases();
  const actions = useBaseCardActions();
  const { handleCreateBase, isCreating, pendingBaseId } = useCreateBaseAndNavigate(createBase);

  const { dragState, dragRef, startStarredDrag, getStarredItemStyle, getFloatingStyle, orderedStarredBases } =
    useStarredDragDrop(starredBases, sidebarStyles.starredEntryWrapper);

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
      <DashboardTopBar
        sidebarExpanded={sidebarExpanded}
        onToggleSidebar={() => setSidebarExpanded(!sidebarExpanded)}
        userName={userName}
        userEmail={userEmail}
        userInitial={userInitial}
      />

      <div className={styles.body}>
        <DashboardSidebar
          sidebarExpanded={sidebarExpanded}
          starredExpanded={starredExpanded}
          setStarredExpanded={setStarredExpanded}
          workspacesExpanded={workspacesExpanded}
          setWorkspacesExpanded={setWorkspacesExpanded}
          orderedStarredBases={orderedStarredBases}
          dragState={dragState}
          dragRef={dragRef}
          startStarredDrag={startStarredDrag}
          getStarredItemStyle={getStarredItemStyle}
          getFloatingStyle={getFloatingStyle}
          actions={actions}
          bases={starredBases}
          onCreateClick={() => setCreateModalOpen(true)}
        />

        <main className={styles.main} role="region" aria-label="Home">
          <div className={styles.mainInner}>
            <h1 className={styles.title}>Home</h1>

            <div className={`${styles.subheader} ${isScrolled ? styles.subheaderScrolled : ""}`}>
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
                        onClick={() => { setFilter(option); setFilterOpen(false); }}
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

              <div className={styles.viewToggle} role="radiogroup" aria-label="View mode">
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

            <div
              onScroll={handleContentScroll}
              className={`${styles.contentArea} ${bases.length > 0 || isLoading || isError ? styles.contentAreaWithBases : ""}`}
            >
              {isLoading ? (
                <div className={basesStyles.basesGridWrapper}>
                  <div className={basesStyles.basesGrid}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className={basesStyles.skeletonCard} />
                    ))}
                  </div>
                </div>
              ) : isError ? (
                <section className={styles.emptyState} aria-label="Error state">
                  <h2 className={styles.emptyTitle}>
                    Failed to load bases. Please refresh.
                  </h2>
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

      <CreateModal
        isOpen={createModalOpen}
        isCreating={isCreating}
        onClose={() => setCreateModalOpen(false)}
        onCreateBase={() => { setCreateModalOpen(false); handleCreateBase(); }}
      />

      {pendingBaseId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "row", height: "100vh", width: "100vw", overflow: "hidden", background: "#fff", fontFamily: '-apple-system, system-ui, "system-ui", "Segoe UI", Roboto, sans-serif', fontSize: 13, color: "rgb(29, 31, 37)" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 56, height: "100%", padding: "16px 8px", boxSizing: "border-box", borderRight: "1px solid rgba(0,0,0,0.1)", background: "#fff", flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ height: 56, borderBottom: "1px solid rgba(0,0,0,0.1)", background: "#fff", flexShrink: 0 }} />
            <div style={{ height: 48, borderBottom: "1px solid rgba(0,0,0,0.1)", background: "#fff", flexShrink: 0 }} />
            <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#F6F8FC", position: "relative" }}>
              <svg width="16.2" height="16.2" viewBox="0 0 54 54" style={{ shapeRendering: "geometricPrecision", animation: "dashSkeletonSpin 1.8s cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite" }}>
                <g>
                  <path d="M10.9,48.6c-1.6-1.3-2-3.6-0.7-5.3c1.3-1.6,3.6-2.1,5.3-0.8c0.8,0.5,1.5,1.1,2.4,1.5c7.5,4.1,16.8,2.7,22.8-3.4c1.5-1.5,3.8-1.5,5.3,0c1.4,1.5,1.4,3.9,0,5.3c-8.4,8.5-21.4,10.6-31.8,4.8C13,50.1,11.9,49.3,10.9,48.6z" fill="#616670" />
                  <path d="M53.6,31.4c-0.3,2.1-2.3,3.5-4.4,3.2c-2.1-0.3-3.4-2.3-3.1-4.4c0.2-1.1,0.2-2.2,0.2-3.3c0-8.7-5.7-16.2-13.7-18.5c-2-0.5-3.2-2.7-2.6-4.7s2.6-3.2,4.7-2.6C46,4.4,53.9,14.9,53.9,27C53.9,28.5,53.8,30,53.6,31.4z" fill="#616670" />
                  <path d="M16.7,1.9c1.9-0.8,4.1,0.2,4.8,2.2s-0.2,4.2-2.1,5c-7.2,2.9-12,10-12,18.1c0,1.6,0.2,3.2,0.6,4.7c0.5,2-0.7,4.1-2.7,4.6c-2,0.5-4-0.7-4.5-2.8C0.3,31.5,0,29.3,0,27.1C0,15.8,6.7,5.9,16.7,1.9z" fill="#616670" />
                </g>
              </svg>
              <style>{`@keyframes dashSkeletonSpin { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(360deg) scale(1.15); } 100% { transform: rotate(720deg) scale(1); } }`}</style>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
