import { useState, useRef, useEffect } from "react";

interface TableItem {
  id: string;
  name: string;
}

interface UseTableTabsScrollResult {
  scrollProgress: number;
  hasOverflow: boolean;
  tabsScrollRef: React.RefObject<HTMLDivElement | null>;
  scrollToEnd: (direction: "left" | "right") => void;
}

export function useTableTabsScroll({ tables }: { tables: TableItem[] }): UseTableTabsScrollResult {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  const checkScrollProgress = () => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setHasOverflow(maxScroll > 1);
    if (maxScroll <= 0) {
      setScrollProgress(0);
    } else {
      setScrollProgress(Math.min(1, Math.max(0, scrollLeft / maxScroll)));
    }
  };

  const scrollToEnd = (direction: "left" | "right") => {
    const el = tabsScrollRef.current;
    if (!el) return;
    el.scrollTo({ left: direction === "left" ? 0 : el.scrollWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    checkScrollProgress();
    el.addEventListener("scroll", checkScrollProgress);
    const resizeObserver = new ResizeObserver(checkScrollProgress);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScrollProgress);
      resizeObserver.disconnect();
    };
    // tables is a dependency because new tables can change scroll overflow
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables]);

  return { scrollProgress, hasOverflow, tabsScrollRef, scrollToEnd };
}
