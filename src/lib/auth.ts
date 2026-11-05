import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { db } from "./db";

export const localEnabled = () =>
  process.env.LOCAL_DEMO_AUTH === "true" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.LOCAL_DEMO_AUTH !== "false");
export const googleEnabled = () =>
  !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
function secret() {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
  const dir = dirname(process.env.DATABASE_PATH || "./data/adastra.sqlite");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, ".session-secret");
  if (!existsSync(path)) {
    try {
      writeFileSync(path, randomBytes(48).toString("hex"), {
        mode: 0o600,
        flag: "wx",
      });
    } catch (error) {
      if (!existsSync(path)) throw error;
    }
  }
  return readFileSync(path, "utf8");
}
export function authOptions(): NextAuthOptions {
  return {
    secret: secret(),
    session: { strategy: "jwt" },
    pages: { signIn: "/login", error: "/login" },
    providers: [
      ...(localEnabled()
        ? [
            CredentialsProvider({
              name: "Local profile",
              credentials: { profile: { label: "Profile", type: "text" } },
              async authorize(credentials) {
                if (
                  !localEnabled() ||
                  !["clay", "eames"].includes(credentials?.profile || "")
                )
                  return null;
                return (
                  (db()
                    .prepare("SELECT id,name,email FROM profiles WHERE id=?")
                    .get(credentials!.profile) as {
                    id: string;
                    name: string;
                    email: string;
                  }) || null
                );
              },
            }),
          ]
        : []),
      ...(googleEnabled()
        ? [
            GoogleProvider({
              clientId: process.env.GOOGLE_CLIENT_ID!,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            }),
          ]
        : []),
    ],
    callbacks: {
      async signIn({ account, profile }) {
        return (
          account?.provider !== "google" ||
          (profile as { email_verified?: boolean })?.email_verified === true
        );
      },
      async jwt({ token, user, account }) {
        if (account?.provider === "google" && user) {
          const d = db();
          let existing = d
            .prepare("SELECT id FROM profiles WHERE google_sub=?")
            .get(account.providerAccountId) as { id: string } | undefined;
          if (!existing) {
            // Never attach Google identities to local demo users by matching their email.
            const id = randomUUID();
            d.prepare(
              "INSERT INTO profiles(id,name,email,google_sub) VALUES(?,?,?,?)",
            ).run(
              id,
              user.name || "Member",
              user.email,
              account.providerAccountId,
            );
            existing = { id };
          }
          token.userId = existing.id;
        } else if (user) token.userId = user.id;
        return token;
      },
      async session({ session, token }) {
        if (session.user)
          (session.user as { id?: string }).id = token.userId as string;
        return session;
      },
    },
  };
}
export async function currentUser() {
  const session = await getServerSession(authOptions());
  return (session?.user as { id?: string } | undefined)?.id;
}
