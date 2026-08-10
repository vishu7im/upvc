import { NextResponse, type NextRequest } from "next/server";
import {
  isVersionReturnTarget,
  UI_VERSION_COOKIE,
  type UiVersion,
} from "@/lib/v2/routes";

export function GET(
  request: NextRequest,
  context: { params: Promise<{ version: string }> },
) {
  return context.params.then(({ version: rawVersion }) => {
    const version: UiVersion | null = rawVersion === "v1" || rawVersion === "v2" ? rawVersion : null;
    const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "";

    if (!version || !isVersionReturnTarget(version, returnTo)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const response = NextResponse.redirect(new URL(returnTo, request.url));
    response.cookies.set(UI_VERSION_COOKIE, version, {
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  });
}
