import { api } from "~/trpc/react";
import { filterPendingDeletes } from "./pendingDeletes";

export type StarredBaseItem = { id: string; name: string };

export function useStarredBases(): { starredBases: StarredBaseItem[] } {
  const { data: starredBases = [] } = api.base.listStarred.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    select: filterPendingDeletes,
  });
  return { starredBases };
}
