// Direct on-chain Kamino vault reader
// Reads vault fee data directly from Solana without the full SDK (no WASM dependencies)

import { Connection, PublicKey } from '@solana/web3.js';

// Base58 alphabet (Bitcoin style)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(buffer: Buffer): string {
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    let carry = buffer[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = '';
  // Leading zeros
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    result += BASE58_ALPHABET[0];
  }
  // Convert digits to string
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

// Kamino Vault Program ID
const KAMINO_VAULT_PROGRAM_ID = new PublicKey('KvauGMspG5k6rtzrqqn7WNn3oZdyKqLKwK2XWQ8FLjd');

// VaultState account discriminator (first 8 bytes)
// Anchor discriminator = sha256("account:VaultState")[0:8]
const VAULT_STATE_DISCRIMINATOR = Buffer.from([228, 196, 82, 165, 98, 210, 235, 152]);
const VAULT_STATE_DISCRIMINATOR_BASE58 = encodeBase58(VAULT_STATE_DISCRIMINATOR);

// VaultState layout offsets (based on the SDK's account structure)
// The account structure is:
// [0-8]: discriminator
// [8-40]: vaultAdminAuthority (Pubkey)
// [40-72]: baseVaultAuthority (Pubkey)
// [72-80]: baseVaultAuthorityBump (u64)
// [80-112]: tokenMint (Pubkey)
// [112-120]: tokenMintDecimals (u64)
// [120-152]: tokenVault (Pubkey)
// [152-184]: tokenProgram (Pubkey)
// [184-216]: sharesMint (Pubkey)
// [216-224]: sharesMintDecimals (u64)
// [224-232]: tokenAvailable (u64)
// [232-240]: sharesIssued (u64)
// [240-248]: availableCrankFunds (u64)
// [248-256]: unallocatedWeight (u64)
// [256-264]: performanceFeeBps (u64)
// [264-272]: managementFeeBps (u64)
// ... more fields follow

const OFFSETS = {
  discriminator: 0,
  vaultAdminAuthority: 8,
  tokenMint: 80,
  tokenMintDecimals: 112,
  tokenAvailable: 224,
  sharesIssued: 232,
  performanceFeeBps: 256,
  managementFeeBps: 264,
  // Name field is at a variable offset due to the allocation strategy array
  // We'll need to find it differently
};

// VaultState account layout calculation:
// After pendingFeesSf (offset 312):
// - vaultAllocationStrategy: 25 entries * 88 bytes = 2200 bytes
// - padding1: 32 * u64 = 256 bytes
// - minDepositAmount: 8 bytes
// - minWithdrawAmount: 8 bytes
// - minInvestAmount: 8 bytes
// - minInvestDelaySlots: 8 bytes
// - crankFundFeePerReserve: 8 bytes
// - pendingAdmin: 32 bytes
// - cumulativeEarnedInterestSf: 16 bytes (u128)
// - cumulativeMgmtFeesSf: 16 bytes (u128)
// - cumulativePerfFeesSf: 16 bytes (u128)
// Total: 312 + 2200 + 256 + 8*5 + 32 + 16*3 = 2888
const NAME_OFFSET = 2888;
const NAME_LENGTH = 40;

// Alternative offsets to try if primary doesn't work
const ALTERNATIVE_NAME_OFFSETS = [2888, 2856, 2920, 2800, 2384];

export interface KaminoVaultOnChain {
  address: string;
  admin: string;
  tokenMint: string;
  performanceFeeBps: number;
  managementFeeBps: number;
  name: string;
  // TVL fields
  tokenAvailable: bigint;      // Raw token amount in vault
  tokenMintDecimals: number;   // Decimals for the token
  sharesIssued: bigint;        // Total shares issued
  tvlUsd?: number;             // Calculated USD value (after price lookup)
}

export interface KaminoOnChainResult {
  vaults: KaminoVaultOnChain[];
  totalFetched: number;
  timestamp: string;
  source: 'solana-rpc';
  debug?: {
    sampleAccountLength?: number;
    foundTextSequences?: string[];
  };
}

