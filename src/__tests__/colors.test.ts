import { describe, it, expect } from 'vitest';
import { getCuratorColor, getChainColor, getProtocolColor, CURATOR_COLORS, CHAIN_COLORS } from '@/lib/colors';

describe('getCuratorColor', () => {
  it('returns a known color for mapped curators', () => {
    const knownCurator = Object.keys(CURATOR_COLORS)[0];
    if (knownCurator) {
      const color = getCuratorColor(knownCurator);
      expect(color).toBe(CURATOR_COLORS[knownCurator]);
    }
  });

  it('returns a fallback color for unknown curators', () => {
    const color = getCuratorColor('Unknown Curator XYZ', 0);
    expect(color).toBeTruthy();
    expect(color.startsWith('#')).toBe(true);
  });

  it('returns different fallback colors for different indices', () => {
    const color1 = getCuratorColor('Unknown A', 0);
    const color2 = getCuratorColor('Unknown B', 1);
    expect(color1).not.toBe(color2);
  });
});

describe('getChainColor', () => {
  it('returns colors for known chains', () => {
    const knownChain = Object.keys(CHAIN_COLORS)[0];
    if (knownChain) {
      const color = getChainColor(knownChain);
      expect(color).toBeTruthy();
    }
  });

  it('returns a fallback for unknown chains', () => {
    const color = getChainColor('UnknownChain');
    expect(color).toBeTruthy();
  });
});

describe('getProtocolColor', () => {
  it('returns colors for known protocols', () => {
    const color = getProtocolColor('Morpho');
    expect(color).toBeTruthy();
  });

  it('returns a fallback for unknown protocols', () => {
    const color = getProtocolColor('UnknownProtocol');
    expect(color).toBeTruthy();
  });
});
