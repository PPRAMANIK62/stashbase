import { electronBridge, type DesktopUpdateSimulation } from '@/common/lib/electronBridge';
import { useGeneralSettings } from '@/features/settings/hooks/useGeneralSettings';
import { BugIcon, DiscordIcon } from '@/common/components/icons';
import { DISCORD_INVITE_URL, openExternalUrl } from '@/common/lib/externalLink';
import { Button } from '@/common/components/ui/button';
import { Checkbox } from '@/common/components/ui/checkbox';
import { Field, FieldDescription, FieldLabel } from '@/common/components/ui/field';
import { Select, type SelectOption } from '@/common/components/ui/select';
import { SectionDescription, SectionHeading } from '@/common/components/ui/section';
import { Badge } from '@/common/components/ui/badge';
import { cn } from '@/common/lib/utils';

/* The dev panel's simulated update states. One array feeds the trigger's
 * label and the popup's rows, so the two cannot disagree. */
const UPDATE_SIMULATIONS: readonly SelectOption<DesktopUpdateSimulation>[] = [
  { value: 'off', label: 'Off — real updater' },
  { value: 'available', label: 'Update available' },
  { value: 'downloading', label: 'Downloading — 42%' },
  { value: 'ready', label: 'Ready to install' },
  { value: 'installing', label: 'Installing' },
  { value: 'error', label: 'Update error' },
];

