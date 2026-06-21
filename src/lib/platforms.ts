export const platformOptions = [
  { value: "MOMENTS", label: "朋友圈" },
  { value: "XIAOHONGSHU", label: "小红书" }
] as const;

export type ContentPlatformValue = (typeof platformOptions)[number]["value"];

export function normalizePlatform(value?: string | null): ContentPlatformValue {
  return value === "XIAOHONGSHU" || value === "xiaohongshu" ? "XIAOHONGSHU" : "MOMENTS";
}

export function platformLabel(value?: string | null) {
  return normalizePlatform(value) === "XIAOHONGSHU" ? "小红书" : "朋友圈";
}
