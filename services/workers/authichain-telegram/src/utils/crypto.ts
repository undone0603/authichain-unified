export function verifySecret(request: Request, secret: string): boolean {
  const header = request.headers.get('X-Telegram-Secret-Token')
  if (!header || header.length !== secret.length) return false
  const enc = new TextEncoder()
  const a = enc.encode(header)
  const b = enc.encode(secret)
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
