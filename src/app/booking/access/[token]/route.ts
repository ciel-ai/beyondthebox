import { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessCookieOptions, grantValue, redeemAccessToken } from "@/server/access";
import { env } from "@/server/env";

/** Emailed links land here: redeem the token, set the access cookie, redirect to a clean URL. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = env().APP_URL;
  const reference = await redeemAccessToken(token);
  if (!reference) return NextResponse.redirect(new URL("/booking/find?link=expired", base), 303);
  const res = NextResponse.redirect(new URL(`/booking/${reference}`, base), 303);
  const existing = req.headers.get("cookie")?.match(new RegExp(`${ACCESS_COOKIE}=([^;]+)`))?.[1];
  res.cookies.set(ACCESS_COOKIE, grantValue(existing ? decodeURIComponent(existing) : undefined, reference), accessCookieOptions);
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
