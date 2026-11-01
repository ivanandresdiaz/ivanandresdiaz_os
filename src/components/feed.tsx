"use client";

import { useCallback, useEffect, useLayoutEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { DOUBLE_TAP_MS, MAX_DAILY_LIKES, stepLikes, UNLIKE_HOLD_MS } from "@/domain/feed";
import { AUDIO_SKIP_SECONDS, formatClock, IMAGE_STORY_MS, skipTo } from "@/domain/references";
import { likeReference, saveFeedPosition } from "@/server/actions";
import type { FeedItem, FeedLikes, FeedView, TopReference } from "@/server/queries";
import { UNTITLED_AUDIO } from "./references";
import { PrincipleCaption } from "./story-viewer";

const SETTLE_MS = 120;
const NO_LIKES = { total: 0, today: 0 };

type LikeChange = { id: string; delta: 1 | -1 };

function applyLike(likes: FeedLikes, { id, delta }: LikeChange): FeedLikes {
  const current = likes[id] ?? NO_LIKES;
  const today = stepLikes(current.today, delta);
  return { ...likes, [id]: { total: current.total + today - current.today, today } };
}

type Mode = "start" | "playing" | "end";

/**
 * Today's Feed. A start card, then a full-screen vertical feed (swipe up for the
 * next Reference; each one moves on by itself when it ends), then the end with the Top 10.
 */
export function Feed({ feed }: { feed: FeedView }) {
  // The list and its signed links stay as first loaded, so a refresh never restarts what is playing.
  const [items] = useState(feed.items);
  const [mode, setMode] = useState<Mode>(feed.position >= feed.items.length && feed.items.length > 0 ? "end" : "start");
  const [startAt, setStartAt] = useState(feed.position >= feed.items.length ? 0 : feed.position);
  const [seen, setSeen] = useState(feed.seen);
  // A reducer, so quick taps stack on top of each other until the server answers.
  const [likes, changeLikes] = useOptimistic(feed.likes, applyLike);
  const [, startTransition] = useTransition();
  const [player, setPlayer] = useState<HTMLVideoElement | null>(null);

  /** Gives (+1) or takes back (-1) one of today's Likes; false when there is nothing to change. */
  function like(id: string, delta: 1 | -1) {
    const today = (likes[id] ?? NO_LIKES).today;
    if (stepLikes(today, delta) === today) return false;
    startTransition(async () => {
      changeLikes({ id, delta });
      await likeReference({ referenceId: id, delta });
    });
    return true;
  }

  /** Runs inside the tap: on iPhone, a media element may play with sound only once a tap has played it. */
  function begin(from: number) {
    const el = player ?? createPlayer();
    setPlayer(el);
    const unlockWith = items[from]?.kind !== "image" ? items[from] : items.find((i) => i.kind !== "image");
    if (unlockWith && el.dataset.id !== unlockWith.id) {
      el.src = unlockWith.url;
      el.dataset.id = unlockWith.id;
    }
    el.muted = false;
    el.play().catch(() => {});
    // Starting on an image: the play above only unlocks the sound, so nothing should be heard yet.
    if (items[from]?.kind === "image") el.pause();
    setStartAt(from);
    setMode("playing");
  }

  if (items.length === 0) {
    return (
      <div className="card flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Feed</h1>
        <p className="text-sm text-muted">
          No References yet. Upload images, videos or audio to a Principle to fill it.
        </p>
      </div>
    );
  }

  if (mode === "playing" && player) {
    return (
      <FeedPlayer
        items={items}
        player={player}
        startAt={startAt}
        likes={likes}
        onLike={like}
        onReach={(index) => setSeen((s) => Math.max(s, Math.min(index + 1, items.length)))}
        onClose={(index) => {
          player.pause();
          setStartAt(index >= items.length ? 0 : index);
          setMode(index >= items.length ? "end" : "start");
        }}
      />
    );
  }

  if (mode === "end") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <section className="card flex flex-col items-start gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Done for today</h1>
          <p className="text-sm text-muted">
            You saw today’s {items.length} Reference{items.length === 1 ? "" : "s"}. There is no more Feed until
            tomorrow.
          </p>
          <button type="button" className="btn" onClick={() => begin(0)}>
            Watch today’s again
          </button>
        </section>
        <TopList top={feed.top} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <section className="card flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Feed</h1>
        <p className="text-sm text-muted">
          {seen} of {items.length} seen today. Optional: it gives no XP, at your own pace.
        </p>
        <button type="button" className="btn-primary" onClick={() => begin(startAt)}>
          {seen > 0 ? "Continue" : "Start"}
        </button>
      </section>
    </div>
  );
}

