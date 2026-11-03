/** A Description is a Long text: room for a page or two, not a book. */
export const MAX_DESCRIPTION = 20_000;

/** A Link's title and address are short: a resource to open, not a note. */
export const MAX_LINK_TITLE = 120;
export const MAX_LINK_URL = 2048;

/**
 * The address Ivan pasted, made openable: "aihero.dev/skills" gains https://.
 * Only web pages (http or https) are Links; anything else is null.
 */
export function normalizeLinkUrl(input: string): string | null {
  const raw = input.trim();
  if (raw === "" || raw.length > MAX_LINK_URL || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
  return url.href;
}

/** What a Link shows: its title, or else its address without the noise (aihero.dev/skills). */
export function linkLabel(link: { url: string; title: string }): string {
  if (link.title.trim()) return link.title.trim();
  try {
    const url = new URL(link.url);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${host}${path}${url.search}`;
  } catch {
    return link.url;
  }
}
