import { redirect } from "next/navigation";
import { currentUser, googleEnabled, localEnabled } from "@/lib/auth";
import { db } from "@/lib/db";
import Login from "@/components/login";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  const profiles = localEnabled()
    ? (db()
        .prepare(
          "SELECT id,name FROM profiles WHERE id IN ('clay','eames') ORDER BY rowid",
        )
        .all() as { id: string; name: string }[])
    : [];
  return <Login profiles={profiles} googleEnabled={googleEnabled()} />;
}
