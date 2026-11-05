import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { currentUser, googleEnabled, localEnabled } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, mutate, snapshot } from "@/lib/service";
export const dynamic = "force-dynamic";
function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  console.error("Workspace request failed", error);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) throw new AppError("Please sign in.", 401);
    return NextResponse.json(
      {
        ...snapshot(user, request.nextUrl.searchParams.get("org") || undefined),
        googleEnabled: googleEnabled(),
        profiles: localEnabled()
          ? db()
              .prepare(
                "SELECT id,name FROM profiles WHERE id IN ('clay','eames')",
              )
              .all()
          : [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) throw new AppError("Please sign in.", 401);
    const origin = request.headers.get("origin");
    const expected = new URL(process.env.NEXTAUTH_URL || request.url).origin;
    if (origin !== expected)
      throw new AppError("This request must come from the application.", 403);
    if (Number(request.headers.get("content-length") || 0) > 16384)
      throw new AppError("Request is too large.", 413);
    const raw = await request.text();
    if (raw.length > 16384) throw new AppError("Request is too large.", 413);
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      throw new AppError("Invalid request.");
    }
    return NextResponse.json(mutate(user, input));
  } catch (error) {
    return errorResponse(error);
  }
}
