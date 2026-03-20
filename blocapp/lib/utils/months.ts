export const MONTHS_RO = [
  "", // index 0 unused
  "Ianuarie",
  "Februarie",
  "Martie",
  "Aprilie",
  "Mai",
  "Iunie",
  "Iulie",
  "August",
  "Septembrie",
  "Octombrie",
  "Noiembrie",
  "Decembrie",
]

export function formatPeriod(month: number, year: number) {
  return `${MONTHS_RO[month]} ${year}`
}
