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

  try {
    // Need absolute URL in edge runtime - relative URLs don't work
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://swish.cash";
    const res = await fetch(`${baseUrl}/api/send_claim/${id}`);
    if (res.ok) {
      const data = await res.json();
      amount = data.amount || 0;
    }
  } catch (error) {
    console.error("Error fetching request data for OG image:", error);
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
            fontSize: 16,
            color: "#121212",
            marginBottom: 0,
            opacity: 0.4,
          }}
        >
          Claim
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 300,
            color: "#121212",
            letterSpacing: "-0.02em",
          }}
        >
          ${amount.toLocaleString()}
        </div>
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
