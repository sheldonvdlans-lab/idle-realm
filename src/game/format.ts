const UNITS = ['', 'K', 'M', 'B', 'T']

/** 999 → "999", 1234 → "1.2K", 3_400_000 → "3.4M". Rounds down: never shows more than you have. */
export function formatNumber(n: number): string {
  let unit = 1
  let i = 0
  while (n >= unit * 1000 && i < UNITS.length - 1) {
    unit *= 1000
    i++
  }
  return i ? Math.floor(n / (unit / 10)) / 10 + UNITS[i] : String(Math.floor(n))
}