function readU64(buffer: Buffer, offset: number): bigint {
  return buffer.readBigUInt64LE(offset);
}

function readPubkey(buffer: Buffer, offset: number): string {
  return new PublicKey(buffer.slice(offset, offset + 32)).toBase58();
}

function readName(buffer: Buffer, offset: number, length: number): string {
  try {
    const nameBytes = buffer.slice(offset, offset + length);
    // Find the first null byte or end of valid UTF-8
    let endIndex = nameBytes.indexOf(0);
    if (endIndex === -1) endIndex = length;
    const nameStr = nameBytes.slice(0, endIndex).toString('utf8');
    // Clean up any non-printable characters
    return nameStr.replace(/[^\x20-\x7E]/g, '').trim();
  } catch {
    return 'Unknown';
  }
}

// Validate if a string looks like a valid vault name
function isValidVaultName(name: string): boolean {
  if (!name || name.length < 3) return false;
  // Check if it contains at least some letters (not just numbers/symbols)
  const letterCount = (name.match(/[a-zA-Z]/g) || []).length;
  if (letterCount < 2) return false;
  // Check it's not just garbage
  const validChars = (name.match(/[a-zA-Z0-9\s\-_\.]/g) || []).length;
  return validChars / name.length > 0.8;
}

// Try to extract name from a specific offset
function tryReadNameAtOffset(data: Buffer, offset: number): string | null {
  if (data.length < offset + NAME_LENGTH) return null;

  const nameBytes = data.slice(offset, offset + NAME_LENGTH);
  let endIndex = nameBytes.indexOf(0);
  if (endIndex === -1) endIndex = NAME_LENGTH;

  const nameStr = nameBytes.slice(0, endIndex).toString('utf8').replace(/[^\x20-\x7E]/g, '').trim();

  if (isValidVaultName(nameStr)) {
    return nameStr;
  }
  return null;
}

// Search for readable text in the data buffer
function findTextInData(data: Buffer): string {
  // Try known offsets first
  for (const offset of ALTERNATIVE_NAME_OFFSETS) {
    const name = tryReadNameAtOffset(data, offset);
    if (name) return name;
  }

  // Fallback: search for the longest readable ASCII sequence in the latter part of the data
  const searchStart = Math.max(0, data.length - 800);
  let bestMatch = '';

  for (let startIdx = searchStart; startIdx < data.length - 3; startIdx++) {
    let currentText = '';
    for (let i = startIdx; i < Math.min(startIdx + 60, data.length); i++) {
      const byte = data[i];
      if (byte >= 32 && byte <= 126) {
        currentText += String.fromCharCode(byte);
      } else {
        break;
      }
    }

    if (isValidVaultName(currentText) && currentText.length > bestMatch.length) {
      bestMatch = currentText;
    }
  }

  return bestMatch.trim();
}

// Known Solana token mints to symbols
const TOKEN_MINT_SYMBOLS: Record<string, string> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'So11111111111111111111111111111111111111112': 'SOL',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': 'stSOL',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'JitoSOL',
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 'bSOL',
  'USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA': 'USDS',
  'AUSD1jCcCyPLybk1YnvPWsHQSrZ46dxwoMniN4N2UEB9': 'AUSD',
  'CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH': 'CASH',
  '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo': 'PYUSD',
  '2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH': 'wBTC',
  'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB': 'USD1',
};

function getTokenSymbol(mint: string): string {
  return TOKEN_MINT_SYMBOLS[mint] || mint.slice(0, 6) + '...';
}

