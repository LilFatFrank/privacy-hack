import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Claim";
export const size = {
  width: 505,
  height: 505,
};
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch Jost font
  const fontData = await fetch(
    "https://fonts.googleapis.com/css2?family=Jost:wght@300;400&display=swap",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  ).then((res) => res.text());

  const fontUrl = fontData.match(
    /src: url\(([^)]+)\) format\('truetype'\)/
  )?.[1];

  const font = fontUrl
    ? await fetch(fontUrl).then((res) => res.arrayBuffer())
    : null;

  let amount = 0;
  let message = "";

  try {
    // Query Supabase directly — avoids circular self-fetch that fails on serverless/Telegram
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/activity?id=eq.${id}&select=amount,message&limit=1`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );
      if (res.ok) {
        const rows = await res.json();
        if (rows.length > 0) {
          amount = rows[0].amount || 0;
          message = rows[0].message || "";
        }
      }
    }
  } catch (error) {
    console.error("Error fetching claim data for OG image:", error);
  }

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "#fafafa",
        alignItems: "center",
        justifyContent: "flex-start",
      }}
    >
      <img
        src={"https://swish.cash/assets/logo.svg"}
        alt="logo"
        width={40}
        style={{
          position: "absolute",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          top: 160,
          fontFamily: "Jost, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#121212",
            marginBottom: 0,
            opacity: 0.8,
          }}
        >
          Claim
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 300,
            marginTop: -32,
            color: "#121212",
            letterSpacing: "-0.02em",
          }}
        >
          ${amount.toLocaleString()}
        </div>
        {message && (
          <div
            style={{
              display: "flex",
              fontSize: 18,
              color: "#121212",
              opacity: 0.5,
              marginTop: 24,
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>,
    {
      ...size,
      fonts: font
        ? [
            {
              name: "Jost",
              data: font,
              style: "normal",
              weight: 300,
            },
          ]
        : undefined,
    },
  );
}
