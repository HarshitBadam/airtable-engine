export const BASE_COLORS: Array<{ bg: string; border: string; toolbar: string; text: string }> = [
  { bg: "#068A0D", border: "#117110", toolbar: "#E5FCE8", text: "#FFFFFF" },
  { bg: "#7D37EF", border: "#682FC4", toolbar: "#FCF3FF", text: "#FFFFFF" },
  { bg: "#FFBA06", border: "#D7980D", toolbar: "#FFF6DD", text: "#1D1F25" },
  { bg: "#616670", border: "#51555C", toolbar: "#F3F4F8", text: "#FFFFFF" },
  { bg: "#39CAFF", border: "#34A5DC", toolbar: "#E4F9FD", text: "#1D1F25" },
  { bg: "#156EE1", border: "#185BB9", toolbar: "#F1F5FF", text: "#FFFFFF" },
  { bg: "#DC043B", border: "#B50D33", toolbar: "#FFF2FA", text: "#FFFFFF" },
  { bg: "#D54402", border: "#AF390A", toolbar: "#FFECE2", text: "#FFFFFF" },
];

export interface BaseItem {
  id: string;
  name: string;
  isStarred: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt: Date;
  ownerId: string;
}

export interface UseBasesResult {
  bases: BaseItem[];
  isLoading: boolean;
  isError: boolean;
  createBase: (name: string) => { id: string };
}

/**
 * Generate a cuid-like ID client-side
 * Format: c + timestamp(base36) + random(base36)
 * This matches Prisma's cuid() format closely enough
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  const randomPart2 = Math.random().toString(36).substring(2, 6);
  return `c${timestamp}${randomPart}${randomPart2}`;
}

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

export function getBaseToolbarColor(id: string): string {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return BASE_COLORS[hash % BASE_COLORS.length]!.toolbar;
}

export function getBaseInitials(name: string): string {
  const alphanumeric = name.replace(/[^a-zA-Z0-9]/g, "");
  if (alphanumeric.length === 0) return "??";
  if (alphanumeric.length === 1) return alphanumeric.charAt(0).toUpperCase();
  return alphanumeric.substring(0, 2);
}

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

  return `Opened ${date.toLocaleDateString()}`;
}
