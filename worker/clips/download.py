"""Downloads one Clip and leaves. See docs/adr/0004.

It holds no keys: Ivan OS hands it two one-off upload links, one for the file and
one for the result, and reads the result back from R2. Cloud Run retries a run
that exits with an error; a Clip that can never download (too long, private)
exits cleanly so it isn't retried.

Environment:
  CLIP_URL            the link Ivan pasted
  FILE_UPLOAD_URL     signed PUT for the file
  RESULT_UPLOAD_URL   signed PUT for result.json
  MAX_SECONDS         longest video it downloads (1800)
  INSTAGRAM_COOKIES   optional path to a cookies.txt for the throwaway account
"""

import json
import os
import shutil
import sys
import tempfile
import urllib.request

import yt_dlp

MAX_TITLE = 200
ATTEMPT = int(os.environ.get("CLOUD_RUN_TASK_ATTEMPT", "0"))


class Final(Exception):
    """A failure no retry will fix."""

    def __init__(self, reason: str, message: str, **extra):
        super().__init__(message)
        self.reason = reason
        self.extra = extra


class Refused(Exception):
    """The site wants a login. From a shared cloud IP that is often a rate limit, so a retry may pass."""


def put(url: str, body: bytes | None, content_type: str, path: str | None = None):
    if path is not None:
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            req = urllib.request.Request(url, data=f, method="PUT")
            req.add_header("Content-Type", content_type)
            req.add_header("Content-Length", str(size))
            with urllib.request.urlopen(req, timeout=600) as res:
                res.read()
        return
    req = urllib.request.Request(url, data=body, method="PUT")
    req.add_header("Content-Type", content_type)
    with urllib.request.urlopen(req, timeout=60) as res:
        res.read()


def report(result: dict):
    put(os.environ["RESULT_UPLOAD_URL"], json.dumps(result).encode(), "application/json")


def title_of(info: dict) -> str | None:
    """YouTube has a real title; an Instagram reel's is "Video by …", so its caption's first line wins."""
    if info.get("extractor_key", "").lower().startswith("instagram"):
        caption = (info.get("description") or "").strip().splitlines()
        if caption and caption[0].strip():
            return caption[0].strip()[:MAX_TITLE]
    title = (info.get("title") or "").strip()
    return title[:MAX_TITLE] or None


def cookies_file(tmp: str) -> str | None:
    # yt-dlp writes cookies back, and a mounted secret is read-only.
    source = os.environ.get("INSTAGRAM_COOKIES")
    if not source or not os.path.exists(source):
        return None
    with open(source, encoding="utf-8", errors="ignore") as f:
        if "instagram.com" not in f.read():
            return None  # the placeholder, before Ivan uploads real cookies
    copy = os.path.join(tmp, "cookies.txt")
    shutil.copy(source, copy)
    return copy


def download(url: str, tmp: str, max_seconds: int) -> tuple[dict, str]:
    options = {
        "outtmpl": os.path.join(tmp, "clip.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        # h264 and AAC in mp4, at most 720p: it plays on the iPhone and spares the bucket.
        "format": "bv*+ba/b",
        "format_sort": ["res:720", "vcodec:h264", "acodec:aac", "ext:mp4:m4a"],
        "merge_output_format": "mp4",
        "postprocessors": [{"key": "FFmpegVideoRemuxer", "preferedformat": "mp4"}],
    }
    cookies = cookies_file(tmp)
    if cookies:
        options["cookiefile"] = cookies

    with yt_dlp.YoutubeDL(options) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
        except yt_dlp.utils.DownloadError as e:
            print(f"yt-dlp: {e}", file=sys.stderr)
            text = str(e).lower()
            if "login" in text or "sign in" in text or "cookies" in text or "rate-limit" in text:
                # Instagram's words decide what Ivan reads once the retries run out.
                if "rate-limit" in text:
                    raise Refused("rate_limit") from e
                if "empty media response" in text:
                    raise Refused("empty") from e
                raise Refused("login") from e
            if "unavailable" in text or "not available" in text or "removed" in text or "private" in text:
                raise Final("unavailable", "The post is gone or private") from e
            raise
        duration = info.get("duration")
        if duration and duration > max_seconds:
            raise Final("too_long", "Longer than 30 minutes", durationS=round(duration), title=title_of(info))
        info = ydl.process_ie_result(info, download=True)

    files = [f for f in os.listdir(tmp) if f.startswith("clip.") and f.endswith(".mp4")]
    if not files:
        raise RuntimeError("yt-dlp finished without an mp4")
    return info, os.path.join(tmp, files[0])


def main():
    url = os.environ["CLIP_URL"]
    max_seconds = int(os.environ.get("MAX_SECONDS", "1800"))
    with tempfile.TemporaryDirectory() as tmp:
        try:
            info, path = download(url, tmp, max_seconds)
            put(os.environ["FILE_UPLOAD_URL"], None, "video/mp4", path)
        except Final as e:
            print(f"final: {e.reason}: {e}", file=sys.stderr)
            report({"ok": False, "final": True, "reason": e.reason, "message": str(e), "attempt": ATTEMPT, **e.extra})
            return 0
        except Refused as e:  # retried by Cloud Run
            report({"ok": False, "final": False, "reason": str(e), "message": str(e), "attempt": ATTEMPT})
            return 1
        except Exception as e:  # retried by Cloud Run
            print(f"failed: {e}", file=sys.stderr)
            report({"ok": False, "final": False, "reason": "error", "message": str(e)[:500], "attempt": ATTEMPT})
            return 1
        duration = info.get("duration")
        report(
            {
                "ok": True,
                "title": title_of(info),
                "durationS": round(duration) if duration else None,
                "contentType": "video/mp4",
                "sizeBytes": os.path.getsize(path),
                "attempt": ATTEMPT,
            }
        )
        print("done", file=sys.stderr)
        return 0


if __name__ == "__main__":
    sys.exit(main())
