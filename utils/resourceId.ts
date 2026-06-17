/**
 * Backend entity `id` fields are absolute URLs whose last path segment is the
 * resource identifier/slug, e.g. `http://localhost:8080/local/curriculum/cardiology`.
 *
 * `resourceIdentifier` normalizes either a full URL id or a bare slug down to the
 * trailing segment — use it for `{identifier}` path params. Update bodies and
 * `?...Id=` query filters expect the full absolute `id`, not this trailing slug.
 */
export const resourceIdentifier = (urlOrId: string | null | undefined): string => {
  const trimmed = (urlOrId ?? '').trim();
  if (!trimmed) return '';
  const withoutQuery = trimmed.split(/[?#]/, 1)[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : withoutQuery;
};

/**
 * Prefer an explicit `identifier` field, falling back to deriving it from the
 * URL-format `id`. Useful where a response may omit `identifier`.
 */
export const identifierOf = (entity: {
  identifier?: string | null;
  id?: string | null;
}): string => {
  const explicit = (entity.identifier ?? '').trim();
  return explicit || resourceIdentifier(entity.id);
};
