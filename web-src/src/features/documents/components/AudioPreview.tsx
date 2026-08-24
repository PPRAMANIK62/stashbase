import { useEffect, useMemo, useRef, useState } from 'react';
import {
  audioPreviewAssetUrl,
  versionedAssetUrl,
} from '@/common/api/api';
import {
  audioPreviewProgressCopy,
  audioTranscriptStatusCopy,
  findAudioSeekSegment,
} from '@/features/documents/lib/audioTranscript.ts';
import { AudioPlaybackPosition } from '@/features/documents/lib/audioPlayback.ts';
import { basename } from '@/common/lib/paths';
import { useAppActions, useWorkspace } from '@/store/contexts/AppContext';
import { EmptyState } from '@/common/components/ui/empty-state';
import { openSettings } from '@/common/lib/settingsTrigger';
import { TRANSCRIPTION_LANGUAGE_OPTIONS } from '@shared/transcription';
import { useAudioFallbackController } from '@/features/documents/hooks/useAudioFallbackController.ts';
import { useAudioTranscriptController } from '@/features/documents/hooks/useAudioTranscriptController.ts';
import { Button } from '@/common/components/ui/button';
import { SectionHeading } from '@/common/components/ui/section';
import { Select, type SelectOption } from '@/common/components/ui/select';
import { StatusMessage } from '@/common/components/ui/status';
import { cn } from '@/common/lib/utils';

/* The Reprocess picker's own list: the shared language table plus a
 * leading "inherit" row. `''` is the absence of an override, which is what
 * `retryLanguage` already stores — the row makes that state selectable
 * rather than only reachable by never having chosen. */
const RETRY_LANGUAGES: readonly SelectOption<string>[] = [
  { value: '', label: 'Use Settings default' },
  ...TRANSCRIPTION_LANGUAGE_OPTIONS,
];

