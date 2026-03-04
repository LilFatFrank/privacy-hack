import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Claim";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
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

  // Fetch claim data
  let amount = 0;
  let message = "";

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/activity?id=eq.${params.id}&select=amount,message&limit=1`,
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
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fafafa",
          fontFamily: "Jost, sans-serif",
        }}
      >
        {/* Logo */}
        <svg
          width="80"
          height="40"
          viewBox="0 0 40 20"
          fill="none"
          style={{ marginBottom: 60 }}
        >
          <path
            d="M5 15C5 15 8 5 12 5C16 5 14 15 18 15C22 15 20 5 24 5C28 5 26 15 30 15C34 15 32 5 35 5"
            stroke="#121212"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Label */}
        <div
          style={{
            fontSize: 40,
            color: "#6b7280",
            marginBottom: 16,
            opacity: 0.8,
          }}
        >
          Claim
        </div>

        {/* Amount */}
        <div
          style={{
            fontSize: 120,
            marginTop: -32,
            fontWeight: 300,
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
              fontSize: 24,
              color: "#121212",
              opacity: 0.5,
              marginTop: 32,
            }}
          >
            {message}
          </div>
        )}
      </div>
    ),
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
    }
  );
}
