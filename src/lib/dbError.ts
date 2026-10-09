// Postgres SQLSTATE 23505 = unique_violation
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "sqlState" in err &&
    (err as { sqlState?: unknown }).sqlState === "23505"
  );
}
