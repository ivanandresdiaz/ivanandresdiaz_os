import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

/** Local-only sign-in without Google. Never available in production. */
export const devLoginEnabled =
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "1";

const DEV_EMAIL = "dev@localhost";

/** Ivan OS has exactly one user: the Google account in ALLOWED_EMAIL. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  if (devLoginEnabled && email === DEV_EMAIL) return true;
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  return !!allowed && email.toLowerCase() === allowed;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Dev",
            credentials: {},
            authorize: () => ({ id: "ivan", name: "Ivan (dev)", email: DEV_EMAIL }),
          }),
        ]
      : []),
  ],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ account, profile, user }) {
      if (account?.provider === "dev") return devLoginEnabled;
      if (account?.provider !== "google") return false;
      return profile?.email_verified === true && isAllowedEmail(user.email);
    },
  },
});
