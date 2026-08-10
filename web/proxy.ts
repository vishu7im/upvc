import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const destination = request.nextUrl.clone();

  if (destination.pathname === "/") {
    destination.pathname = "/version-chooser";
    return NextResponse.rewrite(destination);
  }

  if (destination.pathname.startsWith("/v1/")) {
    destination.pathname = destination.pathname.slice(3);
    return NextResponse.rewrite(destination);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/v1/:path*"],
};