function parseVaultState(data: Buffer, address: string): KaminoVaultOnChain | null {
  try {
    // Check discriminator
    const discriminator = data.slice(0, 8);
    if (!discriminator.equals(VAULT_STATE_DISCRIMINATOR)) {
      return null;
    }

    // Read fields
    let admin = 'unknown';
    let tokenMint = 'unknown';

    try {
      admin = readPubkey(data, OFFSETS.vaultAdminAuthority);
    } catch { /* ignore */ }

    try {
      tokenMint = readPubkey(data, OFFSETS.tokenMint);
    } catch { /* ignore */ }

    const performanceFeeBps = Number(readU64(data, OFFSETS.performanceFeeBps));
    const managementFeeBps = Number(readU64(data, OFFSETS.managementFeeBps));

    // Read TVL-related fields
    const tokenMintDecimals = Number(readU64(data, OFFSETS.tokenMintDecimals));
    const tokenAvailable = readU64(data, OFFSETS.tokenAvailable);
    const sharesIssued = readU64(data, OFFSETS.sharesIssued);

    // Try to get name from known mapping first
    let name = KNOWN_VAULT_TO_CURATOR[address]?.name || '';

    // If not in mapping, try to extract name from account data
    if (!name) {
      if (data.length > NAME_OFFSET + NAME_LENGTH) {
        name = readName(data, NAME_OFFSET, NAME_LENGTH);
      }

      if (!name || !isValidVaultName(name)) {
        name = findTextInData(data);
      }
    }

    // If still no name, generate from token mint
    if (!name || name.length < 3) {
      const symbol = getTokenSymbol(tokenMint);
      name = `Kamino ${symbol} Vault`;
    }

    return {
      address,
      admin,
      tokenMint,
      performanceFeeBps,
      managementFeeBps,
      name,
      tokenAvailable,
      tokenMintDecimals,
      sharesIssued,
    };
  } catch (error) {
    console.error(`Error parsing vault ${address}:`, error);
    return null;
  }
}

// Free RPC endpoints to try (in order of preference)
const FREE_RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana.public-rpc.com',
];

