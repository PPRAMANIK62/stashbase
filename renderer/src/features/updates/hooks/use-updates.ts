/**
 * What one surface sees of updating itself, and the one lane it acts on.
 *
 * The notice strip and the Settings row each hold their own copy of this, so
 * each has a lane of its own and shows only the refusal of what it asked for.
 * They agree about where the update has got to because main is the only thing
 * that decides that and pushes every transition to both. Neither of them owns
 * a subscription, and neither reads a phase to decide what a command means:
 * `run` takes the call.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { updateFailure } from '@/features/updates/application/failure-messages';
import type { UpdateResult, UpdatesPort } from '@/features/updates/application/ports';
import type { UpdateState } from '@/features/updates/domain/update-status';
import type { FailureView } from '@/shared/domain/feature-error';

/** A window with nothing behind it. The web build has no bridge at all, so an
 *  inert surface is the honest answer there rather than a loading one that
 *  would never resolve. */
const UNSUPPORTED: UpdateState = {
  autoCheckEnabled: false,
  currentVersion: '',
  status: { phase: 'unsupported' },
};

export interface UpdatesAccess {
  /** What the last command refused with, already read as sentence and tone. */
  readonly failure: FailureView | null;
  /** A command is open. */
  readonly running: boolean;
  readonly state: UpdateState;
  /** Starts one command, ignored while another is already open. */
  run(command: (port: UpdatesPort) => Promise<UpdateResult>): void;
}

export function useUpdates(port: UpdatesPort | null): UpdatesAccess {
  const [state, setState] = useState<UpdateState>(UNSUPPORTED);
  const [failure, setFailure] = useState<FailureView | null>(null);
  const [running, setRunning] = useState(false);
  const open = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!port) return;
    let pushed = false;
    // Subscribing before reading is what makes a transition during the read
    // arrive rather than fall between the two. It also makes the push the
    // newer answer, so it is not overwritten when the read lands after it.
    const unsubscribe = port.subscribe((next) => {
      pushed = true;
      if (mounted.current) setState(next);
    });
    void port.read().then((result) => {
      // A refused first read leaves the inert state standing. Nothing has been
      // asked for yet, so there is no refusal the reader could act on.
      if (mounted.current && !pushed && result.ok) setState(result.state);
    });
    return unsubscribe;
  }, [port]);

  const run = useCallback(
    (command: (port: UpdatesPort) => Promise<UpdateResult>) => {
      if (!port || open.current) return;
      open.current = true;
      setFailure(null);
      setRunning(true);
      void command(port).then((result) => {
        open.current = false;
        if (!mounted.current) return;
        setRunning(false);
        if (result.ok) setState(result.state);
        else setFailure(updateFailure(result.kind));
      });
    },
    [port],
  );

  return { failure, run, running, state };
}
