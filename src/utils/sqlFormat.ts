export const formatSql = (sql: string): string => {
  const trimmed = sql.trim();
  if (!trimmed) return '';

  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, '').trim();
  const normalized = withoutTrailingSemicolon.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
  const clauses = normalized
    .split(/\s+(?=(?:SELECT|FROM|WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|FULL\s+OUTER\s+JOIN)\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!clauses.length) return '';

  const formatted = clauses.join('\n');
  return `${formatted};`;
};
