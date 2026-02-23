// Lightweight data source tracking for API route visibility
// Wraps Promise.all calls to log failures and report source health in _meta

export type DataSourceStatus = {
  name: string;
  status: 'ok' | 'error';
  error?: string;
  recordCount?: number;
  latencyMs: number;
};

export class DataSourceTracker {
  private sources: DataSourceStatus[] = [];

  /**
   * Track a data source promise. On success, records stats. On failure, logs warning and returns fallback.
   * The fallback value is returned (graceful degradation) but the failure is visible in getSummary().
   */
  async track<T>(name: string, promise: Promise<T>, fallback: T): Promise<T> {
    const start = Date.now();
    try {
      const result = await promise;
      const latencyMs = Date.now() - start;
      const recordCount = Array.isArray(result)
        ? result.length
        : result instanceof Map
          ? result.size
          : result != null
            ? 1
            : 0;
      this.sources.push({ name, status: 'ok', recordCount, latencyMs });
      return result;
    } catch (e) {
      const latencyMs = Date.now() - start;
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.warn(`[DataSource] ${name} FAILED (${latencyMs}ms): ${errorMsg}`);
      this.sources.push({ name, status: 'error', error: errorMsg, latencyMs });
      return fallback;
    }
  }

  getSummary(): {
    sources: DataSourceStatus[];
    failedCount: number;
    totalCount: number;
  } {
    return {
      sources: this.sources,
      failedCount: this.sources.filter((s) => s.status === 'error').length,
      totalCount: this.sources.length,
    };
  }
}
