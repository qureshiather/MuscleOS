/**
 * The version line on the About screen: "1.0.0 (42)" — marketing version, then the store build
 * number. Either part can be missing outside a native build (tests, web); a blank build is dropped.
 */
export function formatAppVersion(version: string | null | undefined, build: string | null | undefined): string {
  const v = version?.trim();
  const b = build?.trim();
  if (!v) return b ? `Build ${b}` : 'Unknown';
  return b ? `${v} (${b})` : v;
}
