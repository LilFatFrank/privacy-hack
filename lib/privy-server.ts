import { PrivyClient } from "@privy-io/server-auth";

let privyClient: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
    }

    privyClient = new PrivyClient(appId, appSecret);
  }

  return privyClient;
}
