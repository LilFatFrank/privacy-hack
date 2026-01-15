import { PrivacyCash } from "privacycash";

export function createPrivacyCashClient(
  rpcUrl: string,
  burnerPrivateKey: Uint8Array
): PrivacyCash {
  return new PrivacyCash({
    RPC_url: rpcUrl,
    owner: burnerPrivateKey,
  });
}
