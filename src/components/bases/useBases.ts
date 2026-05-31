import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import { filterPendingDeletes } from "./pendingDeletes";
import { generateId, type BaseItem, type UseBasesResult } from "./baseUtils";

export type { BaseItem, UseBasesResult };
export {
  getBaseColor,
  getBaseBorderColor,
  getBaseTextColor,
  getBaseToolbarColor,
  getBaseInitials,
  formatRelativeTime,
} from "./baseUtils";

export function useBases(): UseBasesResult {
  const { data: session } = useSession();
  const utils = api.useUtils();

  const { data, isLoading, isError } = api.base.listMine.useQuery(undefined, {
    retry: false, // Don't retry on auth errors
    refetchOnWindowFocus: false, // Don't spam requests
    select: filterPendingDeletes, // Exclude bases mid-deletion
  });

  const createMutation = api.base.create.useMutation({
    onMutate: async ({ id, name }) => {
      await utils.base.listMine.cancel();

      const previousMine = utils.base.listMine.getData();

      const now = new Date();
      const optimisticBase: BaseItem = {
        id,
        name,
        isStarred: false,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        ownerId: session?.user?.id ?? "",
      };

      utils.base.listMine.setData(undefined, (old) =>
        old ? [optimisticBase, ...old] : [optimisticBase]
      );

      return { previousMine };
    },
    onError: (_err, _variables, context) => {
      console.error("createBase mutation error:", _err.message);
      if (context?.previousMine) {
        utils.base.listMine.setData(undefined, context.previousMine);
      }
    },
    onSettled: () => {
      void utils.base.listMine.invalidate();
    },
  });

  const createBase = (name: string): { id: string } => {
    const id = generateId();
    createMutation.mutate({ id, name });
    return { id };
  };

  return {
    bases: data ?? [],
    isLoading,
    isError,
    createBase,
  };
}
