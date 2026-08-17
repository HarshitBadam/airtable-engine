export const STORAGE_LIMIT_EVENT = "lyra:storage-limit";

const STORAGE_LIMIT_MARKERS = [
  "53100",
  "project size limit",
  "neon.max_cluster_size",
];

export function isStorageLimitError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const normalized = message.toLowerCase();
  return STORAGE_LIMIT_MARKERS.some((marker) =>
    normalized.includes(marker.toLowerCase()),
  );
}

export function announceStorageLimit(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STORAGE_LIMIT_EVENT));
}
