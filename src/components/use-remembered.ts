"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
/** Keeps a choice alive for this visit when the browser blocks storage. */
const memory = new Map<string, string>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function read(key: string): string | null {
  const held = memory.get(key);
  if (held !== undefined) return held;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  memory.set(key, value);
  try {
    if (value === "") localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
  listeners.forEach((listener) => listener());
}

/**
 * A small value this browser remembers. The server and the first render use the
 * empty value, so the page hydrates cleanly and then shows what was remembered.
 */
export function useRemembered(key: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key) ?? "",
    () => "",
  );
  const set = useCallback((next: string) => write(key, next), [key]);
  return [value, set];
}
