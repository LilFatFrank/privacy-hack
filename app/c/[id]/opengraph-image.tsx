import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Claim";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  // Fetch claim data
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let amount = 0;

  try {
    const res = await fetch(`${baseUrl}/api/send_claim/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      amount = data.amount || 0;
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
          fontFamily: "system-ui, sans-serif",
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
            fontSize: 32,
            color: "#6b7280",
            marginBottom: 16,
          }}
        >
          Claim
        </div>

        {/* Amount */}
        <div
          style={{
            fontSize: 120,
            fontWeight: 300,
            color: "#121212",
            letterSpacing: "-0.02em",
          }}
        >
          ${amount.toLocaleString()}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
