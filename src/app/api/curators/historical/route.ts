import { NextResponse } from 'next/server';
import { getProtocolHistoricalTvl, RISK_CURATOR_SLUGS } from '@/lib/defillama';
import { TOP_CURATOR_SLUGS, CURATOR_SLUG_TO_NAME as CURATOR_NAMES } from '@/lib/curator-names';

export const revalidate = 600; // 10 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  try {
    // If specific slug requested, return just that curator's history
    if (slug) {
      const data = await getProtocolHistoricalTvl(slug);
      return NextResponse.json({
        slug,
        name: CURATOR_NAMES[slug] || slug,
        data,
      });
    }

    // Otherwise return top curators' historical data
    const results = await Promise.all(
      TOP_CURATOR_SLUGS.map(async (curatorSlug) => {
        const data = await getProtocolHistoricalTvl(curatorSlug);
        return {
          slug: curatorSlug,
          name: CURATOR_NAMES[curatorSlug] || curatorSlug,
          data,
        };
      })
    );

    // Filter out curators with no data
    const validResults = results.filter(r => r.data.length > 0);

    return NextResponse.json({
      curators: validResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical data', curators: [] },
      { status: 500 }
    );
  }
}