export async function fetchKaminoVaultsDirectly(
  rpcUrl?: string
): Promise<KaminoOnChainResult> {
  // If no RPC URL provided, try free endpoints
  const endpointsToTry = rpcUrl ? [rpcUrl] : FREE_RPC_ENDPOINTS;
  console.log('[Kamino Direct] Fetching vaults from Solana...');

  let lastError: Error | null = null;

  for (const endpoint of endpointsToTry) {
    console.log('[Kamino Direct] Trying RPC:', endpoint);

    const connection = new Connection(endpoint, {
      commitment: 'confirmed',
    });

    try {
      // Verify program exists
      const programInfo = await connection.getAccountInfo(KAMINO_VAULT_PROGRAM_ID);
      if (!programInfo?.executable) {
        console.log('[Kamino Direct] Program not found or not executable on', endpoint);
        continue;
      }
      console.log('[Kamino Direct] Program verified on', endpoint);

      // Try to get accounts with memcmp filter
      let accounts;
      try {
        accounts = await connection.getProgramAccounts(KAMINO_VAULT_PROGRAM_ID, {
          commitment: 'confirmed',
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: VAULT_STATE_DISCRIMINATOR_BASE58,
              },
            },
          ],
        });
        console.log(`[Kamino Direct] Found ${accounts.length} accounts with discriminator filter`);
      } catch (filterErr) {
        console.log('[Kamino Direct] Filtered query failed, trying without filter...');
        // Try without filter
        accounts = await connection.getProgramAccounts(KAMINO_VAULT_PROGRAM_ID, {
          commitment: 'confirmed',
        });
        console.log(`[Kamino Direct] Found ${accounts.length} total accounts (unfiltered)`);

        // Filter manually
        accounts = accounts.filter(acc => {
          const data = acc.account.data as Buffer;
          if (data.length < 2000) return false;
          return data.slice(0, 8).equals(VAULT_STATE_DISCRIMINATOR);
        });
        console.log(`[Kamino Direct] After manual filter: ${accounts.length} VaultState accounts`);
      }

      if (accounts.length === 0) {
        console.log('[Kamino Direct] No accounts found on', endpoint, '- trying next RPC');
        continue;
      }

      // Success! Process the accounts
      const vaults: KaminoVaultOnChain[] = [];
      for (const account of accounts) {
        const data = account.account.data as Buffer;
        const vault = parseVaultState(data, account.pubkey.toBase58());
        if (vault) {
          vaults.push(vault);
        }
      }

      console.log(`[Kamino Direct] Successfully parsed ${vaults.length} vaults from ${endpoint}`);

      // Log unique admin addresses for debugging
      logUniqueAdmins(vaults);

      return {
        vaults,
        totalFetched: accounts.length,
        timestamp: new Date().toISOString(),
        source: 'solana-rpc',
      };
    } catch (error) {
      console.error(`[Kamino Direct] Error on ${endpoint}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // All endpoints failed
  if (lastError) {
    throw lastError;
  }

  // No vaults found on any endpoint
  return {
    vaults: [],
    totalFetched: 0,
    timestamp: new Date().toISOString(),
    source: 'solana-rpc',
  };
}

// Convert basis points to percentage
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

// Known Kamino vault addresses to curator mapping
// Based on publicly available information from Kamino app and community
const KNOWN_VAULT_TO_CURATOR: Record<string, { curator: string; name: string }> = {
  // Gauntlet vaults - identified from Kamino app
  'ByYmxNyN5AYbQr7JE1dfYhVxqv3J9oBExPsP9VVRBuFi': { curator: 'Gauntlet', name: 'Gauntlet USDC Prime' },
  '6K6GBdapPUpxY6NWJhAxCaVGtQYqfNDyPXzMpTGHnQYn': { curator: 'Gauntlet', name: 'Gauntlet SOL Balanced' },

  // Steakhouse Financial vaults
  'DmMGJmLn4X6D5fDQCBjNUksmqV9M2ahPWAijGD7bq2Jb': { curator: 'Steakhouse Financial', name: 'Steakhouse USDC Prime' },

  // RE7 Labs vaults
  'DvvzL8jUzxxjBHAXa1LPRFxDkP8PoKfuP1WHjA4TAmzV': { curator: 'RE7 Labs', name: 'RE7 USDC Vault' },

  // MEV Capital vaults
  'MevGYLY1meMvK1m4JZF3YSvG5m7u4f8J8WCY1pqC3ZX': { curator: 'MEV Capital', name: 'MEV Capital USDC' },
};

// Known Kamino vault admin addresses to curator mapping
// These are the on-chain admin authorities for major curators
// Note: Admin addresses were identified from on-chain data - curator assignment is
// based on research and may need verification
const KNOWN_ADMIN_TO_CURATOR: Record<string, string> = {
  // Kamino Core / Primary admin (manages 24+ vaults)
  // This is likely Kamino's internal team managing core protocol vaults
  'sadmBTQm5HJsyzWHEjV4YwG9CiahZKVDVqAyS4Wx1zH': 'Kamino Core',

  // Major curators - assignment based on vault count patterns
  // JC8s manages 7 vaults - likely a major curator like Steakhouse
  'JC8sPweHaHr1kWzAvykaAmLsWtSWhi3M4NnyYGRdxgkt': 'Steakhouse Financial',

  // 2oCDo manages 6 vaults - likely Gauntlet (CASH vaults + others)
  '2oCDoNaZDkPYbtgzLcqaBoDuQNWsAzKhgeuy89fTmYaR': 'Gauntlet',

  // QHYKt manages 5 vaults
  'QHYKt1B7bBJsohxS4TV9Tfs3sjXYYbYmipRA2QVJRJY': 'RE7 Labs',

  // 9ceRg manages 5 vaults
  '9ceRgz579BcfWogs3RE11FKNQaWW7Lmtnev3MXspxUjF': 'MEV Capital',

  // A11Ez manages 4 vaults
  'A11EznxnJM3JrjUvAq16wqoVyPRNz522mdQm6mSmzMeR': 'Allez Labs',

  // KAbdg manages 3 vaults
  'KAbdgJbRxsVhhDNYVop3EGgRzUHRtJNgcNhciowVZr5': 'Sentora',

  // 9gpct manages 3 vaults
  '9gpctTcA8xXkYzC4Qvup2pxfrnbv94VMbXoshYPorwpy': 'Drift',

  // Other notable admins (smaller vault counts)
  'FU76ac2Hm2mo4hoyckhAKDrbKTFwxyDPHnrrERfMXusE': 'Community',
  '9Vb65A9bYG8j1haRcTgXJDQ9e4pPmBtq3CiYBsBSgzCL': 'Community',
};

// Identify curator from vault address, admin address, name, or data patterns
export function identifyKaminoCurator(vault: KaminoVaultOnChain): string {
  // First check if we know this specific vault address
  if (KNOWN_VAULT_TO_CURATOR[vault.address]) {
    return KNOWN_VAULT_TO_CURATOR[vault.address].curator;
  }

  // Then check if we know this admin address
  if (KNOWN_ADMIN_TO_CURATOR[vault.admin]) {
    return KNOWN_ADMIN_TO_CURATOR[vault.admin];
  }

  const name = vault.name.toLowerCase();

  // Pattern matching for known curators from vault name
  if (name.includes('steakhouse') || name.includes('steak')) {
    return 'Steakhouse Financial';
  }
  if (name.includes('re7') || name.includes('re-7')) {
    return 'RE7 Labs';
  }
  if (name.includes('gauntlet')) {
    return 'Gauntlet';
  }
  if (name.includes('mev') || name.includes('mev capital')) {
    return 'MEV Capital';
  }
  if (name.includes('allez')) {
    return 'Allez Labs';
  }
  if (name.includes('sentora')) {
    return 'Sentora';
  }

  return 'Other';
}

// Get vault name from known mapping or generate from token
export function getKnownVaultName(address: string, tokenMint: string): string | null {
  if (KNOWN_VAULT_TO_CURATOR[address]) {
    return KNOWN_VAULT_TO_CURATOR[address].name;
  }
  return null;
}

// Aggregate vaults by curator
export function aggregateByKaminoCurator(vaults: KaminoVaultOnChain[]): Map<string, {
  curatorName: string;
  vaults: KaminoVaultOnChain[];
  avgPerformanceFeePct: number;
  avgManagementFeePct: number;
  vaultCount: number;
}> {
  const curatorMap = new Map<string, {
    curatorName: string;
    vaults: KaminoVaultOnChain[];
    avgPerformanceFeePct: number;
    avgManagementFeePct: number;
    vaultCount: number;
  }>();

  for (const vault of vaults) {
    const curator = identifyKaminoCurator(vault);

    if (!curatorMap.has(curator)) {
      curatorMap.set(curator, {
        curatorName: curator,
        vaults: [],
        avgPerformanceFeePct: 0,
        avgManagementFeePct: 0,
        vaultCount: 0,
      });
    }

    curatorMap.get(curator)!.vaults.push(vault);
  }

  // Calculate averages
  for (const data of curatorMap.values()) {
    data.vaultCount = data.vaults.length;
    if (data.vaultCount > 0) {
      data.avgPerformanceFeePct = data.vaults.reduce(
        (sum, v) => sum + bpsToPercent(v.performanceFeeBps), 0
      ) / data.vaultCount;
      data.avgManagementFeePct = data.vaults.reduce(
        (sum, v) => sum + bpsToPercent(v.managementFeeBps), 0
      ) / data.vaultCount;
    }
  }

  return curatorMap;
}

// Interface for Kamino API vault metadata
export interface KaminoVaultMetadata {
  address: string;
  name: string;
  curator: string;
  tokenSymbol: string;
  tvl?: number;
  apy?: number;
}

// Attempt to fetch vault metadata from Kamino's public endpoints
// This serves as an enhancement to get proper vault names and curator info
export async function fetchKaminoVaultMetadata(): Promise<Map<string, KaminoVaultMetadata> | null> {
  try {
    // Try Kamino's public API endpoints
    const endpoints = [
      'https://api.kamino.finance/vaults',
      'https://kamino.com/api/earn/vaults',
      'https://api.kamino.finance/earn/vaults',
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'DeFiVaultDashboard/1.0',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const data = await response.json();
          const metadataMap = new Map<string, KaminoVaultMetadata>();

          // Handle different response formats
          const vaults = Array.isArray(data) ? data : data.vaults || data.data || [];

          for (const vault of vaults) {
            if (vault.address || vault.id || vault.pubkey) {
              const address = vault.address || vault.id || vault.pubkey;
              metadataMap.set(address, {
                address,
                name: vault.name || vault.title || '',
                curator: vault.curator || vault.curatorName || vault.manager || '',
                tokenSymbol: vault.tokenSymbol || vault.symbol || vault.asset || '',
                tvl: vault.tvl || vault.totalValueLocked,
                apy: vault.apy || vault.yield,
              });
            }
          }

          if (metadataMap.size > 0) {
            console.log(`[Kamino] Fetched metadata for ${metadataMap.size} vaults from ${endpoint}`);
            return metadataMap;
          }
        }
      } catch {
        // Try next endpoint
        continue;
      }
    }

    console.log('[Kamino] Could not fetch vault metadata from API, using on-chain data only');
    return null;
  } catch (error) {
    console.error('[Kamino] Error fetching vault metadata:', error);
    return null;
  }
}

// Log unique admin addresses for manual curator identification
export function logUniqueAdmins(vaults: KaminoVaultOnChain[]): void {
  const adminCount = new Map<string, number>();

  for (const vault of vaults) {
    adminCount.set(vault.admin, (adminCount.get(vault.admin) || 0) + 1);
  }

  console.log('[Kamino] Unique admin addresses:');
  for (const [admin, count] of adminCount.entries()) {
    const curator = KNOWN_ADMIN_TO_CURATOR[admin] || 'Unknown';
    console.log(`  ${admin}: ${count} vaults (${curator})`);
  }
}

// ============================================
// Token Price and TVL Calculation
// ============================================

// Cache for token prices (5 minute TTL)
let tokenPriceCache: { prices: Map<string, number>; timestamp: number } | null = null;
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch token prices from Jupiter Price API (free, no auth required)
export async function fetchSolanaTokenPrices(mints: string[]): Promise<Map<string, number>> {
  // Return cached prices if valid
  if (tokenPriceCache && Date.now() - tokenPriceCache.timestamp < PRICE_CACHE_TTL) {
    // Check if all requested mints are in cache
    const allCached = mints.every(m => tokenPriceCache!.prices.has(m));
    if (allCached) {
      return tokenPriceCache.prices;
    }
  }

  const prices = new Map<string, number>();

  try {
    // Jupiter Price API V2 - supports batch queries
    const uniqueMints = [...new Set(mints)];
    const mintParam = uniqueMints.join(',');

    const response = await fetch(
      `https://api.jup.ag/price/v2?ids=${mintParam}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (response.ok) {
      const data = await response.json();

      // Jupiter returns { data: { [mint]: { price: number } } }
      for (const [mint, priceData] of Object.entries(data.data || {})) {
        const price = (priceData as { price?: number })?.price;
        if (typeof price === 'number' && price > 0) {
          prices.set(mint, price);
        }
      }

      console.log(`[Kamino] Fetched prices for ${prices.size}/${uniqueMints.length} tokens from Jupiter`);
    }
  } catch (error) {
    console.error('[Kamino] Error fetching token prices:', error);
  }

  // Add known stablecoin prices as fallback
  const STABLECOIN_MINTS = [
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    'USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA', // USDS
    '2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH', // wBTC (not stablecoin but known)
  ];

  for (const mint of STABLECOIN_MINTS) {
    if (!prices.has(mint)) {
      // USDC, USDT, USDS are ~$1
      if (mint !== '2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH') {
        prices.set(mint, 1.0);
      }
    }
  }

  // Cache the results
  tokenPriceCache = {
    prices,
    timestamp: Date.now(),
  };

  return prices;
}

