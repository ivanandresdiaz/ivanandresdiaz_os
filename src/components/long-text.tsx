"use client";

import { useEffect, useRef, useState } from "react";
import {
  type CoachReview,
  diffWords,
  insertDictation,
  MAX_DICTATION_SECONDS,
  MISTAKE_LABEL,
  type Selection,
} from "@/domain/english";
import { coachEnglish, createDictationUpload, discardDictation, transcribeDictation } from "@/server/actions";
import { aiTools } from "./ai-tools";

type Props = {
  /** Submitted with the surrounding form under this name. */
  name?: string;
  id?: string;
  /** Uncontrolled: the saved text; "Unsaved" shows while the field differs from it. */
  defaultValue?: string;
  /** Controlled: the caller owns the text (and says itself when it is unsaved). */
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  "aria-label"?: string;
  /** The text is Markdown, so the Coach keeps its formatting. */
  markdown?: boolean;
  className?: string;
};

/**
 * A Long text: a textarea with Dictation (speak and the words appear where the
 * cursor was) and the English Coach (mistakes, and a polished version to use).
 */
export function LongText({
  name,
  id,
  defaultValue = "",
  value: controlled,
  onValueChange,
  placeholder,
  rows,
  autoFocus,
  "aria-label": ariaLabel,
  markdown = false,
  className = "input",
}: Props) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [own, setOwn] = useState(defaultValue);
  // After a save the page brings the new text: it becomes the saved one.
  const [saved, setSaved] = useState(defaultValue);
  if (saved !== defaultValue) {
    setSaved(defaultValue);
    setOwn(defaultValue);
  }
  const value = controlled ?? own;

  function change(next: string) {
    if (controlled === undefined) setOwn(next);
    onValueChange?.(next);
  }

  // A form that resets after creating something (e.g. a new Campaign) empties the field too.
  useEffect(() => {
    const form = field.current?.form;
    if (!form || controlled !== undefined) return;
    const reset = () => setOwn(defaultValue);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [controlled, defaultValue]);

  const dictation = useDictation((spoken, at) => {
    // The field itself holds the latest text, even if it changed while recording.
    const { text, caret } = insertDictation(field.current?.value ?? value, spoken, at);
    change(text);
    requestAnimationFrame(() => {
      const el = field.current;
      if (!el || !at) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  });

  const coach = useCoach(markdown);
  const unsaved = controlled === undefined && value !== defaultValue;

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        ref={field}
        id={id}
        name={name}
        value={value}
        onChange={(event) => change(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className={`${className} field-sizing-content`}
      />
      <Toolbar
        dictation={dictation}
        onDictate={() => {
          const el = field.current;
          const focused = el && document.activeElement === el;
          dictation.start(focused ? { start: el.selectionStart, end: el.selectionEnd } : null);
        }}
        coaching={coach.state === "loading"}
        onCoach={() => coach.run(value)}
        unsaved={unsaved}
      />
      {coach.state === "error" && <p className="text-xs text-red-600 dark:text-red-400">{coach.error}</p>}
      {coach.panel && (
        <CoachPanel
          panel={coach.panel}
          value={value}
          loading={coach.state === "loading"}
          onAgain={() => coach.run(value)}
          onUse={(polished) => {
            coach.remember(value);
            change(polished);
          }}
          onBack={(mine) => change(mine)}
          onClose={coach.close}
        />
      )}
    </div>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function Toolbar({
  dictation,
  onDictate,
  coaching,
  onCoach,
  unsaved,
}: {
  dictation: Dictation;
  onDictate: () => void;
  coaching: boolean;
  onCoach: () => void;
  unsaved: boolean;
}) {
  const tools = aiTools;
  const { phase } = dictation;
  const missing = [!tools.dictation && "OPENAI_API_KEY", !tools.coach && "ANTHROPIC_API_KEY"].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {phase.kind === "recording" ? (
        <>
          <button
            type="button"
            onClick={dictation.stop}
            className="btn border-red-500 text-red-600 dark:text-red-400"
            aria-label="Stop and transcribe"
          >
            <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden />
            <span className="tabular-nums">{clock(phase.seconds)}</span>
          </button>
          <button type="button" onClick={dictation.cancel} className="btn" aria-label="Cancel the Dictation">
            ✕
          </button>
        </>
      ) : phase.kind === "working" ? (
        <span className="text-muted">{phase.step}…</span>
      ) : phase.kind === "failed" ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-red-600 dark:text-red-400">{phase.error}</span>
          {phase.canRetry && (
            <button type="button" onClick={dictation.retry} className="btn">
              Retry
            </button>
          )}
          <button type="button" onClick={dictation.discard} className="btn">
            Discard
          </button>
        </span>
      ) : (
        <button
          type="button"
          // Remember the cursor before the tap takes the focus away from the field.
          onPointerDown={(event) => event.preventDefault()}
          onClick={onDictate}
          disabled={!tools.dictation}
          className="btn"
        >
          🎙 Dictate
        </button>
      )}
      <button type="button" onClick={onCoach} disabled={!tools.coach || coaching} className="btn">
        {coaching ? "Coaching…" : "✨ Coach"}
      </button>
      {missing.length > 0 && <span className="text-xs text-muted">Set {missing.join(" and ")}</span>}
      {unsaved && <span className="ml-auto text-xs text-muted">Unsaved</span>}
    </div>
  );
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// ─── Dictation ───────────────────────────────────────────────────────────────

type Phase =
  | { kind: "idle" }
  | { kind: "recording"; seconds: number }
  | { kind: "working"; step: "Uploading" | "Transcribing" }
  | { kind: "failed"; error: string; canRetry: boolean };

type Dictation = ReturnType<typeof useDictation>;

/** The recording that failed to become text, kept so it can be retried. */
type Pending = { blob: Blob; contentType: string; key: string | null; at: Selection | null };

const RECORDING_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];

function useDictation(onText: (spoken: string, at: Selection | null) => void) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const session = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    chunks: Blob[];
    at: Selection | null;
    timer: number;
    cancelled: boolean;
  } | null>(null);
  const pending = useRef<Pending | null>(null);

  function release() {
    const s = session.current;
    if (!s) return;
    window.clearInterval(s.timer);
    s.stream.getTracks().forEach((track) => track.stop());
    session.current = null;
  }

  // Leaving the page mid-recording turns the microphone off.
  useEffect(() => () => release(), []);

  async function start(at: Selection | null) {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPhase({ kind: "failed", error: "The microphone is not available.", canRetry: false });
      return;
    }
    const mimeType = RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 });
    const startedAt = Date.now();
    const s = {
      recorder,
      stream,
      chunks: [] as Blob[],
      at,
      cancelled: false,
      timer: window.setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        if (seconds >= MAX_DICTATION_SECONDS) recorder.stop();
        else setPhase({ kind: "recording", seconds });
      }, 250),
    };
    session.current = s;
    recorder.ondataavailable = (event) => event.data.size > 0 && s.chunks.push(event.data);
    recorder.onstop = () => {
      release();
      if (s.cancelled) return;
      const contentType = recorder.mimeType || mimeType || "audio/webm";
      pending.current = { blob: new Blob(s.chunks, { type: contentType }), contentType, key: null, at: s.at };
      void send();
    };
    recorder.start();
    setPhase({ kind: "recording", seconds: 0 });
  }

  function stop() {
    const s = session.current;
    if (s && s.recorder.state !== "inactive") s.recorder.stop();
  }

  function cancel() {
    const s = session.current;
    if (!s) return;
    s.cancelled = true;
    if (s.recorder.state !== "inactive") s.recorder.stop();
    release();
    setPhase({ kind: "idle" });
  }

  /** Uploads the recording (unless it already is) and turns it into text. */
  async function send() {
    const p = pending.current;
    if (!p) return;
    try {
      if (!p.key) {
        setPhase({ kind: "working", step: "Uploading" });
        const upload = await createDictationUpload({ contentType: p.contentType, size: p.blob.size });
        if (!upload.ok) {
          pending.current = null;
          setPhase({ kind: "failed", error: upload.error, canRetry: false });
          return;
        }
        const res = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": p.contentType.split(";")[0] },
          body: p.blob,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        p.key = upload.key;
      }
      setPhase({ kind: "working", step: "Transcribing" });
      const result = await transcribeDictation({ key: p.key, contentType: p.contentType });
      if (!result.ok) {
        setPhase({ kind: "failed", error: result.error, canRetry: true });
        return;
      }
      pending.current = null;
      setPhase({ kind: "idle" });
      onText(result.text, p.at);
    } catch {
      setPhase({ kind: "failed", error: "The connection failed.", canRetry: true });
    }
  }

  function discard() {
    const key = pending.current?.key;
    pending.current = null;
    setPhase({ kind: "idle" });
    if (key) void discardDictation({ key });
  }

  return { phase, start, stop, cancel, retry: () => void send(), discard };
}

