# The Clip downloader: one run downloads one Clip and leaves, see docs/adr/0004.
FROM denoland/deno:bin-2.5.6 AS deno
FROM mwader/static-ffmpeg:7.1 AS ffmpeg

FROM python:3.13-slim
COPY --from=deno /deno /usr/local/bin/deno
COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
RUN pip install --no-cache-dir "yt-dlp[default]==2026.10.21"
WORKDIR /app
COPY download.py .
USER nobody
ENTRYPOINT ["python", "-u", "download.py"]
