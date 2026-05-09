import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qronId = searchParams.get('id') || 'demo';
  const theme = searchParams.get('theme') || 'light';
  const size = searchParams.get('size') || '200';

  return NextResponse.json({
    success: true,
    endpoint: '/api/embed',
    embed: {
      qron_id: qronId,
      embed_url: `https://qron.space/embed/${qronId}`,
      iframe_code: `<iframe src="https://qron.space/embed/${qronId}" width="${size}" height="${size}" frameborder="0"></iframe>`,
      script_code: `<script src="https://qron.space/embed.js" data-id="${qronId}" data-theme="${theme}"></script>`,
      theme,
      size: parseInt(size),
      formats: ['iframe', 'script', 'image'],
    },
    protocol: 'QRON',
  });
}
