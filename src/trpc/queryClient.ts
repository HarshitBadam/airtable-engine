import {
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";
import { toast } from "sonner";
import {
  announceStorageLimit,
  isStorageLimitError,
} from "~/shared/storageLimit";

function handleRequestError(error: unknown) {
  if (isStorageLimitError(error)) {
    announceStorageLimit();
    return;
  }

  const message =
    error instanceof Error ? error.message : "Something went wrong";
  toast.error(message);
}

function handleQueryError(error: unknown) {
  if (isStorageLimitError(error)) announceStorageLimit();
}

export const createQueryClient = () =>
  new QueryClient({
    mutationCache: new MutationCache({
      onError: handleRequestError,
    }),
    queryCache: new QueryCache({
      onError: handleQueryError,
    }),
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
