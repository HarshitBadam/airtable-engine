"use client";

import React from "react";
import styles from "./GridWorkspace.module.css";
import { getBaseToolbarColor } from "~/components/bases/useBases";
import { useGridWorkspace } from "~/components/grid/hooks/useGridWorkspace";
import { GridWorkspaceProvider } from "./GridWorkspaceContext";

export type { RowHeightPreset } from "~/shared/grid";

import { TopBar } from "./TopBar";
import { ClearDataModal, DeleteTablePopup } from "./TableModals";
import { Rail } from "./Rail";
import { GridBar } from "./GridBar";
import { TableToolbar } from "./TableToolbar";
import { ViewsSidebar } from "./ViewsSidebar";
import { GridContainer } from "./GridContainer";

interface GridWorkspaceProps {
  baseId: string;
  tableId: string;
}

export function GridWorkspace({ baseId, tableId }: GridWorkspaceProps) {
  const state = useGridWorkspace({ baseId, tableId });

  return (
    <GridWorkspaceProvider value={state}>
      <div className={styles.workspace}>
        <Rail />

        <div className={styles.mainArea}>
          <TopBar
            baseName={state.baseName}
            baseColor={state.baseColor}
            baseBorderColor={state.baseBorderColor}
            baseTextColor={state.baseTextColor}
          />

          <div className={styles.contentArea}>
            <TableToolbar />

            <GridBar ref={state.gridBarRef} />

            <div className={styles.gridArea}>
              <ViewsSidebar tableId={tableId} />

              <div className={styles.gridContentWrapper}>
                <GridContainer />

                {state.createViewMut.isPending && (
                  <div className={styles.viewLoadingOverlay}>
                    {state.showViewLoadingSpinner && (
                      <>
                        <div
                          className={styles.viewLoadingProgressBar}
                          style={
                            {
                              "--base-color": state.baseColor,
                            } as React.CSSProperties
                          }
                        />
                        <div className={styles.viewLoadingContent}>
                          <svg
                            className={styles.viewLoadingSpinner}
                            viewBox="0 0 54 54"
                            style={{ shapeRendering: "geometricPrecision" }}
                          >
                            <g>
                              <path
                                d="M10.9,48.6c-1.6-1.3-2-3.6-0.7-5.3c1.3-1.6,3.6-2.1,5.3-0.8c0.8,0.5,1.5,1.1,2.4,1.5c7.5,4.1,16.8,2.7,22.8-3.4c1.5-1.5,3.8-1.5,5.3,0c1.4,1.5,1.4,3.9,0,5.3c-8.4,8.5-21.4,10.6-31.8,4.8C13,50.1,11.9,49.3,10.9,48.6z"
                                fill="currentColor"
                              />
                              <path
                                d="M53.6,31.4c-0.3,2.1-2.3,3.5-4.4,3.2c-2.1-0.3-3.4-2.3-3.1-4.4c0.2-1.1,0.2-2.2,0.2-3.3c0-8.7-5.7-16.2-13.7-18.5c-2-0.5-3.2-2.7-2.6-4.7s2.6-3.2,4.7-2.6C46,4.4,53.9,14.9,53.9,27C53.9,28.5,53.8,30,53.6,31.4z"
                                fill="currentColor"
                              />
                              <path
                                d="M16.7,1.9c1.9-0.8,4.1,0.2,4.8,2.2s-0.2,4.2-2.1,5c-7.2,2.9-12,10-12,18.1c0,1.6,0.2,3.2,0.6,4.7c0.5,2-0.7,4.1-2.7,4.6c-2,0.5-4-0.7-4.5-2.8C0.3,31.5,0,29.3,0,27.1C0,15.8,6.7,5.9,16.7,1.9z"
                                fill="currentColor"
                              />
                            </g>
                          </svg>
                          <div className={styles.viewLoadingText}>
                            Loading this view...
                          </div>
                          <div className={styles.viewLoadingSpacer}>
                            &nbsp;
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <ClearDataModal
          isOpen={state.isClearDataModalOpen}
          tableName={
            state.tables.find((t) => t.id === state.activeTableId)?.name ??
            "this table"
          }
          onClose={state.handleCloseClearDataModal}
          onConfirm={state.handleClearData}
        />

        <DeleteTablePopup
          isOpen={state.isDeleteTablePopupOpen}
          position={state.deleteTablePopupPosition}
          onClose={state.handleCloseDeleteTablePopup}
          onConfirm={state.handleDeleteTable}
        />
      </div>
    </GridWorkspaceProvider>
  );
}
