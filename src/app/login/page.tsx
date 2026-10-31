import { signIn } from "@/auth";
import { devLoginEnabled } from "@/auth";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  async function google() {
    "use server";
    await signIn("google", { redirectTo: "/os" });
  }

  async function dev() {
    "use server";
    await signIn("dev", { redirectTo: "/os" });
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="card flex w-full max-w-xs flex-col gap-3 text-center">
        <h1 className="text-lg font-semibold">Ivan OS</h1>
        <p className="text-sm text-muted">Single-user. Only Ivan&apos;s account can enter.</p>
        <form action={google}>
          <button className="btn-primary w-full">Continue with Google</button>
        </form>
        {devLoginEnabled && (
          <form action={dev}>
            <button className="btn w-full">Dev sign-in (local only)</button>
          </form>
        )}
      </div>
    </main>
  );
}
