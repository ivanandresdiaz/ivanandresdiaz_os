/**
 * Clips: things saved from the internet by pasting their link, to use later.
 * Reels always bring their file; a YouTube video stays a link. Clips is a bank
 * to pass through: a Clip with its file moves to a Principle as a Reference.
 * See GLOSSARY.md and docs/adr/0004.
 */

export type ClipSource = "instagram" | "youtube";
export type ClipStatus = "link" | "downloading" | "ready" | "failed";

export const MAX_CLIP_TITLE = 200;

/** The longest video a Clip downloads. */
export const MAX_CLIP_SECONDS = 30 * 60;

/**
 * YouTube refuses Cloud Run ("Sign in to confirm you're not a bot"), so for now
 * a YouTube Clip stays a link. Turning this on brings back its Download button.
 */
export const YOUTUBE_DOWNLOADS = false;

/** A first run and Cloud Run's two retries. */
export const CLIP_ATTEMPTS = 3;

/** A download with no result after this long is given up: its runs timed out or never started. */
export const CLIP_GIVE_UP_MS = 4 * 60 * 60 * 1000;

export type ParsedLink = { source: ClipSource; url: string; youtubeId?: string };
export type LinkProblem = "not-a-link" | "unsupported" | "only-reels";

export const LINK_PROBLEM_TEXT: Record<LinkProblem, string> = {
  "not-a-link": "That isn't a link.",
  unsupported: "Only Instagram reels and YouTube videos, for now.",
  "only-reels": "Only reels from Instagram, for now.",
};

const YOUTUBE_ID = /^[\w-]{11}$/;
const REEL_CODE = /^[\w-]{5,}$/;

/** The one link a Clip is saved under, whichever way it was copied (share links, shorts, tracking params). */
export function parseClipLink(input: string): ParsedLink | { problem: LinkProblem } {
  let url: URL;
  try {
    const text = input.trim();
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { problem: "not-a-link" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { problem: "not-a-link" };
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "instagram.com") {
    // /reel/CODE, /reels/CODE, or /USER/reel/CODE
    const at = parts.findIndex((p) => p === "reel" || p === "reels");
    const code = at >= 0 ? parts[at + 1] : undefined;
    if (code && REEL_CODE.test(code)) return { source: "instagram", url: `https://www.instagram.com/reel/${code}/` };
    return { problem: "only-reels" };
  }

  let id: string | null | undefined;
  if (host === "youtu.be") id = parts[0];
  else if (host === "youtube.com" || host === "music.youtube.com") {
    if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (parts[0] === "shorts" || parts[0] === "live" || parts[0] === "embed") id = parts[1];
  }
  if (id && YOUTUBE_ID.test(id)) {
    return { source: "youtube", url: `https://www.youtube.com/watch?v=${id}`, youtubeId: id };
  }
  return { problem: url.hostname.includes(".") ? "unsupported" : "not-a-link" };
}

export function youtubeIdOf(url: string): string | null {
  const parsed = parseClipLink(url);
  return "youtubeId" in parsed ? (parsed.youtubeId ?? null) : null;
}

/** YouTube's own still for a video, public and permanent. */
export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

/** Where one run of a download leaves its file and its result. A Retry is a new run, with new keys. */
export function clipFileKey(clipId: string, run: string): string {
  return `clips/${clipId}/${run}.mp4`;
}
export function clipResultKey(clipId: string, run: string): string {
  return `clips/${clipId}/${run}.json`;
}

/** What the downloader leaves in result.json; see worker/clips/download.py. */
export type ClipResult =
  | {
      ok: true;
      title: string | null;
      durationS: number | null;
      contentType: string;
      sizeBytes: number;
      attempt: number;
    }
  | {
      ok: false;
      final: boolean;
      /** login, rate_limit and empty are Instagram refusing a cloud IP; they are retried before they are believed. */
      reason: "too_long" | "login" | "rate_limit" | "empty" | "unavailable" | "error";
      message: string;
      attempt: number;
      durationS?: number;
      title?: string | null;
    };

export type ClipOutcome =
  | { status: "downloading" }
  | { status: "ready"; title: string | null; durationS: number | null; contentType: string }
  | { status: "link" | "failed"; error: string; title: string | null; durationS: number | null };

/** What Instagram's refusals mean, once the retries ran out. */
const REFUSED_TEXT = {
  rate_limit: "Instagram is limiting downloads right now. Retry later.",
  empty: "Instagram didn't hand over the reel. It may be private or gone.",
  login: "Instagram wants a login. Retry later, or refresh its session.",
};

/** What a download's result (or its silence) means for the Clip. */
export function settleClip(result: ClipResult | null, startedAt: Date, now: Date): ClipOutcome {
  if (!result) {
    if (now.getTime() - startedAt.getTime() > CLIP_GIVE_UP_MS) {
      return { status: "failed", error: "The download never finished.", title: null, durationS: null };
    }
    return { status: "downloading" };
  }
  if (result.ok) {
    return { status: "ready", title: result.title, durationS: result.durationS, contentType: result.contentType };
  }
  const title = result.title ?? null;
  const durationS = result.durationS ?? null;
  if (result.reason === "too_long") {
    // Not a failure: it stays what a long YouTube video is anyway, a link.
    return { status: "link", error: "Longer than 30 minutes, so it stays a link.", title, durationS };
  }
  if (result.reason === "unavailable") {
    return { status: "failed", error: "The post is gone or private.", title, durationS };
  }
  if (!result.final && result.attempt < CLIP_ATTEMPTS - 1) return { status: "downloading" };
  const error = REFUSED_TEXT[result.reason as keyof typeof REFUSED_TEXT] ?? "Couldn't download.";
  return { status: "failed", error, title, durationS };
}

/** A Clip's title until it has one: what it is and where it came from. */
export function fallbackClipTitle(source: ClipSource): string {
  return source === "instagram" ? "Instagram reel" : "YouTube video";
}

export function canDownload(source: ClipSource): boolean {
  return source === "instagram" || YOUTUBE_DOWNLOADS;
}
