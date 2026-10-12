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

/** 45_000 → "45s", 200_000 → "3m 20s", 8_100_000 → "2h 15m", 43_200_000 → "12h". */
export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const [h, m] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60)]
  return h ? `${h}h${m ? ` ${m}m` : ''}` : m ? `${m}m ${s % 60}s` : `${s}s`
}
