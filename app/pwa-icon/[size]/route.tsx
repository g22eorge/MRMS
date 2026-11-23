import { ImageResponse } from "next/og";

// Home-screen icons for the web app manifest, drawn to match app/icon.svg.
const SIZES = new Set([192, 512]);

export async function GET(_request: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const size = Number(raw);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#C9A227", fontWeight: 900, fontSize: size * 0.3, letterSpacing: size * 0.016 }}>EIS</span>
      </div>
    ),
    { width: size, height: size, headers: { "cache-control": "public, max-age=604800, immutable" } },
  );
}
