export function normalizeBalanceMetadata(balance = {}, defaults = {}) {
  const source = balance && typeof balance === "object" ? balance : {};
  return {
    basis: String(source.basis ?? defaults.basis ?? "unspecified"),
    reviewed: typeof source.reviewed === "boolean" ? source.reviewed : Boolean(defaults.reviewed),
    notes: source.notes == null ? (defaults.notes ?? null) : String(source.notes)
  };
}
