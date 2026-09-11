/**
 * Audio and video playback beside its synchronized transcript.
 *
 * The transcript is also published as a real WebVTT captions track, so the
 * player carries captions itself rather than relying on the list beside it.
 */
import { RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import { documentFailure, MEDIA_MESSAGES } from '@/features/documents/application/failure-messages';
import type { DocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import type { MediaPort, MediaDocumentAsset } from '@/features/documents/application/ports';
import {
  formatMediaTime,
  mediaKind,
  mediaPreviewStatusCopy,
  mediaTranscriptStatusCopy,
  mediaTranscriptVtt,
  type MediaTranscript,
  type MediaTranscriptSegment,
  type MediaTranscriptState,
} from '@/features/documents/domain/media';
import { useShape } from '@/lib/shape-context';
import { cn } from '@/lib/utils';

import { createMediaFindController } from './find-controller';
import { useMediaFallback } from './use-media-fallback';
import { useMediaTranscript } from './use-media-transcript';

/** A blob-backed WebVTT track for the loaded transcript. Always present, so
 *  the player exposes a captions track even before speech is recognised. */
function useCaptionsUrl(transcript: MediaTranscript | null): string {
  const vtt = useMemo(() => mediaTranscriptVtt(transcript), [transcript]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
    setUrl(objectUrl);
    return () => {
      setUrl(null);
      URL.revokeObjectURL(objectUrl);
    };
  }, [vtt]);
  return url ?? `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}`;
}

function TranscriptState({
  action,
  actionError,
  onCancel,
  onRetry,
  state,
}: {
  action: 'cancel' | 'retry' | null;
  actionError: string | null;
  onCancel(): void;
  onRetry(): void;
  state: MediaTranscriptState;
}) {
  const copy = mediaTranscriptStatusCopy(state);
  if (!copy) return null;
  const canCancel = state.status === 'pending';
  const canRetry = state.status === 'cancelled' || state.status === 'failed';
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8 text-center">
      <div className="max-w-sm">
        <p className="text-caption text-muted-foreground" role="status">
          {copy}
        </p>
        {(canCancel || canRetry) && (
          <Button
            className="mt-3"
            leadingIcon={canCancel ? X : RefreshCw}
            loading={action !== null}
            onClick={canCancel ? onCancel : onRetry}
            size="compact"
            variant="tertiary"
          >
            {canCancel ? 'Cancel' : 'Retry'}
          </Button>
        )}
        {actionError && (
          <p className="mt-2 text-caption text-destructive" role="alert">
            {actionError}
          </p>
        )}
      </div>
    </div>
  );
}

function TranscriptRows({
  currentId,
  findId,
  onSeek,
  segments,
}: {
  currentId: number | null;
  findId: number | null;
  onSeek(segment: MediaTranscriptSegment): void;
  segments: MediaTranscriptSegment[];
}) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName="px-2 py-2">
      <ol aria-label="Timestamped transcript" className="m-0 list-none p-0">
        {segments.map((segment) => {
          const current = segment.id === currentId;
          const found = segment.id === findId;
          return (
            <li key={segment.id}>
              <Button
                aria-current={current || undefined}
                className={cn(
                  'h-auto w-full px-2 py-2 text-left [&>span:last-child]:w-full',
                  (current || found) && 'bg-hover text-foreground',
                )}
                onClick={() => onSeek(segment)}
                data-media-segment={segment.id}
                size="compact"
                variant="ghost"
              >
                <span className="grid w-full grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3">
                  <span className="pt-px font-mono text-caption text-muted-foreground tabular-nums">
                    {formatMediaTime(segment.startMs)}
                  </span>
                  <span className="text-body leading-relaxed text-foreground">{segment.text}</span>
                </span>
              </Button>
            </li>
          );
        })}
      </ol>
    </ScrollArea>
  );
}