function createPlayer() {
  const el = document.createElement("video");
  el.playsInline = true;
  el.setAttribute("playsinline", "");
  el.preload = "auto";
  el.className = "pointer-events-none absolute inset-0 h-full w-full object-contain";
  return el;
}

function FeedPlayer({
  items,
  player,
  startAt,
  likes,
  onLike,
  onReach,
  onClose,
}: {
  items: FeedItem[];
  player: HTMLVideoElement;
  startAt: number;
  likes: FeedLikes;
  onLike: (id: string, delta: 1 | -1) => boolean;
  onReach: (index: number) => void;
  onClose: (index: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const holders = useRef<(HTMLDivElement | null)[]>([]);
  const settle = useRef(0);
  const tap = useRef(0);
  const elapsed = useRef(0);
  const [active, setActive] = useState(startAt);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(player.muted);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [burst, setBurst] = useState(0);
  const current = items[active];

  const goTo = useCallback((index: number, smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: index * el.clientHeight, behavior: smooth ? "smooth" : "instant" });
  }, []);

  const next = useCallback(() => goTo(active + 1), [goTo, active]);

  useLayoutEffect(() => {
    goTo(startAt, false);
  }, [goTo, startAt]);

  // Ivan reaching a Reference counts as seeing it; the end slide marks the Feed done.
  useEffect(() => {
    onReach(active);
    saveFeedPosition({ position: active });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // The one player moves into the active Reference, so its sound stays unlocked.
  useEffect(() => {
    elapsed.current = 0;
    if (!current || current.kind === "image") {
      player.pause();
      return;
    }
    const holder = holders.current[active];
    if (holder && player.parentElement !== holder) holder.appendChild(player);
    if (player.dataset.id !== current.id) {
      player.src = current.url;
      player.dataset.id = current.id;
    }
    player.currentTime = 0;
  }, [active, current, player]);

  useEffect(() => {
    if (!current || current.kind === "image" || failed) return;
    if (paused) return player.pause();
    player.play().catch(() => {
      // Sound can still be refused; fall back to muted playback.
      player.muted = true;
      setMuted(true);
      player.play().catch(() => {});
    });
  }, [active, current, paused, failed, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    const ended = () => next();
    const error = () => setFailed(true);
    const timeUpdate = () => {
      setTime(player.currentTime);
      if (Number.isFinite(player.duration)) setDuration(player.duration);
    };
    player.addEventListener("ended", ended);
    player.addEventListener("error", error);
    player.addEventListener("timeupdate", timeUpdate);
    player.addEventListener("loadedmetadata", timeUpdate);
    return () => {
      player.removeEventListener("ended", ended);
      player.removeEventListener("error", error);
      player.removeEventListener("timeupdate", timeUpdate);
      player.removeEventListener("loadedmetadata", timeUpdate);
    };
  }, [player, next]);

  // Images (and media that can't play) stay on screen for a while, then move on.
  useEffect(() => {
    if (!current || paused || !(current.kind === "image" || failed)) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      elapsed.current += now - last;
      last = now;
      if (elapsed.current >= IMAGE_STORY_MS) return next();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [current, paused, failed, next]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "Escape") onClose(active);
      else if (event.key === "ArrowDown") goTo(active + 1);
      else if (event.key === "ArrowUp") goTo(active - 1);
      else if (event.key === " ") {
        event.preventDefault();
        setPaused((p) => !p);
      } else return;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo, onClose]);

  function onScroll() {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = scroller.current;
      if (!el) return;
      const index = Math.round(el.scrollTop / el.clientHeight);
      if (index === active) return;
      window.clearTimeout(tap.current);
      tap.current = 0;
      setActive(index);
      setBurst(0);
      setPaused(false);
      setFailed(false);
      setTime(0);
      setDuration(0);
    }, SETTLE_MS);
  }

  /** One more Like, with the burst only when it counted (none past the daily max). */
  function likeOnce(item: FeedItem) {
    if (onLike(item.id, 1)) setBurst((b) => b + 1);
  }

  // Holding the heart takes back one of today's Likes; the click that ends the hold then gives none.
  const hold = useRef({ timer: 0, fired: false });
  function startHold(item: FeedItem) {
    window.clearTimeout(hold.current.timer);
    hold.current.fired = false;
    hold.current.timer = window.setTimeout(() => {
      hold.current.fired = true;
      onLike(item.id, -1);
    }, UNLIKE_HOLD_MS);
  }
  function endHold() {
    window.clearTimeout(hold.current.timer);
  }

  /** One tap pauses; a second tap within a moment is a double tap and gives a Like instead. */
  function onTap(item: FeedItem) {
    if (tap.current) {
      window.clearTimeout(tap.current);
      tap.current = 0;
      likeOnce(item);
      return;
    }
    tap.current = window.setTimeout(() => {
      tap.current = 0;
      setPaused((p) => !p);
    }, DOUBLE_TAP_MS);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black text-white select-none">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="h-dvh snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none]"
      >
        {items.map((item, i) => {
          const isActive = i === active;
          const like = likes[item.id] ?? NO_LIKES;
          const listening = item.kind === "audio" && !(isActive && failed);
          return (
            <section
              key={item.id}
              aria-label={`Reference ${i + 1} of ${items.length}`}
              onClick={() => isActive && onTap(item)}
              onContextMenu={(event) => event.preventDefault()}
              className={`relative flex h-dvh snap-start snap-always touch-manipulation items-center justify-center overflow-hidden ${
                item.kind === "audio" ? "bg-gradient-to-b from-neutral-800 via-neutral-900 to-black" : ""
              }`}
            >
              {item.kind === "image" ? (
                // Signed R2 links expire, so they bypass the Next.js image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt=""
                  draggable={false}
                  loading={Math.abs(i - active) <= 1 ? "eager" : "lazy"}
                  className="pointer-events-none max-h-full max-w-full object-contain"
                />
              ) : item.kind === "video" ? (
                <video
                  src={`${item.url}#t=0.001`}
                  muted
                  playsInline
                  preload={Math.abs(i - active) <= 1 ? "metadata" : "none"}
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <div className="pointer-events-none flex max-w-sm flex-col items-center gap-4 px-6 text-center">
                  <span aria-hidden className="text-8xl">
                    🎧
                  </span>
                  <p className="line-clamp-3 text-lg font-medium break-words">{item.title || UNTITLED_AUDIO}</p>
                  {isActive && (
                    <p className="text-sm text-white/70 tabular-nums">
                      {formatClock(time)} / {formatClock(duration)}
                    </p>
                  )}
                </div>
              )}
              <div
                ref={(el) => {
                  holders.current[i] = el;
                }}
                className={`pointer-events-none absolute inset-0 ${item.kind === "audio" ? "opacity-0" : ""}`}
              />

              {isActive && failed && (
                <p className="absolute max-w-xs px-6 text-center text-sm text-white/80">
                  This file can’t play in this browser. MP4 (H.264) and MP3 play everywhere.
                </p>
              )}
              {isActive && paused && !listening && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute flex size-20 items-center justify-center rounded-full bg-black/40 pl-1 text-4xl text-white/90"
                >
                  ▶
                </span>
              )}
              {isActive && burst > 0 && (
                <span key={burst} aria-hidden className="pointer-events-none like-burst absolute text-8xl text-red-500">
                  ♥
                </span>
              )}

              <button
                type="button"
                onPointerDown={() => startHold(item)}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onPointerCancel={endHold}
                onContextMenu={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  if (hold.current.fired) hold.current.fired = false;
                  else likeOnce(item);
                }}
                aria-label={`Like (${like.today} of ${MAX_DAILY_LIKES} today). Hold to take one back.`}
                className={`absolute right-2 flex min-w-11 flex-col items-center gap-0.5 text-xs drop-shadow [-webkit-touch-callout:none] ${
                  listening
                    ? "bottom-[max(11rem,calc(env(safe-area-inset-bottom)+10rem))]"
                    : "bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))]"
                }`}
              >
                <span className={`text-3xl leading-none ${like.today > 0 ? "text-red-500" : "text-white"}`}>
                  {like.today > 0 ? "♥" : "♡"}
                </span>
                <span className="tabular-nums">{like.total}</span>
                <span aria-hidden className="flex gap-0.5">
                  {Array.from({ length: MAX_DAILY_LIKES }, (_, n) => (
                    <span
                      key={n}
                      className={`size-1.5 rounded-full ${n < like.today ? "bg-red-500" : "border border-white/70"}`}
                    />
                  ))}
                </span>
              </button>

              {listening ? (
                <div
                  onClick={(event) => event.stopPropagation()}
                  className="absolute inset-x-0 bottom-0 flex flex-col gap-4 bg-gradient-to-t from-black/60 to-transparent px-6 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
                >
                  <PrincipleCaption title={item.principleTitle} />
                  {isActive && (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={duration || 0}
                        step="any"
                        value={Math.min(time, duration || 0)}
                        onChange={(event) => {
                          player.currentTime = Number(event.target.value);
                          setTime(player.currentTime);
                        }}
                        aria-label="Position"
                        className="w-full accent-white"
                      />
                      <div className="flex items-center justify-center gap-10 text-sm">
                        <button
                          type="button"
                          onClick={() => (player.currentTime = skipTo(time, -AUDIO_SKIP_SECONDS, duration))}
                          aria-label={`Back ${AUDIO_SKIP_SECONDS} seconds`}
                        >
                          −{AUDIO_SKIP_SECONDS}s
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaused((p) => !p)}
                          aria-label={paused ? "Play" : "Pause"}
                          className="flex size-12 items-center justify-center rounded-full bg-white text-lg text-black"
                        >
                          {paused ? "▶" : "❚❚"}
                        </button>
                        <button
                          type="button"
                          onClick={() => (player.currentTime = skipTo(time, AUDIO_SKIP_SECONDS, duration))}
                          aria-label={`Forward ${AUDIO_SKIP_SECONDS} seconds`}
                        >
                          +{AUDIO_SKIP_SECONDS}s
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-4 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <PrincipleCaption title={item.principleTitle} />
                </div>
              )}
            </section>
          );
        })}

        <section className="flex h-dvh snap-start snap-always flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-2xl font-semibold">Done for today</p>
          <p className="text-sm text-white/70">That was today’s Feed. No more until tomorrow.</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => goTo(0)}
              className="rounded-md border border-white/30 px-3 py-1.5 text-sm"
            >
              Watch again
            </button>
            <button
              type="button"
              onClick={() => onClose(items.length)}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black"
            >
              See your Top 10
            </button>
          </div>
        </section>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-4 bg-gradient-to-b from-black/50 to-transparent px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6 text-sm">
        <span className="mr-auto text-white/80 tabular-nums">
          {Math.min(active + 1, items.length)} / {items.length}
          {paused && current && <span className="ml-2 text-xs text-white/60">Paused</span>}
        </span>
        {current && current.kind !== "image" && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Unmute" : "Mute"}
            className="pointer-events-auto min-h-11 min-w-11"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}
        <button
          type="button"
          onClick={() => onClose(active)}
          aria-label="Close"
          title="Close"
          className="pointer-events-auto min-h-11 min-w-11 text-2xl leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function TopList({ top }: { top: TopReference[] }) {
  return (
    <section className="card flex flex-col gap-3">
      <h2 className="font-semibold">Top 10</h2>
      {top.length === 0 ? (
        <p className="text-sm text-muted">Like References in the Feed to see which ones move you most.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {top.map((item, i) => (
            <li key={item.id} className="flex items-center gap-3">
              <span className="w-5 text-center text-sm font-semibold">{i + 1}</span>
              <Thumb item={item} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.principleTitle}</div>
                {item.kind === "audio" && (
                  <div className="truncate text-xs text-muted">{item.title || UNTITLED_AUDIO}</div>
                )}
              </div>
              <span className="text-sm tabular-nums">
                <span className="text-red-500">♥</span> {item.likes}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Thumb({ item }: { item: FeedItem }) {
  const box = "aspect-[9/16] w-10 shrink-0 overflow-hidden rounded bg-line";
  if (item.kind === "audio")
    return (
      <span aria-hidden className={`${box} flex items-center justify-center bg-neutral-800 text-lg`}>
        🎧
      </span>
    );
  if (item.kind === "video")
    return (
      <video
        src={`${item.url}#t=0.001`}
        muted
        playsInline
        preload="metadata"
        className={`${box} pointer-events-none object-cover`}
      />
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.url} alt="" loading="lazy" className={`${box} object-cover`} />;
}
