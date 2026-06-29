import { source } from '@/lib/source';
import { getLLMText } from '@/lib/getllmstext';

export const revalidate = false;

export async function GET() {
  const scan = source.getPages().map(getLLMText);
  const scanned = await Promise.all(scan);

  return new Response(scanned.join('\n\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control':
        'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800',
      'Vercel-CDN-Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
