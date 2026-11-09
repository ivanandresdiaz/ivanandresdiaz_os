"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireIvan } from "@/lib/session";
import { beginTrim, dismissTrim as dismiss, retryTrim as retry, type TrimAnswer } from "./trims";

const mark = z
  .number()
  .finite()
  .min(0)
  .max(24 * 60 * 60)
  .nullable();
const asked = z.object({ id: z.uuid(), startS: mark, endS: mark });

/** Cuts a Sample's video down to what Ivan keeps; it runs on its own, in the cloud. */
export async function trimSample(input: {
  id: string;
  startS: number | null;
  endS: number | null;
}): Promise<TrimAnswer> {
  await requireIvan();
  const v = asked.parse(input);
  const answer = await beginTrim({ sampleId: v.id }, v);
  refresh();
  return answer;
}

/** Cuts a Reference's video or audio down to what Ivan keeps. */
export async function trimReference(input: {
  id: string;
  startS: number | null;
  endS: number | null;
}): Promise<TrimAnswer> {
  await requireIvan();
  const v = asked.parse(input);
  const answer = await beginTrim({ referenceId: v.id }, v);
  refresh();
  return answer;
}

export async function retryTrim(input: { id: string }) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(input);
  await retry(id);
  refresh();
}

export async function dismissTrim(input: { id: string }) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(input);
  await dismiss(id);
  refresh();
}
