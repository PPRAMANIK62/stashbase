import { isAudioTranscriptTextUnavailable } from '../audio-transcription.ts';
import { isConversionTextUnavailable } from '../conversion.ts';
import { filesystemPath } from '../filesystem-path.ts';
import type { SearchHit } from '../indexer.ts';
import { remapSearchHitsForDisplay } from '../search-display.ts';
import type { SourceEvidence } from './evidence.ts';

export function semanticEvidence(hits: SearchHit[], displayBase = ''): SourceEvidence[] {
  // Availability is keyed by absolute source spelling. Check it before
  // converting scoped hits to GUI-relative paths for display remapping.
  const availableHits = hits.filter(
    (hit) => !isConversionTextUnavailable(hit.fileName) && !isAudioTranscriptTextUnavailable(hit.fileName),
  );
  // The daemon returns absolute paths. The display remapper expects GUI-style
  // paths relative to its base so it can resolve legacy derived notes back to
  // their visible source; preserve absolute paths only for library-wide MCP
  // search, which deliberately has no common base.
  const scopedHits = displayBase
    ? availableHits.flatMap((hit) => {
        const relative = filesystemPath.relative(displayBase, hit.fileName);
        return relative == null ? [] : [{ ...hit, fileName: relative }];
      })
    : availableHits;
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
