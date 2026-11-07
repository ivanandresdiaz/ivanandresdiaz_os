"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { MAX_SECRET_TITLE, MAX_VAULT_NAME, VAULT_ITERATIONS } from "@/domain/vault";
import { requireIvan } from "@/lib/session";

// The server never sees the Passphrase nor a Secret's text: the browser sends
// them sealed. What it does see is the proof, derived from the Passphrase, so a
// session alone (someone at Ivan's open laptop) can't change or delete what it
// can't read. See docs/adr/0003.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const base64 = (max: number) =>
  z
    .string()
    .max(max)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Not base64");
const proof = base64(64);
const sealed = z.object({ iv: base64(24), ciphertext: base64(120_000) });
const record = z.object({
  salt: base64(64),
  iterations: z.number().int().min(VAULT_ITERATIONS).max(10_000_000),
  check: sealed,
});
const vaultName = z.string().trim().min(1).max(MAX_VAULT_NAME);
const secretTitle = z.string().trim().min(1).max(MAX_SECRET_TITLE);

function hashProof(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Throws unless the proof comes from the current Passphrase, i.e. the Vaults are open. */
async function requireOpen(tx: Tx | typeof db, value: string) {
  const [row] = await tx.select({ proofHash: s.vaultPassphrase.proofHash }).from(s.vaultPassphrase).limit(1);
  const expected = row && Buffer.from(row.proofHash, "hex");
  if (!expected || !timingSafeEqual(expected, hashProof(value))) {
    throw new Error("The Vaults are locked. Unlock them and try again.");
  }
}

async function done() {
  refresh();
}

/** The first time: the Passphrase is born. It can't be set up twice; it changes with changePassphrase. */
export async function setUpPassphrase(input: { record: unknown; proof: string }) {
  await requireIvan();
  const v = z.object({ record, proof }).parse(input);
  const created = await db
    .insert(s.vaultPassphrase)
    .values({
      salt: v.record.salt,
      iterations: v.record.iterations,
      checkIv: v.record.check.iv,
      checkCiphertext: v.record.check.ciphertext,
      proofHash: hashProof(v.proof).toString("hex"),
    })
    .onConflictDoNothing()
    .returning({ id: s.vaultPassphrase.id });
  if (created.length === 0) throw new Error("The Passphrase already exists.");
  await done();
}

/**
 * A new Passphrase. The browser opened every Secret with the old one and sealed
 * it again with the new one; all of them must come, or none changes.
 */
export async function changePassphrase(input: {
  proof: string;
  record: unknown;
  newProof: string;
  secrets: { id: string; iv: string; ciphertext: string }[];
}) {
  await requireIvan();
  const v = z
    .object({
      proof,
      record,
      newProof: proof,
      secrets: z.array(sealed.extend({ id: z.uuid() })),
    })
    .parse(input);
  await db.transaction(async (tx) => {
    await tx.select().from(s.vaultPassphrase).for("update");
    await requireOpen(tx, v.proof);
    const current = await tx.select({ id: s.vaultSecrets.id }).from(s.vaultSecrets).for("update");
    const sent = new Set(v.secrets.map((secret) => secret.id));
    if (sent.size !== current.length || current.some((secret) => !sent.has(secret.id))) {
      throw new Error("The Secrets changed meanwhile. Reload and try again.");
    }
    for (const secret of v.secrets) {
      await tx
        .update(s.vaultSecrets)
        .set({ iv: secret.iv, ciphertext: secret.ciphertext })
        .where(eq(s.vaultSecrets.id, secret.id));
    }
    await tx
      .update(s.vaultPassphrase)
      .set({
        salt: v.record.salt,
        iterations: v.record.iterations,
        checkIv: v.record.check.iv,
        checkCiphertext: v.record.check.ciphertext,
        proofHash: hashProof(v.newProof).toString("hex"),
        changedAt: new Date(),
      })
      .where(eq(s.vaultPassphrase.id, 1));
  });
  await done();
}

export async function createVault(input: { proof: string; name: string }) {
  await requireIvan();
  const v = z.object({ proof, name: vaultName }).parse(input);
  await requireOpen(db, v.proof);
  await db.insert(s.vaults).values({ name: v.name });
  await done();
}

export async function renameVault(input: { proof: string; id: string; name: string }) {
  await requireIvan();
  const v = z.object({ proof, id: z.uuid(), name: vaultName }).parse(input);
  await requireOpen(db, v.proof);
  await db.update(s.vaults).set({ name: v.name }).where(eq(s.vaults.id, v.id));
  await done();
}

/** Its Secrets go with it. */
export async function deleteVault(fd: FormData) {
  await requireIvan();
  const v = z.object({ proof, id: z.uuid() }).parse({ proof: fd.get("proof"), id: fd.get("id") });
  await requireOpen(db, v.proof);
  await db.delete(s.vaults).where(eq(s.vaults.id, v.id));
  await done();
}

export async function createSecret(input: {
  proof: string;
  vaultId: string;
  title: string;
  iv: string;
  ciphertext: string;
}) {
  await requireIvan();
  const v = z.object({ proof, vaultId: z.uuid(), title: secretTitle }).extend(sealed.shape).parse(input);
  await requireOpen(db, v.proof);
  await db.insert(s.vaultSecrets).values({ vaultId: v.vaultId, title: v.title, iv: v.iv, ciphertext: v.ciphertext });
  await done();
}

/** Edits it, moving it to another Vault when `vaultId` changes. */
export async function updateSecret(input: {
  proof: string;
  id: string;
  vaultId: string;
  title: string;
  iv: string;
  ciphertext: string;
}) {
  await requireIvan();
  const v = z.object({ proof, id: z.uuid(), vaultId: z.uuid(), title: secretTitle }).extend(sealed.shape).parse(input);
  await requireOpen(db, v.proof);
  await db
    .update(s.vaultSecrets)
    .set({ vaultId: v.vaultId, title: v.title, iv: v.iv, ciphertext: v.ciphertext, updatedAt: new Date() })
    .where(eq(s.vaultSecrets.id, v.id));
  await done();
}

export async function deleteSecret(fd: FormData) {
  await requireIvan();
  const v = z.object({ proof, id: z.uuid() }).parse({ proof: fd.get("proof"), id: fd.get("id") });
  await requireOpen(db, v.proof);
  await db.delete(s.vaultSecrets).where(eq(s.vaultSecrets.id, v.id));
  await done();
}
