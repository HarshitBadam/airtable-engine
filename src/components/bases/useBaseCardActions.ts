/**
 * useBaseCardActions hook
 * Handles all mutations for base cards (rename, delete, toggle star)
 * with optimistic updates
 */

import { api } from "~/trpc/react";

export function useBaseCardActions() {
  const utils = api.useUtils();

  // Optimistic rename mutation
  const renameMutation = api.base.rename.useMutation({
    onMutate: async ({ id, name }) => {
      await utils.base.listMine.cancel();
      const previousMine = utils.base.listMine.getData();

      utils.base.listMine.setData(undefined, (old) =>
        old?.map((b) => (b.id === id ? { ...b, name } : b))
      );

      return { previousMine };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousMine) {
        utils.base.listMine.setData(undefined, context.previousMine);
      }
    },
    onSettled: () => {
      void utils.base.listMine.invalidate();
    },
  });

  // Optimistic delete mutation
  const deleteMutation = api.base.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.base.listMine.cancel();
      await utils.base.listStarred.cancel();

      const previousMine = utils.base.listMine.getData();
      const previousStarred = utils.base.listStarred.getData();

      utils.base.listMine.setData(undefined, (old) =>
        old?.filter((b) => b.id !== id)
      );
      utils.base.listStarred.setData(undefined, (old) =>
        old?.filter((b) => b.id !== id)
      );

      return { previousMine, previousStarred };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousMine) {
        utils.base.listMine.setData(undefined, context.previousMine);
      }
      if (context?.previousStarred) {
        utils.base.listStarred.setData(undefined, context.previousStarred);
      }
    },
    onSettled: () => {
      void utils.base.listMine.invalidate();
      void utils.base.listStarred.invalidate();
    },
  });

  // Optimistic star toggle mutation
  const toggleStarMutation = api.base.toggleStar.useMutation({
    onMutate: async ({ id }) => {
      await utils.base.listMine.cancel();
      await utils.base.listStarred.cancel();

      const previousMine = utils.base.listMine.getData();
      const previousStarred = utils.base.listStarred.getData();

      // Check both lists - base might be in starred but not in recently opened
      const baseFromMine = previousMine?.find((b) => b.id === id);
      const baseFromStarred = previousStarred?.find((b) => b.id === id);
      const baseToToggle = baseFromMine ?? baseFromStarred;
      const newIsStarred = baseToToggle ? !baseToToggle.isStarred : false;

      utils.base.listMine.setData(undefined, (old) =>
        old?.map((b) => (b.id === id ? { ...b, isStarred: newIsStarred } : b))
      );

      if (newIsStarred && baseToToggle) {
        utils.base.listStarred.setData(undefined, (old) =>
          old ? [{ ...baseToToggle, isStarred: true }, ...old] : [{ ...baseToToggle, isStarred: true }]
        );
      } else {
        utils.base.listStarred.setData(undefined, (old) =>
          old?.filter((b) => b.id !== id)
        );
      }

      return { previousMine, previousStarred };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousMine) {
        utils.base.listMine.setData(undefined, context.previousMine);
      }
      if (context?.previousStarred) {
        utils.base.listStarred.setData(undefined, context.previousStarred);
      }
    },
    onSettled: () => {
      void utils.base.listMine.invalidate();
      void utils.base.listStarred.invalidate();
    },
  });

  // Record open mutation - updates lastOpenedAt and moves base to top
  const recordOpenMutation = api.base.recordOpen.useMutation({
    onMutate: async ({ id }) => {
      await utils.base.listMine.cancel();
      await utils.base.listStarred.cancel();

      const previousMine = utils.base.listMine.getData();
      const previousStarred = utils.base.listStarred.getData();
      const now = new Date();

      // Update lastOpenedAt and move to top of list
      utils.base.listMine.setData(undefined, (old) => {
        if (!old) return old;
        const base = old.find((b) => b.id === id);
        if (!base) return old;
        const updated = { ...base, lastOpenedAt: now };
        return [updated, ...old.filter((b) => b.id !== id)];
      });

      utils.base.listStarred.setData(undefined, (old) => {
        if (!old) return old;
        const base = old.find((b) => b.id === id);
        if (!base) return old;
        const updated = { ...base, lastOpenedAt: now };
        return [updated, ...old.filter((b) => b.id !== id)];
      });

      return { previousMine, previousStarred };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousMine) {
        utils.base.listMine.setData(undefined, context.previousMine);
      }
      if (context?.previousStarred) {
        utils.base.listStarred.setData(undefined, context.previousStarred);
      }
    },
    onSettled: () => {
      void utils.base.listMine.invalidate();
      void utils.base.listStarred.invalidate();
    },
  });

  return {
    rename: (id: string, name: string) => renameMutation.mutate({ id, name }),
    delete: (id: string) => deleteMutation.mutate({ id }),
    toggleStar: (id: string) => toggleStarMutation.mutate({ id }),
    recordOpen: (id: string) => recordOpenMutation.mutate({ id }),
  };
}
