"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { insertDictation, type Selection } from "@/domain/english";
import {
  createStakeholderDictationUpload,
  discardStakeholderDictation,
  transcribeStakeholderDictation,
} from "@/server/stakeholder-actions";
import { aiTools } from "../ai-tools";
import { micLevel, useDictation } from "../use-dictation";
import { useLiveTranscript } from "../use-live-transcript";
import type { Copy } from "./copy";

/**
 * A Stakeholder's text box with the microphone (Q23): what they say lands where
 * the cursor was, in the Discovery's language, and they fix it before sending.
 */
export function VoiceField({
  slug,
  copy,
  value,
  onChange,
  placeholder,
  rows = 3,
  autoFocus,
  label,
}: {
  slug: string;
  copy: Copy;
  value: string;
  /**
   * `fromVoice` when the new text came from the microphone. One call carries
   * both, so a parent that merges into stale state can't overwrite the words.
   */
  onChange: (value: string, fromVoice?: boolean) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  label: string;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  /** The text just came from the microphone: say so for a few seconds. */
  const [heard, setHeard] = useState(false);
  /** A live draft of what they say, shown in the box; on Detener it stays there to correct. */
  const live = useLiveTranscript(copy.speechLang);
  /** Where the cursor was when they tapped the microphone. */
  const [spokenAt, setSpokenAt] = useState<Selection | null>(null);
  useEffect(() => {
    if (!heard) return;
    const timer = window.setTimeout(() => setHeard(false), 5000);
    return () => window.clearTimeout(timer);
  }, [heard]);

  // Their own text, always the latest: the box itself shows the draft while recording,
  // and the transcription arrives in a callback made renders ago.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  /** Puts what they said in the box, ready to correct: focused, with the cursor after it. */
  function land(spoken: string, at: Selection | null) {
    const { text, caret } = insertDictation(latest.current, spoken, at);
    onChange(text, true);
    live.clear();
    setHeard(true);
    requestAnimationFrame(() => {
      const el = field.current;
      if (!el) return;
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  /**
   * Detener: the live draft they just watched stays as it is, to correct by hand.
   * Without a draft (phones, Firefox) the recording is transcribed instead.
   */
  function finish() {
    if (live.text) {
      const spoken = live.text;
      dictation.cancel();
      land(spoken, spokenAt);
    } else {
      dictation.stop();
    }
  }

  const actions = useMemo(
    () => ({
      createUpload: (input: { contentType: string; size: number }) => createStakeholderDictationUpload({ slug, ...input }),
      transcribe: (input: { key: string; contentType: string }) => transcribeStakeholderDictation({ slug, ...input }),
      discard: (input: { key: string }) => discardStakeholderDictation({ slug, ...input }),
    }),
    [slug],
  );
  const dictation = useDictation(
    actions,
    (spoken, at) => land(spoken, at),
    {
      microphone: copy.voiceErrors.microphone,
      connection: copy.voiceErrors.connection,
      error: (code) => copy.voiceErrors[code] ?? code,
    },
  );
  const { phase } = dictation;
  const recording = phase.kind === "recording";
  const working = phase.kind === "working";

  // The recording also stops by itself at its time limit.
  const stopLive = live.stop;
  useEffect(() => {
    if (phase.kind !== "recording") stopLive();
  }, [phase.kind, stopLive]);

  const preview = (recording || working) && live.text ? insertDictation(value, live.text, spokenAt).text : null;

  function applyDraft() {
    const spoken = live.text;
    dictation.discard();
    land(spoken, spokenAt);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <textarea
          ref={field}
          value={preview ?? value}
          readOnly={preview !== null}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? copy.typeOrSpeak}
          rows={rows}
          autoFocus={autoFocus}
          aria-label={label}
          className={`field-sizing-content min-h-24 w-full rounded-2xl border bg-surface px-4 py-3 pr-14 text-base leading-relaxed outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10 ${
            recording
              ? "border-red-400 ring-4 ring-red-500/10"
              : working
                ? "border-accent ring-4 ring-accent/10"
                : heard
                  ? "border-emerald-500 ring-4 ring-emerald-500/15"
                  : "border-line"
          }`}
        />
        {aiTools.dictation && phase.kind === "idle" && (
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              const el = field.current;
              const focused = el && document.activeElement === el;
              const at = focused ? { start: el.selectionStart, end: el.selectionEnd } : null;
              setSpokenAt(at);
              setHeard(false);
              live.start();
              dictation.start(at);
            }}
            aria-label={copy.dictate}
            title={copy.dictate}
            className="absolute right-2 bottom-2 flex size-11 items-center justify-center rounded-full bg-accent text-white shadow-sm transition active:scale-95"
          >
            <MicIcon />
          </button>
        )}
        {working && (
          <span className="absolute right-2 bottom-2 flex size-11 items-center justify-center gap-1 rounded-full bg-accent/10" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="thinking-dot size-1.5 rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
        )}
      </div>

      {phase.kind === "recording" && (
        <div className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50/60 p-3" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <LevelMeter analyser={phase.analyser} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-2 text-sm font-medium text-red-700">
                <span className="size-2 animate-pulse rounded-full bg-red-600" aria-hidden />
                {copy.listening}
                <span className="tabular-nums font-normal text-red-700/70">
                  {Math.floor(phase.seconds / 60)}:{String(phase.seconds % 60).padStart(2, "0")}
                </span>
              </span>
              <span className={`text-xs ${phase.silent ? "font-medium text-amber-700" : "text-muted"}`}>
                {phase.silent ? copy.silent : live.text ? copy.liveHint : copy.listeningHint}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={finish}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-red-600 px-4 text-sm font-medium text-white active:scale-[0.98]"
            >
              <span className="size-3 rounded-[3px] bg-white" aria-hidden />
              {copy.stop}
            </button>
            <button
              type="button"
              onClick={() => {
                live.clear();
                dictation.cancel();
              }}
              aria-label={copy.discard}
              title={copy.discard}
              className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {working && (
        <p className="flex flex-col text-sm" role="status" aria-live="polite">
          <span className="font-medium text-accent">{phase.step === "Uploading" ? copy.uploading : copy.transcribing}…</span>
          <span className="text-xs text-muted">{copy.transcribingHint}</span>
        </p>
      )}
      {heard && phase.kind === "idle" && (
        <p className="card-in text-sm text-emerald-700" role="status" aria-live="polite">
          ✓ {copy.heard}
        </p>
      )}
      {phase.kind === "failed" && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-red-700">{phase.error}</span>
          {phase.canRetry && (
            <button type="button" onClick={dictation.retry} className="rounded-full border border-line px-3 py-1">
              {copy.retry}
            </button>
          )}
          {live.text && (
            <button type="button" onClick={applyDraft} className="rounded-full border border-line px-3 py-1">
              {copy.useDraft}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              live.clear();
              dictation.discard();
            }}
            className="rounded-full border border-line px-3 py-1"
          >
            {copy.discard}
          </button>
        </p>
      )}
    </div>
  );
}

const BARS = 5;
/** How much each bar answers to the voice: the middle one most. */
const BAR_GAIN = [0.55, 0.8, 1, 0.8, 0.55];

/** Bars that move with the voice, drawn straight to the DOM so React doesn't re-render 60 times a second. */
function LevelMeter({ analyser }: { analyser: AnalyserNode | null }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!analyser) return;
    const buffer = new Float32Array(analyser.fftSize);
    let smooth = 0;
    let frame = requestAnimationFrame(function draw() {
      // Speech sits around 0.02–0.2 RMS; stretch it so a normal voice fills the bars.
      const level = Math.min(1, micLevel(analyser, buffer) * 6);
      smooth = level > smooth ? level : smooth * 0.85 + level * 0.15;
      const t = performance.now() / 180;
      bars.current.forEach((bar, i) => {
        if (!bar) return;
        const wobble = 0.85 + 0.15 * Math.sin(t + i * 1.3);
        bar.style.transform = `scaleY(${Math.max(0.15, smooth * BAR_GAIN[i] * wobble)})`;
      });
      frame = requestAnimationFrame(draw);
    });
    return () => cancelAnimationFrame(frame);
  }, [analyser]);

  if (!analyser) {
    return <span className="size-3 shrink-0 animate-pulse rounded-full bg-red-600" aria-hidden />;
  }
  return (
    <span className="flex h-9 w-11 shrink-0 items-center justify-center gap-[3px]" aria-hidden>
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          className="h-full w-1.5 origin-center rounded-full bg-red-500 transition-transform duration-75"
          style={{ transform: "scaleY(0.15)" }}
        />
      ))}
    </span>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}
