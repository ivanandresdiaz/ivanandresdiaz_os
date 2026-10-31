/**
 * Local notifications (no push server): shown by the page through the
 * service worker, so they also work in the installed PWA on Android.
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (error) {
    console.error("Service worker registration failed", error);
    return null;
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function askNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  return Notification.requestPermission();
}

export async function notify(title: string, body: string, url = "/os/focus") {
  chime();
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker?.getRegistration();
  const options: NotificationOptions = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-64.png",
    tag: "ivan-os-cycle",
    data: { url },
  };
  if (registration) await registration.showNotification(title, options);
  else new Notification(title, options);
}

/** A soft two-note chime, so the end of a phase is heard even without notifications. */
export function chime() {
  try {
    const ctx = new AudioContext();
    [523.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const start = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.3);
    });
    setTimeout(() => void ctx.close(), 2500);
  } catch {
    // Audio may be blocked until the first user gesture; the notification still shows.
  }
}
