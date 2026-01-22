import { PrivacyCash } from "privacycash";
import { TOKEN_MINTS, TokenType } from "./tokens";

export async function withdrawFromPrivacyCash(
  client: PrivacyCash,
  amount: number,
  recipientAddress: string,
  tokenType: TokenType
) {
  if (tokenType === "SOL") {
    return client.withdraw({
      lamports: amount * 1_000_000_000,
      recipientAddress,
    });
  }

  return client.withdrawSPL({
    amount,
    mintAddress: TOKEN_MINTS[tokenType],
    recipientAddress,
  });
}
