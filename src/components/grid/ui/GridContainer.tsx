import React, { useState, useCallback } from "react";
import styles from "./GridContainer.module.css";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
import { CreateFieldPanel } from "./CreateFieldPanel";
import { RowContextMenu } from "./RowContextMenu";
import { DupFieldDialog } from "./DupFieldDialog";
import { useWorkspace } from "./GridWorkspaceContext";
import { useGridContainerLayout } from "~/components/grid/hooks/layout/useGridContainerLayout";
import { useColumnFieldPanel } from "~/components/grid/hooks/columns/useColumnFieldPanel";
import { GridHeaderArea } from "./GridHeaderArea";
import { GridContentArea } from "./GridContentArea";
import { GridFreezeChrome } from "./GridFreezeChrome";
import { BulkAddPill } from "./BulkAddPill";

export function GridContainer() {
  const {
    gridFooterRef,
    gridBodyRef,
    scrollableHeaderRef,
    hScrollRef,
    wrapHeaders,
    rowHeight,
    freezeWidth,
    scrollableColumnsWidth,
    frozenColumns,
    scrollableColumns,
    totalCount,
    handleCreateField,
    handleDeleteField,
    handleHideField,
    handleSortByField,
    handleFilterByField,
    handleDuplicateField,
    handleEditFieldSave,
    handleInsertRecordAbove,
    handleInsertRecordBelow,
    handleDuplicateRecord,
    handleDeleteRecord,
    baseColor,
  } = useWorkspace();

  const { frozenHeaderMeasureRef, effectiveHeaderHeight } =
    useGridContainerLayout({ wrapHeaders, rowHeight, scrollableHeaderRef });

  const [recordMenuRowId, setRecordMenuRowId] = useState<string | null>(null);
  const [, setRecordMenuColId] = useState<string | null>(null);
  const [recordMenuPosition, setRecordMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const handleCellContextMenu = useCallback(
    (e: React.MouseEvent, rowId: string, colId: string) => {
      e.preventDefault();
      const clickX = e.clientX;
      const clickY = e.clientY;
      const menuW = 240;
      const menuH = 432;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const left =
        clickX + 8 + menuW <= vw ? clickX + 8 : clickX - 8 - menuW;

      let top: number;
      if (clickY + 1 + menuH <= vh) {
        top = clickY + 1;
      } else if (clickY - 1 - menuH >= 0) {
        top = clickY - 1 - menuH;
      } else {
        top = vh - menuH - 8;
      }

      setRecordMenuPosition({ top, left });
      setRecordMenuRowId(rowId);
      setRecordMenuColId(colId);
      setHeaderMenuColId(null);
      setHeaderMenuPosition(null);
    },
    [],
  );

  const closeRecordMenu = useCallback(() => {
    setRecordMenuRowId(null);
    setRecordMenuColId(null);
    setRecordMenuPosition(null);
  }, []);

  const {
    headerMenuColId,
    setHeaderMenuColId,
    headerMenuPosition,
    setHeaderMenuPosition,
    handleHeaderMenuToggle,
    canModifyField,
    allColumns,
    addColButtonRef,
    createFieldPosition,
    editFieldInfo,
    handleAddColClick,
    handleCloseCreateField,
    handleCreateFieldWrapped,
    handleInsertField,
    handleEditField,
    dupFieldDialog,
    setDupFieldDialog,
    dupCells,
    setDupCells,
    showBulkAddDialog,
    setShowBulkAddDialog,
    bulkPopulate,
    setBulkPopulate,
  } = useColumnFieldPanel({
    frozenColumns,
    scrollableColumns,
    onCreateField: handleCreateField,
  });

  return (
    <div className={styles.gridContainer} ref={gridFooterRef}>
      <div className={styles.gridBody} ref={gridBodyRef} role="grid">
        <GridHeaderArea
          frozenHeaderMeasureRef={frozenHeaderMeasureRef}
          effectiveHeaderHeight={effectiveHeaderHeight}
          headerMenuColId={headerMenuColId}
          handleHeaderMenuToggle={handleHeaderMenuToggle}
          addColButtonRef={addColButtonRef}
          handleAddColClick={handleAddColClick}
        />

        <GridContentArea
          effectiveHeaderHeight={effectiveHeaderHeight}
          handleCellContextMenu={handleCellContextMenu}
        />
      </div>

      <div ref={hScrollRef} className={styles.gridHorizontalScrollbar}>
        <div
          className={styles.gridHorizontalScrollbarInner}
          style={{ width: freezeWidth + scrollableColumnsWidth + 93 + 60 }}
        />
      </div>

      <div className={styles.gridFooter}>
        <div
          className={styles.gridFooterFrozen}
          style={{ width: freezeWidth }}
        >
          <span className={styles.gridFooterRecordCount}>
            {totalCount.toLocaleString()} record
            {totalCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className={styles.gridFooterScrollable} />
      </div>

      <GridFreezeChrome effectiveHeaderHeight={effectiveHeaderHeight} />

      {recordMenuRowId && recordMenuPosition && (
        <RowContextMenu
          rowId={recordMenuRowId}
          position={recordMenuPosition}
          onClose={closeRecordMenu}
          onInsertRecordAbove={handleInsertRecordAbove}
          onInsertRecordBelow={handleInsertRecordBelow}
          onDuplicateRecord={handleDuplicateRecord}
          onDeleteRecord={handleDeleteRecord}
        />
      )}

      {(() => {
        if (!headerMenuColId || !headerMenuPosition) return null;
        const colId = headerMenuColId;
        const colPos = headerMenuPosition;
        const col = allColumns.find((c) => c.id === colId);
        return (
          <ColumnHeaderMenu
            colType={col?.type ?? "TEXT"}
            position={colPos}
            canModifyField={canModifyField}
            onClose={() => {
              setHeaderMenuColId(null);
              setHeaderMenuPosition(null);
            }}
            onEditField={handleEditField}
            onInsertField={handleInsertField}
            onSortByField={(dir) => {
              handleSortByField(colId, dir);
              setHeaderMenuColId(null);
              setHeaderMenuPosition(null);
            }}
            onFilterByField={() => {
              handleFilterByField(colId);
              setHeaderMenuColId(null);
              setHeaderMenuPosition(null);
            }}
            onHideField={() => {
              handleHideField(colId);
              setHeaderMenuColId(null);
              setHeaderMenuPosition(null);
            }}
            onDeleteField={() => {
              handleDeleteField(colId);
              setHeaderMenuColId(null);
              setHeaderMenuPosition(null);
            }}
            onDuplicateField={() => {
              const dupCol = allColumns.find((c) => c.id === colId);
              setDupFieldDialog({
                colId,
                colName: dupCol?.name ?? "field",
              });
              setDupCells(true);
              setHeaderMenuColId(null);
              setHeaderMenuPosition(null);
            }}
          />
        );
      })()}

      {createFieldPosition && (
        <CreateFieldPanel
          position={createFieldPosition}
          onClose={handleCloseCreateField}
          onCreateField={handleCreateFieldWrapped}
          editField={editFieldInfo ?? undefined}
          onEditFieldSave={
            editFieldInfo
              ? (name, numCfg) => {
                  handleEditFieldSave(editFieldInfo.columnId, name, numCfg);
                }
              : undefined
          }
          existingFieldNames={allColumns.map((c) => c.name)}
          baseColor={baseColor}
        />
      )}

      {dupFieldDialog && (
        <DupFieldDialog
          dialog={dupFieldDialog}
          dupCells={dupCells}
          setDupCells={setDupCells}
          onClose={() => setDupFieldDialog(null)}
          onConfirm={(colId, cells) => {
            handleDuplicateField(colId, cells);
            setDupFieldDialog(null);
          }}
        />
      )}

      <BulkAddPill
        show={showBulkAddDialog}
        setShow={setShowBulkAddDialog}
        bulkPopulate={bulkPopulate}
        setBulkPopulate={setBulkPopulate}
      />
    </div>
  );
}
