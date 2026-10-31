export const metadata = {
  title: 'Agent Browser',
  description:
    'Public AuthiChain catalogue, checkout links, and the open verifier. No command execution.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
