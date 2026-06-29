import { type NextRequest, NextResponse } from 'next/server';
import { getLLMText } from '@/lib/getllmstext';
import { source } from '@/lib/source';

export const revalidate = false;
export const dynamicParams = false;

export async function GET(
  _req: NextRequest,
  props: {
    params: Promise<{ slug?: string[] }>;
  },
) {
  const slug = (await props.params).slug;
  const page = source.getPage(slug);

  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  return new NextResponse(await getLLMText(page), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control':
        'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800',
      'Vercel-CDN-Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
