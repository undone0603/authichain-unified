export function verifySecret(request: Request, secret: string): boolean {
  const header = request.headers.get('X-Telegram-Secret-Token')
  return header !== null && header === secret
}
