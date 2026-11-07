import { describe, expect, it } from "vitest";
import { createPassphrase, deriveKeys, open, passphraseProblem, seal, unlock } from "./vault";
import { buildBackupHtml, OPEN_BACKUP, type BackupData, type OpenedVault } from "./vault-backup";

// Fewer rounds than production so the tests stay fast; the scheme is the same.
const ROUNDS = 1_000;

describe("The Passphrase", () => {
  it("opens the Vaults when it is the right one, and only then", async () => {
    const { record } = await createPassphrase("my name in another life", ROUNDS);
    expect(await unlock("my name in another life", record)).not.toBeNull();
    expect(await unlock("my name in another lifE", record)).toBeNull();
  });

  it("gives the same proof every time, and a different one for another Passphrase", async () => {
    const { record, keys } = await createPassphrase("my name in another life", ROUNDS);
    const again = await unlock("my name in another life", record);
    expect(again?.proof).toBe(keys.proof);
    const other = await deriveKeys("someone else's name", record.salt, record.iterations);
    expect(other.proof).not.toBe(keys.proof);
  });

  it("asks for 12 characters, typed the same twice", () => {
    expect(passphraseProblem("short", "short")).toMatch(/12/);
    expect(passphraseProblem("long enough phrase", "long enough phrasE")).toMatch(/match/);
    expect(passphraseProblem("long enough phrase", "long enough phrase")).toBeNull();
  });
});

describe("A Secret's text", () => {
  it("comes back as it was sealed, never in the clear", async () => {
    const { keys } = await createPassphrase("my name in another life", ROUNDS);
    const text = "1. abcd-efgh\n2. ijkl-mnop ✓";
    const sealed = await seal(keys.key, text);
    expect(sealed.ciphertext).not.toContain("abcd");
    expect(await open(keys.key, sealed)).toBe(text);
  });

  it("never seals the same text the same way twice", async () => {
    const { keys } = await createPassphrase("my name in another life", ROUNDS);
    const a = await seal(keys.key, "same");
    const b = await seal(keys.key, "same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("does not open with another Passphrase's key", async () => {
    const mine = await createPassphrase("my name in another life", ROUNDS);
    const other = await createPassphrase("someone else's name", ROUNDS);
    const sealed = await seal(mine.keys.key, "recovery codes");
    await expect(open(other.keys.key, sealed)).rejects.toThrow();
  });
});

describe("The Backup", () => {
  const openBackup = new Function(`${OPEN_BACKUP}; return openBackup;`)() as (
    data: BackupData,
    passphrase: string,
  ) => Promise<OpenedVault[] | null>;

  async function backupOf(passphrase: string): Promise<BackupData> {
    const { record, keys } = await createPassphrase(passphrase, ROUNDS);
    return {
      downloadedAt: "2026-11-07",
      passphrase: record,
      vaults: [
        { name: "Infra", secrets: [{ title: "Vercel recovery codes", ...(await seal(keys.key, "aaaa-bbbb\ncccc-dddd")) }] },
        { name: "Empty", secrets: [] },
      ],
    };
  }

  it("opens offline with the Passphrase it was downloaded under", async () => {
    const data = await backupOf("my name in another life");
    expect(await openBackup(data, "my name in another life")).toEqual([
      { name: "Infra", secrets: [{ title: "Vercel recovery codes", text: "aaaa-bbbb\ncccc-dddd" }] },
      { name: "Empty", secrets: [] },
    ]);
  });

  it("stays shut with any other Passphrase", async () => {
    const data = await backupOf("my name in another life");
    expect(await openBackup(data, "a guess")).toBeNull();
  });

  it("keeps the text encrypted inside the file, and no title can break out of it", async () => {
    const data = await backupOf("my name in another life");
    data.vaults[0].secrets[0].title = "</script><script>alert(1)</script>";
    const html = buildBackupHtml(data);
    expect(html).not.toContain("aaaa-bbbb");
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });
});
