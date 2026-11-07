import type { PassphraseRecord, Sealed } from "./vault";

/**
 * The Backup: one HTML file with every Vault, still encrypted, that opens
 * offline in any browser with the Passphrase it was downloaded under. It is
 * read-only and never goes back into Ivan OS.
 */
export type BackupData = {
  downloadedAt: string;
  passphrase: PassphraseRecord;
  vaults: { name: string; secrets: ({ title: string } & Sealed)[] }[];
};

export type OpenedVault = { name: string; secrets: { title: string; text: string }[] };

/**
 * Plain JavaScript that runs inside the Backup file, so it can't import
 * anything: it repeats what `deriveKeys`, `open` and `unlock` in ./vault do.
 * Resolves to the Vaults with their text, or null for a wrong Passphrase.
 */
export const OPEN_BACKUP = `async function openBackup(data, passphrase) {
  const bytes = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: bytes(data.passphrase.salt), iterations: data.passphrase.iterations },
    material,
    512,
  ));
  const key = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, ["decrypt"]);
  const open = async (sealed) => new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(sealed.iv) }, key, bytes(sealed.ciphertext)),
  );
  try {
    if ((await open(data.passphrase.check)) !== "Ivan OS Vault") return null;
  } catch (error) {
    return null;
  }
  const vaults = [];
  for (const vault of data.vaults) {
    const secrets = [];
    for (const secret of vault.secrets) secrets.push({ title: secret.title, text: await open(secret) });
    vaults.push({ name: vault.name, secrets });
  }
  return vaults;
}`;

const PAGE_SCRIPT = `
const data = JSON.parse(document.getElementById("vault-data").textContent);
const form = document.getElementById("unlock");
const status = document.getElementById("status");
const out = document.getElementById("vaults");
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!window.crypto || !crypto.subtle) {
    status.textContent = "This browser can't decrypt here. Open the file in Chrome, Firefox or Safari on a computer.";
    return;
  }
  status.textContent = "Opening…";
  const vaults = await openBackup(data, form.passphrase.value);
  if (!vaults) {
    status.textContent = "That's not the Passphrase this Backup was downloaded with.";
    return;
  }
  form.remove();
  status.textContent = "";
  for (const vault of vaults) {
    const section = el("section");
    section.append(el("h2", vault.name));
    if (vault.secrets.length === 0) section.append(el("p", "No Secrets.", "muted"));
    for (const secret of vault.secrets) {
      const article = el("article");
      article.append(el("h3", secret.title), el("pre", secret.text));
      section.append(article);
    }
    out.append(section);
  }
});
`;

const STYLE = `
:root { color-scheme: light dark; --bg: #fafaf9; --fg: #1c1917; --muted: #78716c; --line: #e7e5e4; }
@media (prefers-color-scheme: dark) { :root { --bg: #0c0a09; --fg: #f5f5f4; --muted: #a8a29e; --line: #292524; } }
body { margin: 0 auto; max-width: 42rem; padding: 24px 16px; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
h1 { font-size: 1.25rem; margin: 0 0 4px; }
h2 { font-size: 1.05rem; margin: 24px 0 8px; border-bottom: 1px solid var(--line); padding-bottom: 4px; }
h3 { font-size: .95rem; margin: 12px 0 4px; }
pre { margin: 0; padding: 8px; border: 1px solid var(--line); border-radius: 6px; white-space: pre-wrap; word-break: break-word; font: 13px/1.5 ui-monospace, monospace; }
.muted { color: var(--muted); font-size: 13px; }
form { display: flex; gap: 8px; margin-top: 16px; }
input { flex: 1; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: inherit; font: inherit; }
button { padding: 6px 12px; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
`;

/** JSON that is safe inside a <script> element: nothing in it can close the tag. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function backupFileName(date: string): string {
  return `ivan-os-vaults-${date}.html`;
}

export function buildBackupHtml(data: BackupData): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vaults Backup</title>
<style>${STYLE}</style>
</head>
<body>
<h1>Ivan OS Vaults</h1>
<p class="muted">Backup downloaded ${data.downloadedAt}. It opens with the Passphrase you had that day. Read-only.</p>
<form id="unlock">
<input name="passphrase" type="password" autocomplete="off" placeholder="Passphrase" aria-label="Passphrase" required autofocus>
<button>Open</button>
</form>
<p id="status" class="muted" role="status"></p>
<div id="vaults"></div>
<script type="application/json" id="vault-data">${scriptJson(data)}</script>
<script>
${OPEN_BACKUP}
${PAGE_SCRIPT}
</script>
</body>
</html>
`;
}
