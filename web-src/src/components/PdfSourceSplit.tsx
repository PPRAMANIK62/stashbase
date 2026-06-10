import { useEffect, useMemo, useState } from 'react';
import { api, errorMessage, type FileBody } from '../api';
import { useApp } from '../store/AppContext';
import { MarkdownPreview } from './MarkdownPreview';
import { PdfPreview, pdfConversionFailureMessage } from './PdfPreview';

function dirname(name: string): string {
  const idx = name.lastIndexOf('/');
  return idx >= 0 ? name.slice(0, idx) : '';
}

function basename(name: string): string {
  const idx = name.lastIndexOf('/');
  return idx >= 0 ? name.slice(idx + 1) : name;
}

function join(dir: string, leaf: string): string {
  return dir ? `${dir}/${leaf}` : leaf;
}

function derivedMarkdownCandidates(pdfName: string): string[] {
  const dir = dirname(pdfName);
  const base = basename(pdfName);
  const primary = join(dir, `.${base}.md`);
  const legacyStem = base.replace(/\.pdf$/i, '');
  const legacy = join(dir, `.${legacyStem}.md`);
  return primary === legacy ? [primary] : [primary, legacy];
}

export function PdfSourceSplit({ name }: { name: string }) {
  const { state } = useApp();
  const candidates = useMemo(() => derivedMarkdownCandidates(name), [name]);
  const [derived, setDerived] = useState<FileBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryStarted, setRetryStarted] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const failure = state.conversionFailures.find((f) => f.path === name);
  const serverConverting = state.pendingConversions.includes(name);
  const retryInProgress = retryBusy || retryStarted;
  const converting = serverConverting || retryInProgress;
  const failureMessage = failure ? pdfConversionFailureMessage(failure.lastError) : '';

  useEffect(() => {
    let cancelled = false;
    setDerived(null);
    setLoading(true);
    setError(null);
    void (async () => {
      let lastError: unknown = null;
      for (const candidate of candidates) {
        try {
          const body = await api.getFile(candidate);
          if (!cancelled) {
            setDerived(body);
            setError(null);
          }
          return;
        } catch (err) {
          lastError = err;
        }
      }
      if (!cancelled) {
        setError(lastError ? errorMessage(lastError) : 'not found');
      }
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [candidates, converting, failure?.attempts, failure?.lastError, refreshKey]);

  useEffect(() => {
    if (!failure || serverConverting) setRetryStarted(false);
  }, [failure, serverConverting]);

  async function onRetry() {
    setRetryBusy(true);
    setRetryError(null);
    try {
      await api.retryConversion(name);
      setRetryStarted(true);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setRetryError(errorMessage(err));
      setRetryStarted(false);
    } finally {
      setRetryBusy(false);
    }
  }

  return (
    <div className="pdf-source-split">
      {failure && (
        <div className="pdf-failure-banner" role="status">
          <span className="pdf-failure-text">
            PDF text extraction failed{failureMessage ? `: ${failureMessage}` : ''}. The original
            PDF still opens normally.
            {retryError ? ` (${retryError})` : ''}
          </span>
          <button
            type="button"
            className="pdf-failure-retry"
            disabled={retryInProgress}
            onClick={() => { void onRetry(); }}
          >
            {retryInProgress ? 'Retrying…' : 'Retry conversion'}
          </button>
        </div>
      )}
      <div className="pdf-derived-pane">
        {derived ? (
          <MarkdownPreview name={derived.name} content={derived.content} />
        ) : (
          <div className="pdf-derived-empty" role="status">
            <strong>
              {loading
                ? 'Loading extracted text…'
                : converting
                  ? 'Extracting PDF text…'
                  : 'Extracted markdown is not available'}
            </strong>
            {!loading && (
              <span>
                {failure
                  ? 'Text extraction failed. Use Retry conversion above to rebuild the derived markdown.'
                  : converting
                    ? 'The derived markdown will appear here when conversion finishes.'
                    : `${error ? ` ${error}.` : ''} The PDF may still be converting, or text extraction may need to be retried.`}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="pdf-source-divider" aria-hidden="true" />
      <div className="pdf-original-pane">
        <PdfPreview name={name} showConversionBanner={false} />
      </div>
    </div>
  );
}