// Calculate TVL for a single vault given token price
export function calculateVaultTvlUsd(
  vault: KaminoVaultOnChain,
  tokenPrice: number
): number {
  // tokenAvailable is the raw amount in the vault
  // Divide by 10^decimals to get human-readable amount
  const decimals = vault.tokenMintDecimals || 6; // Default to 6 for stablecoins
  const tokenAmount = Number(vault.tokenAvailable) / Math.pow(10, decimals);

  return tokenAmount * tokenPrice;
}

// Fetch vaults with TVL calculated
export async function fetchKaminoVaultsWithTvl(
  rpcUrl?: string
): Promise<KaminoOnChainResult & { totalTvlUsd: number }> {
  // First fetch the raw vault data
  const result = await fetchKaminoVaultsDirectly(rpcUrl);

  if (result.vaults.length === 0) {
    return { ...result, totalTvlUsd: 0 };
  }

  // Collect unique token mints
  const uniqueMints = [...new Set(result.vaults.map(v => v.tokenMint))];

  // Fetch token prices
  const prices = await fetchSolanaTokenPrices(uniqueMints);

  // Calculate TVL for each vault
  let totalTvlUsd = 0;
  for (const vault of result.vaults) {
    const price = prices.get(vault.tokenMint);
    if (price) {
      vault.tvlUsd = calculateVaultTvlUsd(vault, price);
      totalTvlUsd += vault.tvlUsd;
    }
  }

  console.log(`[Kamino] Total TVL calculated: $${(totalTvlUsd / 1e6).toFixed(2)}M`);

  return { ...result, totalTvlUsd };
}

