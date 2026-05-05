/// Convert an activity count for a (account, week) cell into a heat color.
/// Uses log scale because activity is power-law distributed: a few accounts
/// have 30+/week, most have 0-2.
///
/// Palette: SYSDE light → SYSDE red, with grey for 0.
const STOPS: Array<{ max: number; color: string }> = [
  { max: 0, color: '#F4F4F2' },   // sysde-light, no activity
  { max: 1, color: '#FECACA' },   // 1
  { max: 3, color: '#FCA5A5' },   // 2-3
  { max: 6, color: '#F87171' },   // 4-6
  { max: 12, color: '#EF4444' },  // 7-12
  { max: 24, color: '#DC2626' },  // 13-24
  { max: Infinity, color: '#991B1B' }, // 25+
];

export function intensityToColor(count: number): string {
  for (const s of STOPS) {
    if (count <= s.max) return s.color;
  }
  return STOPS[STOPS.length - 1].color;
}

/// Whether the cell color is dark enough to need white text on top.
export function intensityNeedsLightText(count: number): boolean {
  return count > 6;
}
