"use client";

import { useEffect, useState } from "react";
import { askNotificationPermission, notificationsSupported, registerServiceWorker } from "@/lib/notify";

/** Registers the service worker once the OS loads. */
export function PwaSetup() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}

/** Asks for notification permission (it needs a click, browsers block it otherwise). */
export function NotificationsToggle({ className = "btn" }: { className?: string }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);
  useEffect(() => {
    // Read after mount: Notification does not exist on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission(notificationsSupported() ? Notification.permission : "unsupported");
  }, []);

  if (permission === null || permission === "granted") return null;
  if (permission === "unsupported" || permission === "denied") {
    return (
      <span className="text-xs opacity-60" title="Enable them in the browser's site settings">
        Notifications {permission === "denied" ? "blocked" : "unavailable"} — you&apos;ll still hear a chime.
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={async () => setPermission(await askNotificationPermission())}
    >
      🔔 Enable notifications
    </button>
  );
}
