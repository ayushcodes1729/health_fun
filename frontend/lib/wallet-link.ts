/**
 * The exact text a wallet signs to link itself to a Google account. Shared
 * by the browser (builds it to sign) and the server (rebuilds it to verify).
 * It names the account so a signature for one account cannot be replayed to
 * link the same wallet elsewhere, and carries a timestamp so it expires.
 */
export function linkMessage(email: string, wallet: string, issuedAt: number): string {
  return `health_fun: link wallet ${wallet} to ${email}\nissued: ${issuedAt}`;
}
