# Semantic Retrieval Evaluation

This credentialed AI Eval measures J05 meaning-based ranking quality separately
from deterministic retrieval correctness. Run it from the repository root:

```bash
pnpm eval:semantic-retrieval
```

The command uses the OpenAI or OpenRouter key already saved in **StashBase
Settings > AI Index**. It does not read credentials from environment variables,
launch Electron, touch the user's library, or reuse the product vector store.
It creates an isolated temporary library and store, indexes the versioned
fixtures through `MfsIndexer`, and searches through the production Retrieval
Interface. The temporary data is removed after the run.

## Dataset and scoring

`v1/dataset.json` owns the dataset version, corpus manifest, natural-language
queries, relevance judgments, `K`, thresholds, and baseline records. Its 20
synthetic documents contain no user data. Eighteen paraphrased judgments cover
multiple intents for direct Markdown, HTML, JSON, and PDF source identity backed
by prepared Markdown evidence. Similar Search is evaluated at K=3 so plausible
distractors materially affect both retrieval and rank.

The report names the dataset schema/version, provider, model, Recall@K, and
mean reciprocal rank (MRR). Each query prints its acceptable source set,
ordered Similar Search results, and—where a deliberately paraphrased query
makes the contrast useful—Exact Search results. Misses therefore show both the
expected evidence and unexpected top results.

Version 1's proposed aggregate thresholds are:

- Recall@3 >= 0.90
- MRR >= 0.80

Provider responses and ranking can vary slightly, so the gate uses aggregate
thresholds rather than requiring a fixed order or a perfect score. Change the
dataset version whenever corpus meaning or relevance judgments change. A
threshold change requires review with the result that motivated it; do not
lower a threshold merely to accept a regression.

The command reports `CALIBRATION` and does not fail on quality thresholds until
the dataset contains at least three retained baseline runs for each supported
BYOK path, OpenAI and OpenRouter. This prevents unobserved target numbers from
silently becoming a release gate. For calibration, select one provider in
Settings, run the command three times, retain each complete report with the PR
or release evidence, then add its provider, exact model, date, unique evidence
reference, Recall@3, and MRR to `baselineRuns`. Repeat for the other provider.
Review the collected distributions before activating or changing thresholds.
The dataset parser rejects duplicate run IDs, unknown providers, invalid
metrics, and malformed dates. Baseline records must never contain credentials.

## Execution placement

This evaluation is a credentialed release check, not required source CI or
scheduled CI. It makes paid external embedding requests and depends on a
locally authorized BYOK provider, while required CI must remain credential-free
and deterministic. Run it when retrieval ranking, chunking, embedding model, or
provider behavior changes and record the complete report with the release or
review evidence. While the report says `CALIBRATION`, retain it as baseline
evidence but do not claim a passing semantic-quality gate.
