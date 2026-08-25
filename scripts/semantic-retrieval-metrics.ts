export interface RankedQueryResult {
  id: string;
  query: string;
  relevant: readonly string[];
  /** Distinct source paths in rank order. Retrieval ranks CHUNKS, so the
   *  caller must collapse chunks to their source before scoring; otherwise
   *  one multi-chunk document silently consumes several of the K slots and
   *  Recall@K stops meaning "in the top K documents". */
  ranked: readonly string[];
  exactRanked?: readonly string[];
}

export interface ScoredQuery extends RankedQueryResult {
  relevantRetrieved: number;
  recallAtK: number;
  reciprocalRank: number;
  firstRelevantRank: number | null;
}

export function scoreRankedQueries(results: readonly RankedQueryResult[], topK: number): {
  queries: ScoredQuery[];
  recallAtK: number;
  meanReciprocalRank: number;
} {
  if (!Number.isInteger(topK) || topK < 1) throw new Error('topK must be a positive integer');
  if (results.length === 0) throw new Error('at least one query is required');

  const queries = results.map((result): ScoredQuery => {
    if (result.relevant.length === 0) throw new Error(`${result.id}: relevant must not be empty`);
    if (new Set(result.ranked).size !== result.ranked.length) {
      throw new Error(`${result.id}: ranked results must be collapsed to distinct sources before scoring`);
    }
    const relevant = new Set(result.relevant);
    const top = result.ranked.slice(0, topK);
    const relevantRetrieved = top.filter((source) => relevant.has(source)).length;
    const rankIndex = top.findIndex((source) => relevant.has(source));
    const firstRelevantRank = rankIndex < 0 ? null : rankIndex + 1;
    return {
      ...result,
      relevantRetrieved,
      recallAtK: relevantRetrieved / relevant.size,
      reciprocalRank: firstRelevantRank == null ? 0 : 1 / firstRelevantRank,
      firstRelevantRank,
    };
  });

  return {
    queries,
    recallAtK: queries.reduce((sum, query) => sum + query.recallAtK, 0) / queries.length,
    meanReciprocalRank: queries.reduce((sum, query) => sum + query.reciprocalRank, 0) / queries.length,
  };
}
