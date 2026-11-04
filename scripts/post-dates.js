// Inputs without an offset use the blog's timezone, independent of the host.
export function normalizePostDate(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('无效的文章时间');
    return value.toISOString();
  }
  const input = String(value).trim();
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!match) throw new Error('时间请使用 YYYY-MM-DD 或 ISO 格式');
  const [, year, month, day] = match;
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > days) throw new Error('无效的文章日期');
  let iso = input.replace(' ', 'T');
  if (iso.length === 10) iso += 'T00:00:00';
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) iso += '+08:00';
  const result = new Date(iso);
  if (!Number.isFinite(result.getTime())) throw new Error('无效的文章时间');
  return result.toISOString();
}

export function resolvePostDates(meta, previous = {}, now = new Date()) {
  const timestamp = normalizePostDate(now);
  const date = normalizePostDate(meta.date) ?? normalizePostDate(previous.date)
    ?? (meta.draft ? undefined : timestamp);
  const createdDate = normalizePostDate(meta.createdDate) ?? normalizePostDate(previous.createdDate)
    ?? normalizePostDate(previous.date) ?? date ?? timestamp;
  const updateDate = normalizePostDate(meta.updateDate) ?? timestamp;
  return { createdDate, date, updateDate };
}
