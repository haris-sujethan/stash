// Progress lines like the build plan's push output.
export const ok = (label: string, detail = "") => console.log(`✓ ${label.padEnd(27)}${detail}`);
export const warn = (label: string, detail = "") => console.log(`! ${label.padEnd(27)}${detail}`);
export const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 4)}…` : id);
export function ago(iso: string | Date): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
