"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_DICTATION_SECONDS, type Selection } from "@/domain/english";

type Outcome<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Where a recording goes: Ivan's actions, or a Stakeholder's (signed in to their Discovery). */
export type DictationActions = {
  createUpload: (input: { contentType: string; size: number }) => Promise<Outcome<{ key: string; uploadUrl: string }>>;
  transcribe: (input: { key: string; contentType: string }) => Promise<Outcome<{ text: string }>>;
  discard: (input: { key: string }) => Promise<void>;
};

/** What the hook says when something fails; the action's own error passes through `error`. */
export type DictationMessages = {
  microphone: string;
  connection: string;
  error?: (code: string) => string;
};

const ENGLISH: DictationMessages = {
  microphone: "The microphone is not available.",
  connection: "The connection failed.",
};

export type DictationPhase =
  | { kind: "idle" }
  /**
   * `analyser` reads the microphone live, for a level meter (null where the
   * browser has no Web Audio); `silent` once nothing was heard for a while.
   */
  | { kind: "recording"; seconds: number; silent: boolean; analyser: AnalyserNode | null }
  | { kind: "working"; step: "Uploading" | "Transcribing" }
  | { kind: "failed"; error: string; canRetry: boolean };

export type Dictation = ReturnType<typeof useDictation>;

/** The recording that failed to become text, kept so it can be retried. */
type Pending = { blob: Blob; contentType: string; key: string | null; at: Selection | null };

const RECORDING_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];

/** How long without sound before the recording says it hears nothing. */
const SILENT_AFTER_MS = 3000;
/** Loudness (RMS of the waveform, 0..1) that counts as someone speaking. */
const SPEAKING_LEVEL = 0.015;

/** How loud the microphone is right now, 0..1. */
export function micLevel(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (const sample of buffer) sum += sample * sample;
  return Math.sqrt(sum / buffer.length);
}

/** Records the microphone, uploads the audio and turns it into text where the cursor was. */
export function useDictation(
  actions: DictationActions,
  onText: (spoken: string, at: Selection | null) => void,
  messages: DictationMessages = ENGLISH,
) {
  const [phase, setPhase] = useState<DictationPhase>({ kind: "idle" });
  const session = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    chunks: Blob[];
    at: Selection | null;
    timer: number;
    cancelled: boolean;
    audio: AudioContext | null;
  } | null>(null);
  const pending = useRef<Pending | null>(null);

  function release() {
    const s = session.current;
    if (!s) return;
    window.clearInterval(s.timer);
    s.stream.getTracks().forEach((track) => track.stop());
    void s.audio?.close().catch(() => {});
    session.current = null;
  }

  // Leaving the page mid-recording turns the microphone off.
  useEffect(() => () => release(), []);

  async function start(at: Selection | null) {
    // Made inside the tap, before any await, or iOS keeps it suspended.
    let audio: AudioContext | null = null;
    try {
      audio = new AudioContext();
    } catch {
      audio = null;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      void audio?.close().catch(() => {});
      setPhase({ kind: "failed", error: messages.microphone, canRetry: false });
      return;
    }
    let analyser: AnalyserNode | null = null;
    if (audio) {
      try {
        void audio.resume().catch(() => {});
        analyser = audio.createAnalyser();
        analyser.fftSize = 1024;
        audio.createMediaStreamSource(stream).connect(analyser);
      } catch {
        analyser = null;
      }
    }
    const buffer = new Float32Array(analyser?.fftSize ?? 0);
    const mimeType = RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 });
    const startedAt = Date.now();
    let heardAt = startedAt;
    const s = {
      recorder,
      stream,
      chunks: [] as Blob[],
      at,
      cancelled: false,
      audio,
      timer: window.setInterval(() => {
        const now = Date.now();
        const seconds = Math.floor((now - startedAt) / 1000);
        if (analyser && micLevel(analyser, buffer) > SPEAKING_LEVEL) heardAt = now;
        const silent = analyser !== null && now - heardAt > SILENT_AFTER_MS;
        if (seconds >= MAX_DICTATION_SECONDS) recorder.stop();
        else setPhase({ kind: "recording", seconds, silent, analyser });
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
    setPhase({ kind: "recording", seconds: 0, silent: false, analyser });
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
        const upload = await actions.createUpload({ contentType: p.contentType, size: p.blob.size });
        if (!upload.ok) {
          pending.current = null;
          setPhase({ kind: "failed", error: messages.error?.(upload.error) ?? upload.error, canRetry: false });
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
      const result = await actions.transcribe({ key: p.key, contentType: p.contentType });
      if (!result.ok) {
        setPhase({ kind: "failed", error: messages.error?.(result.error) ?? result.error, canRetry: true });
        return;
      }
      pending.current = null;
      setPhase({ kind: "idle" });
      onText(result.text, p.at);
    } catch {
      setPhase({ kind: "failed", error: messages.connection, canRetry: true });
    }
  }

  function discard() {
    const key = pending.current?.key;
    pending.current = null;
    setPhase({ kind: "idle" });
    if (key) void actions.discard({ key });
  }

  return { phase, start, stop, cancel, retry: () => void send(), discard };
}