// ─── English Coach ───────────────────────────────────────────────────────────

/** A review and the text it was for; `mine` is the text before "Use polished". */
type Panel = { source: string; review: CoachReview; mine: string | null };

function useCoach(markdown: boolean) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);

  async function run(text: string) {
    setState("loading");
    try {
      const result = await coachEnglish({ text, markdown });
      if (!result.ok) {
        setError(result.error);
        setState("error");
        return;
      }
      setPanel({ source: text, review: result.review, mine: null });
      setState("idle");
    } catch {
      setError("The connection failed. Try again.");
      setState("error");
    }
  }

  return {
    state,
    error,
    panel,
    run,
    remember: (mine: string) => setPanel((p) => p && { ...p, mine }),
    close: () => {
      setPanel(null);
      setState("idle");
    },
  };
}

function CoachPanel({
  panel,
  value,
  loading,
  onAgain,
  onUse,
  onBack,
  onClose,
}: {
  panel: Panel;
  value: string;
  loading: boolean;
  onAgain: () => void;
  onUse: (polished: string) => void;
  onBack: (mine: string) => void;
  onClose: () => void;
}) {
  const { review, source, mine } = panel;
  const using = value === review.polished && mine !== null;
  const outdated = value !== source && value !== review.polished;
  const changes = diffWords(source, review.polished);

  return (
    <section aria-label="English Coach" className="card flex flex-col gap-3 text-sm">
      <header className="flex items-center gap-2">
        <h3 className="font-semibold">English Coach</h3>
        <span className="text-xs text-muted">
          {review.mistakes.length === 0
            ? "No mistakes"
            : `${review.mistakes.length} mistake${review.mistakes.length === 1 ? "" : "s"}`}
        </span>
        <button type="button" onClick={onClose} aria-label="Close the Coach" className="ml-auto text-lg leading-none text-muted hover:text-foreground">
          ×
        </button>
      </header>

      {outdated && (
        <p className="flex flex-wrap items-center gap-2 rounded-md bg-background px-2 py-1.5 text-xs text-muted">
          Outdated: the text changed after this review.
          <button type="button" onClick={onAgain} disabled={loading} className="btn">
            {loading ? "Coaching…" : "Coach again"}
          </button>
        </p>
      )}

      {review.mistakes.length > 0 && (
        <ol className="flex flex-col gap-2">
          {review.mistakes.map((m, i) => (
            <li key={i} className="flex flex-col gap-0.5">
              <span className="text-xs font-medium tracking-wide text-muted uppercase">{MISTAKE_LABEL[m.kind]}</span>
              <span>
                <s className="text-red-600 dark:text-red-400">{m.original}</s> →{" "}
                <span className="font-medium text-green-700 dark:text-green-400">{m.correction}</span>
              </span>
              <span className="text-muted">{m.why}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-col gap-1">
        <span className="label">Polished version</span>
        <p className="rounded-md border border-line bg-background p-2 leading-relaxed whitespace-pre-wrap">
          {changes
            ? changes.map((part, i) =>
                part.kind === "same" ? (
                  <span key={i}>{part.text}</span>
                ) : part.kind === "added" ? (
                  <ins key={i} className="rounded-sm bg-green-500/15 text-green-800 no-underline dark:text-green-300">
                    {part.text}
                  </ins>
                ) : (
                  <del key={i} className="text-red-600/70 dark:text-red-400/70">
                    {part.text}
                  </del>
                ),
              )
            : review.polished}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {using ? (
          <>
            <button type="button" onClick={() => onBack(mine)} className="btn">
              Back to mine
            </button>
            <span className="text-xs text-muted">Using the polished version. Save to keep it.</span>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onUse(review.polished)}
              disabled={outdated || value === review.polished}
              className="btn-primary disabled:opacity-50"
            >
              Use polished
            </button>
            <button type="button" onClick={onClose} className="btn">
              Keep mine
            </button>
          </>
        )}
      </div>
    </section>
  );
}
