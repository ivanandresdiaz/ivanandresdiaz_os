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
import subprocess
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
        # h264 before size: a 720p reel in VP9 does not play on the iPhone, a 480p one in h264 does.
        # When there is no h264 at all, playable() converts the file.
        "format": "bv*+ba/b",
        "format_sort": ["vcodec:h264", "res:720", "acodec:aac", "ext:mp4:m4a"],
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
    return info, playable(os.path.join(tmp, files[0]), tmp)


def probe(path: str, stream: str) -> tuple[str, str]:
    """The codec and pixel format of the file's first video or audio stream ("" when it has none)."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", f"{stream}:0",
         "-show_entries", "stream=codec_name,pix_fmt", "-of", "json", path],
        capture_output=True, text=True, check=True,
    ).stdout
    streams = json.loads(out).get("streams") or [{}]
    return streams[0].get("codec_name", ""), streams[0].get("pix_fmt", "")


def playable(path: str, tmp: str) -> str:
    """The file as h264 in yuv420p, the only video the iPhone is sure to play (VP9 and AV1 are not)."""
    codec, pix_fmt = probe(path, "v")
    if codec == "h264" and pix_fmt == "yuv420p":
        return path
    audio, _ = probe(path, "a")
    out = os.path.join(tmp, "playable.mp4")
    print(f"converting {codec}/{pix_fmt} to h264", file=sys.stderr)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", path,
         "-map", "0:v:0", "-map", "0:a:0?",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", "3M", "-bufsize", "6M", "-pix_fmt", "yuv420p",
         "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
         "-c:a", "copy" if audio == "aac" else "aac",
         "-movflags", "+faststart", out],
        check=True,
    )
    return out


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
