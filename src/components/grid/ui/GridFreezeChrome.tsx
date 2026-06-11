import React from "react";
import styles from "./GridContainer.module.css";
import { useWorkspace } from "./GridWorkspaceContext";
import { useVerticalScrollbar } from "~/components/grid/hooks/layout/useVerticalScrollbar";

interface GridFreezeChromoProps {
  effectiveHeaderHeight: number;
}

export function GridFreezeChrome({ effectiveHeaderHeight }: GridFreezeChromoProps) {
  const {
    scrollShadowRef,
    freezeSnapPreviewRef,
    freezeLineRef,
    freezePillRef,
    freezeTooltipRef,
    freezeWidth,
    handleFreezeDragStart,
    handleFreezeLineMouseMove,
    gridScrollerRef,
    scroll,
  } = useWorkspace();

  const { vThumbRef } = useVerticalScrollbar({ gridScrollerRef, scroll });

  return (
    <>
      <div
        ref={scrollShadowRef}
        className={styles.freezeScrollShadow}
        style={{ left: freezeWidth }}
      />

      <div ref={freezeSnapPreviewRef} className={styles.gridFreezeSnapPreview} />

      <div
        ref={freezeLineRef}
        className={styles.gridFreezeLine}
        style={{ left: freezeWidth - 3 }}
        onMouseDown={handleFreezeDragStart}
        onMouseMove={handleFreezeLineMouseMove}
      >
        <div ref={freezePillRef} className={styles.gridFreezeLinePill} />
        <div ref={freezeTooltipRef} className={styles.gridFreezeTooltip}>
          Drag to adjust the number of frozen columns
        </div>
      </div>

      <div
        className={styles.customVScrollTrack}
        style={{ top: effectiveHeaderHeight, bottom: 34 }}
      >
        <div ref={vThumbRef} className={styles.customVScrollThumb} />
      </div>
    </>
  );
}
