"""Trims one Sample's or Reference's file and leaves. Started as TASK=trim.

Like a download, it holds no keys: Ivan OS hands it a signed link to read the
file and two to upload the cut one and the result. It re-encodes, so the cut
lands where Ivan set it (copying streams would cut at keyframes), and a video
comes out as h264, which the iPhone plays.

Environment:
  SOURCE_URL          signed GET for the file to cut
  FILE_UPLOAD_URL     signed PUT for the cut file
  RESULT_UPLOAD_URL   signed PUT for result.json
  TRIM_KIND           video or audio
  TRIM_START          seconds to start from (empty: the beginning)
  TRIM_END            seconds to end at (empty: the end)
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request

from download import ATTEMPT, put, report

KEEP_AT_LEAST = 0.5


class Final(Exception):
    """A failure no retry will fix."""

    def __init__(self, reason: str, message: str):
        super().__init__(message)
        self.reason = reason


def seconds(name: str) -> float | None:
    value = os.environ.get(name, "").strip()
    return float(value) if value else None


def fetch(url: str, path: str):
    with urllib.request.urlopen(url, timeout=600) as res, open(path, "wb") as f:
        shutil.copyfileobj(res, f)


def duration_of(path: str) -> float | None:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
        capture_output=True, text=True,
    )
    try:
        return float(json.loads(out.stdout)["format"]["duration"])
    except (KeyError, ValueError, json.JSONDecodeError):
        return None


def cut(source: str, tmp: str, kind: str, start: float | None, end: float | None) -> tuple[str, str]:
    """The kept part, re-encoded: an mp4 for a video, an m4a for an audio."""
    span = ["-ss", f"{start:.3f}"] if start else []
    length = ["-t", f"{end - (start or 0):.3f}"] if end is not None else []
    if kind == "video":
        out, content_type = os.path.join(tmp, "trimmed.mp4"), "video/mp4"
        encode = ["-map", "0:v:0", "-map", "0:a:0?",
                  "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", "3M", "-bufsize", "6M",
                  "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                  "-c:a", "aac", "-b:a", "128k"]
    else:
        out, content_type = os.path.join(tmp, "trimmed.m4a"), "audio/mp4"
        encode = ["-map", "0:a:0", "-vn", "-c:a", "aac", "-b:a", "128k"]
    result = subprocess.run(
        ["ffmpeg", "-v", "error", "-y", *span, "-i", source, *length, *encode, "-movflags", "+faststart", out],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(result.stderr[-2000:], file=sys.stderr)
        raise Final("unreadable", "ffmpeg could not cut the file")
    return out, content_type


def main():
    kind = os.environ.get("TRIM_KIND", "video")
    start, end = seconds("TRIM_START"), seconds("TRIM_END")
    with tempfile.TemporaryDirectory() as tmp:
        try:
            source = os.path.join(tmp, "source")
            fetch(os.environ["SOURCE_URL"], source)
            path, content_type = cut(source, tmp, kind, start, end)
            duration = duration_of(path)
            if duration is None or duration < KEEP_AT_LEAST:
                raise Final("nothing_left", "Nothing was left after the cut")
            put(os.environ["FILE_UPLOAD_URL"], None, content_type, path)
        except Final as e:
            print(f"final: {e.reason}: {e}", file=sys.stderr)
            report({"ok": False, "final": True, "reason": e.reason, "message": str(e), "attempt": ATTEMPT})
            return 0
        except Exception as e:  # retried by Cloud Run
            print(f"failed: {e}", file=sys.stderr)
            report({"ok": False, "final": False, "reason": "error", "message": str(e)[:500], "attempt": ATTEMPT})
            return 1
        report(
            {
                "ok": True,
                "contentType": content_type,
                "sizeBytes": os.path.getsize(path),
                "durationS": round(duration, 1) if duration is not None else None,
                "attempt": ATTEMPT,
            }
        )
        print("trimmed", file=sys.stderr)
        return 0
