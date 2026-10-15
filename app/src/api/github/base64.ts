/** UTF-8 safe base64 decoding (GitHub contents API returns base64 with line breaks). */
export function decodeBase64Utf8(input: string): string {
  const binary = atob(input.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}