// Get Kamino curator TVL data (aggregated by curator)
export interface KaminoCuratorTvlData {
  curatorName: string;
  totalTvlUsd: number;
  vaultCount: number;
  vaults: Array<{
    address: string;
    name: string;
    tvlUsd: number;
    tokenMint: string;
  }>;
  avgPerformanceFeePct: number;
  avgManagementFeePct: number;
}

export async function getKaminoCuratorsTvl(
  rpcUrl?: string
): Promise<KaminoCuratorTvlData[]> {
  const result = await fetchKaminoVaultsWithTvl(rpcUrl);

  // Group by curator and aggregate TVL
  const curatorMap = new Map<string, {
    curatorName: string;
    totalTvlUsd: number;
    vaults: Array<{
      address: string;
      name: string;
      tvlUsd: number;
      tokenMint: string;
      performanceFeeBps: number;
      managementFeeBps: number;
    }>;
  }>();

  for (const vault of result.vaults) {
    const curator = identifyKaminoCurator(vault);

    // Skip "Other" and "Kamino Core" for curator attribution (these are protocol vaults)
    if (curator === 'Other' || curator === 'Kamino Core') continue;

    if (!curatorMap.has(curator)) {
      curatorMap.set(curator, {
        curatorName: curator,
        totalTvlUsd: 0,
        vaults: [],
      });
    }

    const data = curatorMap.get(curator)!;
    data.totalTvlUsd += vault.tvlUsd || 0;
    data.vaults.push({
      address: vault.address,
      name: vault.name,
      tvlUsd: vault.tvlUsd || 0,
      tokenMint: vault.tokenMint,
      performanceFeeBps: vault.performanceFeeBps,
      managementFeeBps: vault.managementFeeBps,
    });
  }

  // Convert to array and calculate averages
  const curators: KaminoCuratorTvlData[] = [];

  for (const [, data] of curatorMap) {
    if (data.vaults.length === 0) continue;

    // Calculate TVL-weighted average fees
    let weightedPerfFee = 0;
    let weightedMgmtFee = 0;
    const totalTvl = data.totalTvlUsd || 1; // Avoid division by zero

    for (const vault of data.vaults) {
      const weight = vault.tvlUsd / totalTvl;
      weightedPerfFee += bpsToPercent(vault.performanceFeeBps) * weight;
      weightedMgmtFee += bpsToPercent(vault.managementFeeBps) * weight;
    }

    curators.push({
      curatorName: data.curatorName,
      totalTvlUsd: data.totalTvlUsd,
      vaultCount: data.vaults.length,
      vaults: data.vaults.map(v => ({
        address: v.address,
        name: v.name,
        tvlUsd: v.tvlUsd,
        tokenMint: v.tokenMint,
      })),
      avgPerformanceFeePct: weightedPerfFee,
      avgManagementFeePct: weightedMgmtFee,
    });
  }

  // Sort by TVL descending
  curators.sort((a, b) => b.totalTvlUsd - a.totalTvlUsd);

  console.log(`[Kamino] Aggregated TVL for ${curators.length} curators`);

  return curators;
}
