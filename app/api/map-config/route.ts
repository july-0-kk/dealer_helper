import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ak: process.env.BAIDU_MAP_AK || "" },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
