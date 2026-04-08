/**
 * Rules for “real” BGG game cover art vs placeholders (geeklist report only).
 */

export function isBggNoImageThumbnailUrl(t) {
  return (
    t.includes("/image/1657689") || /(?:^|\/|_)pic1657689(?:\b|[._])/i.test(t)
  );
}

export function hasRealGameThumbnail(value) {
  if (value == null || typeof value !== "string") return false;
  const t = value.trim();
  if (!t || t === "N/A") return false;
  if (/placehold/i.test(t)) return false;
  if (/via\.placeholder/i.test(t)) return false;
  if (isBggNoImageThumbnailUrl(t)) return false;
  return /^https?:\/\//i.test(t) || t.startsWith("//");
}
