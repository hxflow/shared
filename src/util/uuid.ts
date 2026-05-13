import { randomBytes } from "node:crypto"

/**
 * Generate a UUID v7 (time-ordered).
 *
 * Layout (RFC 9562 §5.7):
 *   48 bit unix_ts_ms | 4 bit version (=7) | 12 bit rand_a | 2 bit variant (=10) | 62 bit rand_b
 *
 * String form: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx  (y in [89ab])
 */
export function uuidv7(): string {
  const ts = BigInt(Date.now())
  const rand = randomBytes(10) // 80 random bits (12 for rand_a + 62 for rand_b + 6 unused)

  // 48-bit timestamp as 12 hex chars
  const tsHex = ts.toString(16).padStart(12, "0")

  // rand_a: 12 bits → 3 hex; high nibble of byte 0 OR'd with 0x70 (version 7)
  const versionHi = ((rand[0] & 0x0f) | 0x70).toString(16).padStart(2, "0")
  const randA = versionHi + rand[1].toString(16).padStart(2, "0")

  // variant: top 2 bits of byte 2 → 10
  const variantHi = ((rand[2] & 0x3f) | 0x80).toString(16).padStart(2, "0")
  const randB = variantHi + rand[3].toString(16).padStart(2, "0")

  // remaining 48 bits from bytes 4..9
  const rest = Array.from(rand.slice(4, 10))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-${randA}-${randB}-${rest}`
}