export function GeneralPanel() {
  const {
    capture: preferences,
    captureError: error,
    savingCapture: saving,
    setClipboardImageImport,
    updates: updatePreferences,
    updateError,
    savingUpdates,
    setAutomaticUpdateChecks,
    updateState,
    checkNow,
    runPrimaryAction,
    openDownloadPage,
    setSimulation,
  } = useGeneralSettings();

  function updateStatus() {
    if (!updateState) return 'Update status is available in the desktop app.';
    switch (updateState.phase) {
      case 'checking': return 'Checking for updates…';
      case 'current': return `StashBase ${updateState.currentVersion} is up to date.`;
      case 'available': return `StashBase ${updateState.availableVersion} is available.`;
      case 'downloading': return `Downloading StashBase ${updateState.availableVersion}${updateState.percent === undefined ? '…' : ` — ${updateState.percent}%`}`;
      case 'ready': return `StashBase ${updateState.availableVersion} is ready to install.`;
      case 'installing': return `Installing StashBase ${updateState.availableVersion} and restarting…`;
      case 'error': return updateState.message || 'The update check failed.';
      case 'unsupported': return updateState.message || 'Update checks are unavailable in this build.';
      default: return `Current version: ${updateState.currentVersion}`;
    }
  }

  if (!preferences) {
    return error
      ? <div className="text-sm text-destructive">Couldn’t load capture settings: {error}</div>
      : <div className="py-3 text-base text-muted-foreground">Loading…</div>;
  }

  return (
    <div>
      <SectionHeading level={3} className="mb-1">Knowledge capture</SectionHeading>
      <SectionDescription>
        Choose which ambient sources StashBase may notice. Nothing is added to a folder without confirmation.
      </SectionDescription>
      {/* `Field` + `FieldLabel htmlFor` + `FieldDescription`, not a label
        * wrapping both lines. The wrapping form did associate — the browser
        * binds the first labelable descendant at any depth — but it also
        * swept the explanatory sentence into the control's accessible name,
        * so the checkbox announced a paragraph. Split, the label names it
        * and `aria-describedby` carries the rest as description. */}
      <Field className="mt-5 flex-row items-start gap-2 text-sm text-foreground">
        <Checkbox
          id="clipboard-image-import"
          className="mt-0.5"
          aria-describedby="clipboard-image-import-description"
          checked={preferences.clipboardImageImport}
          disabled={saving}
          onCheckedChange={(checked) => { void setClipboardImageImport(checked); }}
        />
        <div className="min-w-0">
          <FieldLabel htmlFor="clipboard-image-import" className="cursor-pointer text-sm">
            Offer to add clipboard screenshots
          </FieldLabel>
          <FieldDescription id="clipboard-image-import-description" className="mt-0.5">
            While a StashBase window is focused, notice copied images and ask before adding one to the current folder for OCR and search.
          </FieldDescription>
        </div>
      </Field>
      {error && <div role="alert" className="mt-2.5 text-sm text-destructive">Couldn’t save capture settings: {error}</div>}

      <div className="mt-7 border-t border-border pt-6">
        <SectionHeading level={3} className="mb-1">Application updates</SectionHeading>
        <SectionDescription>
          StashBase verifies updates published through the official GitHub release channel. Clicking Update downloads, installs, and restarts the app after open edits are saved.
        </SectionDescription>
        {updatePreferences ? (
          <Field className="mt-5 flex-row items-start gap-2 text-sm text-foreground">
            <Checkbox
              id="automatic-update-checks"
              className="mt-0.5"
              aria-describedby="automatic-update-checks-description"
              checked={updatePreferences.autoCheck}
              disabled={savingUpdates}
              onCheckedChange={(checked) => { void setAutomaticUpdateChecks(checked); }}
            />
            <div className="min-w-0">
              <FieldLabel htmlFor="automatic-update-checks" className="cursor-pointer text-sm">
                Automatically check for updates
              </FieldLabel>
              <FieldDescription id="automatic-update-checks-description" className="mt-0.5">
                Check shortly after launch and periodically while StashBase is running. This is enabled by default.
              </FieldDescription>
            </div>
          </Field>
        ) : (
          <div className="mt-5 text-sm text-muted-foreground">Loading update preferences…</div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!electronBridge()?.checkForUpdates || updateState?.phase === 'checking' || updateState?.phase === 'downloading' || updateState?.phase === 'installing'}
            onClick={() => { void checkNow(); }}
          >
            {updateState?.phase === 'checking' ? 'Checking…' : 'Check for updates'}
          </Button>
          {updateState?.availableVersion && (
            <Button
              size="sm"
              disabled={updateState.phase === 'downloading' || updateState.phase === 'installing'}
              onClick={() => { void runPrimaryAction(); }}
            >
              {updateState.phase === 'ready'
                ? 'Install update'
                : updateState.phase === 'downloading'
                  ? `Downloading ${updateState.percent ?? 0}%`
                  : updateState.phase === 'installing'
                    ? 'Installing…'
                    : 'Update and restart'}
            </Button>
          )}
          {(updateState?.phase === 'error' || updateState?.phase === 'unsupported') && (
            <Button variant="ghost" size="sm" onClick={() => { void openDownloadPage(); }}>
              Open download page
            </Button>
          )}
        </div>
        {/* role="status": the line rewrites itself in place through
          * checking → downloading → ready/error, and every transition was
          * silent to a screen reader. Polite status covers the error phase
          * too — the failure is not urgent enough to interrupt. */}
        <div role="status" className={cn('mt-2.5 text-sm', updateState?.phase === 'error' || updateError ? 'text-destructive' : 'text-muted-foreground')}>
          {updateError || updateStatus()}
        </div>
        {updateState?.platform === 'linux' && (
          <div className="mt-1 text-xs leading-normal text-muted-foreground">
            Linux package installs may ask for administrator approval before StashBase can restart.
          </div>
        )}
        {updateState?.simulation?.enabled && (
          <section className="mt-5 rounded-lg border border-status-warning/30 bg-status-warning/10 p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <SectionHeading level={4}>Desktop update testing</SectionHeading>
              <Badge tone="warning">Development only</Badge>
            </div>
            <p className="mt-0 mb-3 text-sm leading-normal text-muted-foreground">
              Preview update states in Settings and the sidebar without contacting the release channel, downloading, or installing anything.
            </p>
            {/* Explicit `htmlFor`, not a wrapping label: the association is
              * then visible at both ends and survives the control moving
              * out of the label's subtree. */}
            <Field className="flex-row items-center justify-between gap-3">
              <FieldLabel htmlFor="desktop-update-simulation" className="text-sm font-normal">
                Simulated update state
              </FieldLabel>
              <Select
                id="desktop-update-simulation"
                className="min-w-48"
                items={UPDATE_SIMULATIONS}
                value={updateState.simulation.value}
                onValueChange={(simulation) => { void setSimulation(simulation); }}
              />
            </Field>
          </section>
        )}
      </div>

      {/* Community and support moved here from the sidebar footer: the
        * footer keeps identity + Settings only, and everything a user
        * reaches occasionally lives behind the one Settings entry. The
        * bug-report flow itself stays in the Electron main process, so
        * the browser dev shell disables the button rather than hiding
        * it. */}
      <div className="mt-7 border-t border-border pt-6">
        <SectionHeading level={3} className="mb-1">Community and support</SectionHeading>
        <SectionDescription>
          Get help, share feedback, or report a problem.
        </SectionDescription>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { openExternalUrl(DISCORD_INVITE_URL); }}>
            <DiscordIcon />
            Join the StashBase Discord
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!electronBridge()?.reportBug}
            title={electronBridge()?.reportBug ? undefined : 'Report a bug (desktop app only)'}
            onClick={() => { void electronBridge()?.reportBug?.(); }}
          >
            <BugIcon />
            Report a bug
          </Button>
        </div>
      </div>
    </div>
  );
}
