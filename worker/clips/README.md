# Clip downloader

One Cloud Run Job run downloads one Clip and leaves. Why it lives here and not
in Vercel: [docs/adr/0004](../../docs/adr/0004-clips-se-descargan-en-cloud-run.md).

- **Project** `andresdiaz`, region `us-central1`, job `clips-download`
- **Image** `us-central1-docker.pkg.dev/andresdiaz/ivan-os/clips:<tag>` (yt-dlp, ffmpeg, deno)
- **Runs as** `clips-job@andresdiaz.iam.gserviceaccount.com`, which has no roles
- **Started by** `clips-launcher@andresdiaz.iam.gserviceaccount.com`, which may only run this job
  (`roles/run.jobsExecutorWithOverrides` on the job)
- 1 task, 2 retries, 1 h per attempt, 2 GiB

Ivan OS needs, locally in `.env` and in Vercel:

```
CLIPS_JOB=projects/andresdiaz/locations/us-central1/jobs/clips-download
GCP_CLIPS_LAUNCHER_KEY=<base64 of the clips-launcher JSON key>
```

## Deploy a new version

```sh
cd worker/clips
gcloud builds submit . --tag us-central1-docker.pkg.dev/andresdiaz/ivan-os/clips:v3 --project andresdiaz --region us-central1
gcloud run jobs deploy clips-download --image us-central1-docker.pkg.dev/andresdiaz/ivan-os/clips:v3 --region us-central1 --project andresdiaz
```

Bump the yt-dlp version in the `Dockerfile` when Instagram or YouTube change and
downloads start failing; yt-dlp follows them within days.

## Run it locally

Docker here only reaches the internet on the host network:

```sh
docker build --network host -t ivan-os-clips worker/clips
docker run --rm --network host -e CLIP_URL=… -e FILE_UPLOAD_URL=… -e RESULT_UPLOAD_URL=… ivan-os-clips
```

## When Instagram wants a login

From Cloud Run, Instagram sometimes answers "login required" (often a rate limit
on Google's shared IPs). Each run retries twice; if all three fail, the Clip says
"Instagram wants a login" with a Retry button. If that keeps happening, give the
job the session of a **throwaway** Instagram account, never the main one. It can
get logged out or banned.

One time:

```sh
gcloud secrets create instagram-cookies --replication-policy automatic --project andresdiaz --data-file=cookies.txt
gcloud secrets add-iam-policy-binding instagram-cookies --project andresdiaz \
  --member serviceAccount:clips-job@andresdiaz.iam.gserviceaccount.com --role roles/secretmanager.secretAccessor
gcloud run jobs update clips-download --region us-central1 --project andresdiaz \
  --set-secrets /secrets/instagram/cookies.txt=instagram-cookies:latest \
  --set-env-vars INSTAGRAM_COOKIES=/secrets/instagram/cookies.txt
```

To get `cookies.txt` (about 2 minutes, also when the session expires):

1. Open a private window, log in to Instagram with the throwaway account.
2. Export the cookies for instagram.com in Netscape format, e.g. with yt-dlp:
   `yt-dlp --cookies-from-browser chrome --cookies cookies.txt --skip-download https://www.instagram.com/reel/<any>/`
   (or a "Get cookies.txt LOCALLY" browser extension).
3. Refresh it: `gcloud secrets versions add instagram-cookies --data-file=cookies.txt --project andresdiaz`
4. Delete `cookies.txt` from your disk. The next run picks up the new version.

## YouTube

YouTube blocks Cloud Run ("Sign in to confirm you're not a bot"), tested 2026-11-07.
So YouTube Clips stay links: `YOUTUBE_DOWNLOADS` in `src/domain/clips.ts` is off.
The worker already handles YouTube; turning it on needs a way past the block
(cookies of a throwaway Google account, or a residential proxy).
