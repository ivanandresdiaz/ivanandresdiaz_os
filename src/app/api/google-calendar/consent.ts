/** The consent in flight: its state (against forged callbacks), the Slot that asked, the way back. */
export const CONSENT_COOKIE = "ivan_os_gcal_consent";

export type PendingConsent = { state: string; slot: string | null; back: string };

/** Only a path inside the OS: never another site. */
export function safeBack(back: string | null): string {
  return back && /^\/os(\/[\w\-/.]*)?(\?[\w\-=&%.]*)?$/.test(back) && !back.startsWith("//") ? back : "/os";
}