export function AudioPreview({ name }: { name: string }) {
  const state = useWorkspace();
  const { activeTab } = state;
  const { actions } = useAppActions();
  const version = activeTab?.file?.name === name ? activeTab.file.version ?? '' : '';
  // Out-of-folder tab: every URL and prepare/transcript request must carry
  // the file's own member folder instead of the window's.
  const sourceFolder = activeTab?.file?.name === name ? activeTab.file.folder : undefined;
  const requestFolder = sourceFolder ?? state.folderPath;
  const directSrc = useMemo(() => versionedAssetUrl(name, version, sourceFolder), [name, version, sourceFolder]);
  const fallbackSrc = useMemo(() => audioPreviewAssetUrl(name, version, sourceFolder), [name, version, sourceFolder]);
  const [positionMs, setPositionMs] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackPositionRef = useRef(new AudioPlaybackPosition());
  const fallback = useAudioFallbackController({
    name,
    folder: requestFolder,
    directSrc,
    fallbackSrc,
  });
  const transcription = useAudioTranscriptController({
    name,
    folder: requestFolder,
    version,
    conversionRevision: state.conversionRevision,
  });

  useEffect(() => {
    setPositionMs(0);
    playbackPositionRef.current.setSourceIdentity(JSON.stringify([requestFolder, name, version]));
  }, [name, requestFolder, version]);

  useEffect(() => {
    const highlight = activeTab?.pendingHighlight;
    const transcript = transcription.state?.status === 'ready' ? transcription.state.transcript : null;
    if (!highlight || !transcript) return;
    const segment = findAudioSeekSegment(
      highlight.audioSeekText ?? highlight.chunkText,
      transcript.segments,
      highlight.audioSeekMs,
    );
    if (segment && audioRef.current) {
      playbackPositionRef.current.remember(segment.startMs);
      playbackPositionRef.current.apply(audioRef.current);
      setPositionMs(segment.startMs);
      actions.consumePendingHighlight();
    }
  }, [actions, activeTab?.pendingHighlight, transcription.state]);

  function seek(startMs: number) {
    const audio = audioRef.current;
    if (!audio) return;
    playbackPositionRef.current.remember(startMs);
    playbackPositionRef.current.apply(audio);
    setPositionMs(startMs);
    void audio.play().catch(() => undefined);
  }

  const statusCopy = audioTranscriptStatusCopy(transcription.state);
  const fallbackProgressCopy = audioPreviewProgressCopy(fallback.progress);
  const transcript = transcription.state?.status === 'ready' ? transcription.state.transcript : null;

  return (
    <div className="grid h-full w-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-pane">
      <div className="border-b border-border bg-card px-6 pt-5 pb-4">
        <SectionHeading className="mb-2.5 truncate">{basename(name)}</SectionHeading>
        <audio
          key={`${state.folderPath}:${fallback.playbackSrc}`}
          ref={audioRef}
          className="block w-measure-lg"
          controls
          preload="metadata"
          src={fallback.playbackSrc}
          onLoadedMetadata={(event) => playbackPositionRef.current.apply(event.currentTarget)}
          onTimeUpdate={(event) => {
            const nextPositionMs = Math.round(event.currentTarget.currentTime * 1000);
            playbackPositionRef.current.remember(nextPositionMs);
            setPositionMs(nextPositionMs);
          }}
          onError={fallback.markUnplayable}
        />
        {fallback.preparing && (
          <div className={HINT_CLASS}>
            <span>{fallbackProgressCopy}</span>
            {fallback.progress?.status === 'converting' && fallback.progress.totalMs > 0 && (
              /* The app progress recipe (6px capsule, muted track, accent
               * fill — see AgentRuntimeProgress) expressed on the native
               * element: appearance-none lets the webkit pseudo-elements
               * take the track/fill roles; accent-accent stays as the
               * fallback should appearance ever revert to native. */
              <progress
                className="h-1.5 w-measure-xs appearance-none overflow-hidden rounded-full accent-accent [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-accent"
                max={100}
                value={fallback.progress.percent}
                aria-label="Compatible audio preview progress"
              />
            )}
            <Button variant="outline" size="xs" onClick={fallback.cancel}>Cancel</Button>
          </div>
        )}
        {fallback.usingFallback && !fallback.preparing && !fallback.error && (
          <div className={HINT_CLASS}>Using a browser-compatible local preview.</div>
        )}
        {fallback.error && (
          <div className={cn(HINT_CLASS, 'text-destructive')}>
            <span>{fallback.error}</span>
            <Button variant="outline" size="xs" onClick={() => { void fallback.prepare(); }}>Retry</Button>
          </div>
        )}
      </div>

      <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden px-6 pt-4 pb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <SectionHeading level={3} className="inline">Transcript</SectionHeading>
            {transcript && (
              <span className="ml-2.5 text-xs text-muted-foreground">
                {transcript.language} · {transcript.provider.model} · {formatTimestamp(transcript.source.durationMs)}
              </span>
            )}
          </div>
          {(transcription.state?.status === 'ready' || transcription.state?.status === 'failed' || transcription.state?.status === 'cancelled') && (
            <div className="flex items-center gap-1.5">
              <Select
                aria-label="Transcript language"
                items={RETRY_LANGUAGES}
                value={transcription.retryLanguage}
                onValueChange={(language) => transcription.setRetryLanguage(language)}
                disabled={transcription.retryBusy}
              />
              <Button variant="outline" size="sm" disabled={transcription.retryBusy} onClick={() => { void transcription.reprocess(); }}>
                {transcription.retryBusy ? 'Starting…' : 'Reprocess'}
              </Button>
            </div>
          )}
          {transcription.state?.status === 'pending' && (
            <Button variant="outline" size="sm" disabled={transcription.cancelBusy} onClick={() => { void transcription.cancel(); }}>
              {transcription.cancelBusy ? 'Cancelling…' : 'Cancel'}
            </Button>
          )}
        </div>

        {transcription.error && (
          <StatusMessage tone="error" className={TRANSCRIPT_STATE_CLASS}>{transcription.error}</StatusMessage>
        )}
        {!transcription.error && statusCopy && (
          <StatusMessage
            tone={transcription.state?.status === 'failed' ? 'error' : 'info'}
            role="status"
            aria-live="polite"
            className={TRANSCRIPT_STATE_CLASS}
          >
            <span>{statusCopy}</span>
            {transcription.state?.status === 'blocked' && (
              <Button variant="outline" size="sm" onClick={() => openSettings('transcription')}>Open Settings</Button>
            )}
          </StatusMessage>
        )}
        {transcript && transcript.segments.length === 0 && (
          <EmptyState className="row-start-3">No speech was detected.</EmptyState>
        )}
        {transcript && transcript.segments.length > 0 && (
          <ul className="row-start-3 m-0 grid min-h-0 list-none content-start gap-0.5 overflow-auto p-0">
            {transcript.segments.map((segment) => (
              <li key={segment.id}>
                <Button
                  variant="ghost"
                  className={cn(
                    /* A two-column transcript row, not a label you hit: it
                     * takes the ghost tint and the press feedback from the
                     * primitive, then re-decides display, height, and wrap
                     * because the segment text runs to several lines.
                     * `text-base` restores the ambient UI size the row had
                     * before (the Button recipe's own step is text-sm). */
                    'grid h-auto w-full cursor-pointer grid-cols-[68px_minmax(0,1fr)] items-start gap-3 py-2 text-left text-base font-normal whitespace-normal text-foreground',
                    /* Playing reads from the surface like selection — the
                     * neutral active wash, not an accent tint; the timestamp
                     * column already carries the accent moment, and it holds
                     * under the pointer so hovering the playing row does not
                     * demote it to the plain hover tint. */
                    positionMs >= segment.startMs && positionMs < segment.endMs && 'bg-active hover:bg-active',
                  )}
                  onClick={() => seek(segment.startMs)}
                >
                  <span className="text-sm text-accent tabular-nums">{formatTimestamp(segment.startMs)}</span>
                  <span className="leading-snug">{segment.text}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* Two one-surface layout recipes for THIS preview, named so the three
 * hint lines and the two transcript state rows cannot drift apart from
 * each other. Neither is a component: the hint is a bare line of muted
 * text under the player (once tinted `text-destructive` for the fallback
 * warning), and the transcript row is a className handed to
 * `StatusMessage`, which already owns the element. */
const HINT_CLASS = 'mt-1.5 flex items-center gap-2 text-xs text-muted-foreground';
const TRANSCRIPT_STATE_CLASS = 'flex items-center justify-between gap-3 px-3 py-2.5';

function formatTimestamp(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${hours > 0 ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
