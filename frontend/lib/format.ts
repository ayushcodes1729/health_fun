import { SECONDS_PER_DAY, STAKE_MINT_DECIMALS } from "./solana/config";

/** MM/DD/YY. Dates in this app are UTC days, so format in UTC too. */
export function formatDateMMDDYY(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

/** An on-chain epoch day (unix / 86400) as MM/DD/YY. */
export function formatEpochDay(epochDay: number): string {
  return formatDateMMDDYY(new Date(epochDay * SECONDS_PER_DAY * 1000));
}

/** A unix timestamp as MM/DD/YY plus a local time. */
export function formatUnix(unix: number): string {
  const d = new Date(unix * 1000);
  return `${formatDateMMDDYY(d)} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

export function formatTokens(baseUnits: bigint | number | string | { toString(): string }): string {
  const n = BigInt(baseUnits.toString());
  const d = BigInt(10) ** BigInt(STAKE_MINT_DECIMALS);
  const whole = n / d;
  const frac = (n % d).toString().padStart(STAKE_MINT_DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
