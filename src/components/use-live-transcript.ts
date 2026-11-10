"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A live draft of what someone says, from the browser's own speech recognition,
 * shown while they record. On Detener it stays as their text, to correct by hand;
 * the recording is only transcribed when there is no draft. Chrome sends this
 * audio to Google to recognize it.
 *
 * Off on phones: there the recognition and the recording fight over the
 * microphone, and the recording can come out silent. Off where the browser
 * has no recognition (Firefox).
 */

type Alternative = { transcript: string };
type Result = { isFinal: boolean; length: number; [index: number]: Alternative };
type ResultEvent = { resultIndex: number; results: { length: number; [index: number]: Result } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: ResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function onPhone() {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Errors after which listening again won't help. */
const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"]);

export function useLiveTranscript(lang: string) {
  const [text, setText] = useState("");
  const session = useRef<{ recognition: Recognition; committed: string; active: boolean } | null>(null);

  const stop = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.active = false;
    s.recognition.onend = null;
    try {
      s.recognition.stop();
    } catch {
      // Already stopped.
    }
    session.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  /** Starts listening; call it inside the tap. Does nothing where it can't run. */
  function start() {
    stop();
    setText("");
    const Recognition = recognitionClass();
    if (!Recognition || onPhone()) return;
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    const s = { recognition, committed: "", active: true };
    session.current = s;
    let heard = "";
    recognition.onresult = (event) => {
      heard = Array.from({ length: event.results.length }, (_, i) => event.results[i][0]?.transcript ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      setText([s.committed, heard].filter(Boolean).join(" "));
    };
    recognition.onerror = (event) => {
      if (FATAL.has(event.error)) s.active = false;
    };
    // Chrome ends a session after a pause; keep what it heard and listen again.
    recognition.onend = () => {
      s.committed = [s.committed, heard].filter(Boolean).join(" ");
      heard = "";
      if (!s.active || session.current !== s) return;
      try {
        recognition.start();
      } catch {
        s.active = false;
      }
    };
    try {
      recognition.start();
    } catch {
      session.current = null;
    }
  }

  /** Stops listening and forgets the draft. */
  function clear() {
    stop();
    setText("");
  }

  return { text, start, stop, clear };
}
