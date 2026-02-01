/**
 * useBases hook
 * Returns mock data for bases list - currently returns empty state
 */

import { useState } from "react";

export interface Base {
  id: string;
  name: string;
  color: string;
  workspaceId: string;
  workspaceName: string;
  lastOpened: Date | null;
  starred: boolean;
}

export interface UseBasesResult {
  bases: Base[];
  isLoading: boolean;
  error: Error | null;
  starBase: (id: string) => void;
  unstarBase: (id: string) => void;
}

export function useBases(): UseBasesResult {
  const [bases] = useState<Base[]>([]);
  const [isLoading] = useState(false);
  const [error] = useState<Error | null>(null);

  const starBase = (id: string) => {
    console.log("Star base:", id);
    // TODO: Implement star functionality
  };

  const unstarBase = (id: string) => {
    console.log("Unstar base:", id);
    // TODO: Implement unstar functionality
  };

  return {
    bases,
    isLoading,
    error,
    starBase,
    unstarBase,
  };
}
