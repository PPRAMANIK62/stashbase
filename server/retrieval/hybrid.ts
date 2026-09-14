import { filesystemPath } from '../filesystem-path.ts';
import type { SearchHit } from '../indexer.ts';
import { remapSearchHitsForDisplay } from '../search-display.ts';
import type { SourceEvidence } from './evidence.ts';

export function hybridEvidence(hits: SearchHit[], displayBase: string): SourceEvidence[] {
  // The daemon returns absolute paths. The display remapper expects GUI-style
  // paths relative to its base so it can resolve legacy derived notes back to
  // their visible source.
  const scopedHits = hits.flatMap((hit) => {
    const relative = filesystemPath.relative(displayBase, hit.fileName);
    return relative == null ? [] : [{ ...hit, fileName: relative }];
  });
  const visible = remapSearchHitsForDisplay(scopedHits, displayBase);
  return visible.map((hit) => ({
    sourcePath: filesystemPath.absolute(hit.fileName, displayBase),
    snippet: hit.content,
    heading: hit.heading,
    locator: {
      ...(hit.startLine == null ? {} : { line: hit.startLine }),
      ...(hit.endLine == null ? {} : { endLine: hit.endLine }),
      ...(hit.pdfPage == null ? {} : { page: hit.pdfPage }),
    },
    score: hit.score,
    chunkIndex: hit.chunkIndex,
  }));
}
