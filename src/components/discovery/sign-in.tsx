"use client";

import { useState, useTransition } from "react";
import { requestCode, verifyCode } from "@/server/stakeholder-actions";
import type { Language } from "@/domain/discovery";
import { copyFor } from "./copy";

/** Email, then the 6-digit code from the email (Q11). */
export function SignIn({ slug, language }: { slug: string; language: Language }) {
  const copy = copyFor(language);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      setError(null);
      const result = await requestCode({ slug, email });
      if (!result.ok) return setError(copy.signInErrors[result.error] ?? result.error);
      setCode("");
      setStep("code");
    });

  const enter = (value: string) =>
    start(async () => {
      setError(null);
      // On success the action sends the person to the Discovery's home.
      const result = await verifyCode({ slug, email, code: value });
      if (result && !result.ok) setError(copy.signInErrors[result.error] ?? result.error);
    });

  return (
    <section className="card-in flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{copy.signInTitle}</h2>
        <p id="code-hint" className="text-sm text-muted">
          {step === "email" ? copy.signInHint : copy.codeSent(email)}
        </p>
      </div>

      {step === "email" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {copy.emailLabel}
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              placeholder={copy.emailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-12 rounded-2xl border border-line bg-background px-4 text-base font-normal outline-none placeholder:text-muted/50 focus:border-accent focus:ring-4 focus:ring-accent/10"
            />
          </label>
          <button
            type="submit"
            disabled={pending || !email.trim()}
            className="min-h-12 rounded-full bg-accent px-6 text-base font-medium text-white shadow-sm disabled:opacity-50"
          >
            {pending ? copy.sending : copy.sendCode}
          </button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            enter(code);
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {copy.codeLabel}
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              autoFocus
              placeholder={copy.codePlaceholder}
              aria-describedby="code-hint"
              value={code}
              onChange={(event) => {
                const value = event.target.value.replace(/[^\d]/g, "").slice(0, 6);
                setCode(value);
                if (value.length === 6 && !pending) enter(value);
              }}
              className="min-h-14 rounded-2xl border border-line bg-background px-4 text-center font-mono text-2xl tracking-[0.5em] outline-none placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/10"
            />
          </label>
          <button
            type="submit"
            disabled={pending || code.length !== 6}
            className="min-h-12 rounded-full bg-accent px-6 text-base font-medium text-white shadow-sm disabled:opacity-50"
          >
            {pending ? copy.entering : copy.enter}
          </button>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              className="min-h-11 text-muted underline underline-offset-4"
            >
              {copy.otherEmail}
            </button>
            <button type="button" disabled={pending} onClick={send} className="min-h-11 text-accent underline underline-offset-4">
              {copy.resend}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
