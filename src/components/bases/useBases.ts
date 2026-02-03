/**
 * useBases hook
 * Connects to tRPC for bases data fetching and mutations
 */

import { api } from "~/trpc/react";

export interface BaseItem {
  id: string;
  name: string;
  isStarred: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UseBasesResult {
  bases: BaseItem[];
  isLoading: boolean;
  isError: boolean;
  createBase: (name: string) => Promise<{ id: string }>;
}

/**
 * Color palette for base cards - Airtable-style colors
 * Each color has a main color, 2px border color, and text color
 */
const BASE_COLORS: Array<{ bg: string; border: string; text: string }> = [
  { bg: "#39CAFF", border: "#34A5DC", text: "#1D1F25" },  // cyan (dark text)
  { bg: "#7D37EF", border: "#682FC4", text: "#FFFFFF" },  // violet
  { bg: "#616670", border: "#51555C", text: "#FFFFFF" },  // grey
  { bg: "#156EE1", border: "#185BB9", text: "#FFFFFF" },  // blue
  { bg: "#FFBA06", border: "#D7980D", text: "#1D1F25" },  // yellow (dark text)
];

/**
 * Get a deterministic color pair for a base based on its ID
 */
export function getBaseColor(id: string): string {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return BASE_COLORS[hash % BASE_COLORS.length]!.bg;
}

export function getBaseBorderColor(id: string): string {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return BASE_COLORS[hash % BASE_COLORS.length]!.border;
}

export function getBaseTextColor(id: string): string {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return BASE_COLORS[hash % BASE_COLORS.length]!.text;
}

/**
 * Get initials from a base name (first 2 alphanumeric characters)
 */
export function getBaseInitials(name: string): string {
  // Extract only alphanumeric characters
  const alphanumeric = name.replace(/[^a-zA-Z0-9]/g, "");
  if (alphanumeric.length === 0) return "??";
  if (alphanumeric.length === 1) return alphanumeric.charAt(0).toUpperCase();
  // Return first two characters, preserving original case
  return alphanumeric.substring(0, 2);
}

/**
 * Format relative time (e.g., "Opened just now", "Opened 5 minutes ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "Opened just now";
  }
  if (diffMinutes < 60) {
    return `Opened ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }
  if (diffHours < 24) {
    return `Opened ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  if (diffDays < 30) {
    return `Opened ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }
  
  // For older dates, show the actual date
  return `Opened ${date.toLocaleDateString()}`;
}

export function useBases(): UseBasesResult {
  const utils = api.useUtils();
  
  const { data, isLoading, isError } = api.base.listMine.useQuery(undefined, {
    retry: false, // Don't retry on auth errors
    refetchOnWindowFocus: false, // Don't spam requests
  });
  
  // Optimistic create mutation
  const createMutation = api.base.create.useMutation({
    onMutate: async ({ name }) => {
      // Cancel outgoing refetches
      await utils.base.listMine.cancel();
      
      // Snapshot previous state
      const previousMine = utils.base.listMine.getData();
      
      // Create optimistic base with temporary ID
      const tempId = `temp-${Date.now()}`;
      const optimisticBase: BaseItem = {
        id: tempId,
        name,
        isStarred: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Optimistically add to list (at the beginning since it's newest)
      utils.base.listMine.setData(undefined, (old) =>
        old ? [optimisticBase, ...old] : [optimisticBase]
      );
      
      return { previousMine, tempId };
    },
    onError: (_err, _variables, context) => {
      console.error("createBase mutation error:", _err.message);
      // Rollback on error
      if (context?.previousMine) {
        utils.base.listMine.setData(undefined, context.previousMine);
      }
    },
    onSettled: () => {
      // Refetch to get the real data with correct ID
      void utils.base.listMine.invalidate();
    },
  });

  const createBase = async (name: string): Promise<{ id: string }> => {
    const result = await createMutation.mutateAsync({ name });
    return { id: result.id };
  };

  return {
    bases: data ?? [],
    isLoading,
    isError,
    createBase,
  };
}
