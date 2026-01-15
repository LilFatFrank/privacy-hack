import { PrivacyCash } from "privacycash";
import { TOKEN_MINTS, TokenType } from "./tokens";

export async function depositToPrivacyCash(
  client: PrivacyCash,
  amount: number,
  tokenType: TokenType
) {
  if (tokenType === "SOL") {
    return client.deposit({
      lamports: amount * 1_000_000_000,
    });
  }

  return client.depositSPL({
    amount,
    mintAddress: TOKEN_MINTS[tokenType],
  });
}
