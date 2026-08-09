export function normalizeBalanceMetadata(balance = {}, defaults = {}) {
  const source = balance && typeof balance === "object" ? balance : {};
  const analogsSource = Array.isArray(source.analogs) ? source.analogs : (Array.isArray(defaults.analogs) ? defaults.analogs : []);
  const analogs = [...new Set(analogsSource
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim()))];
  return {
    basis: String(source.basis ?? defaults.basis ?? "unspecified"),
    reviewed: typeof source.reviewed === "boolean" ? source.reviewed : Boolean(defaults.reviewed),
    notes: source.notes == null ? (defaults.notes ?? null) : String(source.notes),
    ...(analogs.length ? { analogs } : {})
  };
}
