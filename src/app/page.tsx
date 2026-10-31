import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Ivan Andrés Díaz</h1>
      <p className="max-w-md text-muted">Playing for inputs, not outputs.</p>
      <Link href="/os" className="text-sm text-muted underline-offset-4 hover:underline">
        Ivan OS →
      </Link>
    </main>
  );
}
