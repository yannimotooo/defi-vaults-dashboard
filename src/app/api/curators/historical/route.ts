import { NextResponse } from 'next/server';
import { getProtocolHistoricalTvl } from '@/lib/defillama';
import { TOP_CURATOR_SLUGS, CURATOR_SLUG_TO_NAME as CURATOR_NAMES, CURATOR_NAME_VARIANTS } from '@/lib/curator-names';
import {
  BITWISE_JUPITER_ETHENA_CURATOR_NAME,
  BITWISE_JUPITER_ETHENA_CURATOR_SLUG,
  getJupiterEthenaEarnMarket,
} from '@/lib/jupiter-lend';

export const revalidate = 600; // 10 minutes

// Build comprehensive slug list: TOP_CURATOR_SLUGS + all CURATOR_NAME_VARIANTS keys, deduplicated
const ALL_CURATOR_SLUGS = [...new Set([...TOP_CURATOR_SLUGS, ...Object.keys(CURATOR_NAME_VARIANTS)])];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  try {
    // If specific slug requested, return just that curator's history
    if (slug) {
      if (slug === BITWISE_JUPITER_ETHENA_CURATOR_SLUG) {
        const market = await getJupiterEthenaEarnMarket();
        return NextResponse.json({
          slug,
          name: BITWISE_JUPITER_ETHENA_CURATOR_NAME,
          data: market
            ? [{
                date: Math.floor(
                  market.updatedAt ? new Date(market.updatedAt).getTime() / 1000 : Date.now() / 1000,
                ),
                tvl: market.totalTvlUsd,
              }]
            : [],
        });
      }

      const data = await getProtocolHistoricalTvl(slug);
      return NextResponse.json({
        slug,
        name: CURATOR_NAMES[slug] || slug,
        data,
      });
    }

    // Otherwise return all curators' historical data
    const results = await Promise.all(
      ALL_CURATOR_SLUGS.map(async (curatorSlug) => {
        if (curatorSlug === BITWISE_JUPITER_ETHENA_CURATOR_SLUG) {
          const market = await getJupiterEthenaEarnMarket();
          return {
            slug: curatorSlug,
            name: BITWISE_JUPITER_ETHENA_CURATOR_NAME,
            data: market
              ? [{
                  date: Math.floor(
                    market.updatedAt ? new Date(market.updatedAt).getTime() / 1000 : Date.now() / 1000,
                  ),
                  tvl: market.totalTvlUsd,
                }]
              : [],
          };
        }

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
