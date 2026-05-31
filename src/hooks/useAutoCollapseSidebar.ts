import { useEffect, useRef } from "react";
import { SIDEBAR_AUTO_COLLAPSE_WIDTH } from "~/shared/constants";

export function useAutoCollapseSidebar(
  setSidebarExpanded: React.Dispatch<React.SetStateAction<boolean>>
): void {
  const wasAutoCollapsedRef = useRef(false);

  useEffect(() => {
    let prevWidth = window.innerWidth;

    const handleResize = () => {
      const width = window.innerWidth;
      const wasNarrow = prevWidth <= SIDEBAR_AUTO_COLLAPSE_WIDTH;
      const isNarrow = width <= SIDEBAR_AUTO_COLLAPSE_WIDTH;

      if (!wasNarrow && isNarrow) {
        setSidebarExpanded((prev) => {
          if (prev) {
            wasAutoCollapsedRef.current = true;
            return false;
          }
          return prev;
        });
      }

      if (wasNarrow && !isNarrow) {
        if (wasAutoCollapsedRef.current) {
          wasAutoCollapsedRef.current = false;
          setSidebarExpanded(true);
        }
      }

      prevWidth = width;
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebarExpanded]);
}