export function MediaDocument({
  active,
  api,
  name,
  navigation,
  resource,
  runtime,
}: {
  active: boolean;
  api: MediaPort;
  name: string;
  navigation: DocumentNavigationRuntime;
  resource: MediaDocumentAsset;
  runtime: DocumentRuntime;
}) {
  const kind = mediaKind(runtime.scope.source.path);
  const shape = useShape();
  const fallback = useMediaFallback(api, resource, runtime);
  const transcript = useMediaTranscript(active, api, runtime, resource.version);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const ownerRef = useRef(Symbol(runtime.scope.id));
  const positionRef = useRef(0);
  const transcriptRef = useRef<HTMLElement | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [findSegmentId, setFindSegmentId] = useState<number | null>(null);
  const readyTranscript =
    transcript.query.data?.status === 'ready' ? transcript.query.data.transcript : null;
  const captionsUrl = useCaptionsUrl(readyTranscript);
  const currentSegmentId = useMemo(
    () =>
      readyTranscript?.segments.find(
        (segment) => positionMs >= segment.startMs && positionMs < segment.endMs,
      )?.id ?? null,
    [positionMs, readyTranscript],
  );

  const seek = useCallback((segment: MediaTranscriptSegment, play = false) => {
    positionRef.current = segment.startMs;
    setPositionMs(segment.startMs);
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = segment.startMs / 1000;
    // swallowed: a browser that refuses autoplay leaves the reader the controls.
    if (play) void media.play().catch(() => undefined);
  }, []);

  const assignMedia = useCallback(
    (element: HTMLMediaElement | null) => {
      if (!element) return;
      element.setAttribute('src', fallback.playbackUrl);
      mediaRef.current = element;
      return () => {
        if (mediaRef.current === element) mediaRef.current = null;
        element.pause();
        element.removeAttribute('src');
        element.load();
      };
    },
    [fallback.playbackUrl],
  );

  useEffect(() => {
    if (!active) mediaRef.current?.pause();
  }, [active]);

  useEffect(() => {
    if (!active || !readyTranscript) return;
    const controller = createMediaFindController(readyTranscript.segments, (segment) => {
      setFindSegmentId(segment?.id ?? null);
      if (segment) seek(segment);
    });
    const release = navigation.claimFind(runtime.scope.id, ownerRef.current, controller);
    return () => {
      release();
      controller.close();
    };
  }, [active, navigation, readyTranscript, runtime.scope.id, seek]);

  useEffect(() => {
    if (findSegmentId === null) return;
    transcriptRef.current
      ?.querySelector<HTMLElement>(`[data-media-segment="${findSegmentId}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [findSegmentId]);

  const loadedMetadata = (event: SyntheticEvent<HTMLMediaElement>) => {
    event.currentTarget.currentTime = positionRef.current / 1000;
  };
  const updateTime = (event: SyntheticEvent<HTMLMediaElement>) => {
    const next = Math.round(event.currentTarget.currentTime * 1000);
    positionRef.current = next;
    setPositionMs(next);
  };
  const videoLayout = kind === 'video';
  const showVideo = videoLayout && !fallback.usingFallback;

  return (
    <div
      className={cn(
        'grid min-h-0 flex-1 bg-surface-2',
        videoLayout
          ? 'grid-rows-[minmax(10rem,3fr)_minmax(8rem,2fr)]'
          : 'grid-rows-[auto_minmax(0,1fr)]',
      )}
    >
      <section
        aria-label="Media playback"
        className="flex min-h-0 items-center justify-center border-b border-border p-5"
      >
        <div
          className={cn(
            'flex max-h-full w-full max-w-3xl flex-col items-center justify-center gap-3 overflow-hidden border border-border bg-surface-3 p-3 shadow-surface-2',
            shape.container,
            videoLayout && 'h-full',
          )}
        >
          {fallback.preparing ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
              <p className="text-caption text-muted-foreground">
                {mediaPreviewStatusCopy(fallback.status)}
              </p>
              <Button onClick={fallback.cancel} size="compact" variant="tertiary">
                Cancel
              </Button>
            </div>
          ) : fallback.error ? (
            <div className="py-6 text-center">
              <p className="text-caption text-muted-foreground" role="alert">
                {fallback.error}
              </p>
              <Button
                className="mt-3"
                leadingIcon={RefreshCw}
                onClick={() => void fallback.prepare()}
                size="compact"
                variant="tertiary"
              >
                Retry
              </Button>
            </div>
          ) : showVideo ? (
            <video
              aria-label={`${name} playback`}
              className="block max-h-full max-w-full"
              controls
              onError={fallback.markUnplayable}
              onLoadedMetadata={loadedMetadata}
              onTimeUpdate={updateTime}
              preload="metadata"
              ref={assignMedia}
            >
              <track default kind="captions" label="Transcript" src={captionsUrl} />
            </video>
          ) : (
            <>
              <audio
                aria-label={`${name} playback`}
                className="block w-full max-w-2xl"
                controls
                onError={fallback.markUnplayable}
                onLoadedMetadata={loadedMetadata}
                onTimeUpdate={updateTime}
                preload="metadata"
                ref={assignMedia}
              >
                <track default kind="captions" label="Transcript" src={captionsUrl} />
              </audio>
              {kind === 'video' && fallback.usingFallback && (
                <p className="text-caption text-muted-foreground">
                  Video playback is unavailable. Playing its audio track instead.
                </p>
              )}
              {fallback.usingFallback && kind === 'audio' && (
                <p className="text-caption text-muted-foreground">
                  Using a compatible local preview.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section
        aria-label="Transcript"
        className="flex min-h-0 flex-col bg-surface-1"
        ref={transcriptRef}
      >
        <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
          <h2 className="text-body font-medium">Transcript</h2>
          {readyTranscript && (
            <p className="truncate text-caption text-muted-foreground">
              {readyTranscript.language} · {readyTranscript.model} ·{' '}
              {formatMediaTime(readyTranscript.durationMs)}
            </p>
          )}
        </header>
        {transcript.query.isPending ? (
          <div
            className="flex min-h-0 flex-1 items-center justify-center text-caption text-muted-foreground"
            role="status"
          >
            Loading transcript…
          </div>
        ) : transcript.query.isError || !transcript.query.data ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8 text-center">
            <div>
              <p className="text-caption text-muted-foreground" role="alert">
                {documentFailure(transcript.query.error, 'MediaError', MEDIA_MESSAGES).message}
              </p>
              <Button
                className="mt-3"
                leadingIcon={RefreshCw}
                onClick={() => void transcript.query.refetch()}
                size="compact"
                variant="tertiary"
              >
                Retry
              </Button>
            </div>
          </div>
        ) : readyTranscript ? (
          readyTranscript.segments.length === 0 ? (
            <div
              className="flex min-h-0 flex-1 items-center justify-center text-caption text-muted-foreground"
              role="status"
            >
              No speech was detected.
            </div>
          ) : (
            <TranscriptRows
              currentId={currentSegmentId}
              findId={findSegmentId}
              onSeek={(segment) => seek(segment, true)}
              segments={readyTranscript.segments}
            />
          )
        ) : (
          <TranscriptState
            action={transcript.action}
            actionError={transcript.actionError}
            onCancel={() => void transcript.cancel()}
            onRetry={() => void transcript.retry()}
            state={transcript.query.data}
          />
        )}
      </section>
    </div>
  );
}
