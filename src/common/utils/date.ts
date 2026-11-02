/**
 * Date and time formatting utilities
 */

export function formatDateTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString.replace(' ', 'T'));
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return isoString;
  }
}

export function getCurrentTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}
