import { type ReactNode } from 'react';

/**
 * Shared backdrop + card wrapper for every modal in the app. Click on
 * the backdrop dismisses; click on the card itself doesn't (we
 * `stopPropagation` so users can highlight text / press buttons without
 * accidentally closing). `wide` opts into the larger card style used
 * by the re-embed confirmation (which has cost stats to lay out).
 *
 * Each modal still owns its own header / body / buttons — this only
 * collapses the otherwise-identical outer two divs that used to live
 * in `EmbedderControl` (×3) and `CascadePromptModal`.
 */
export function ModalShell({
  onCancel,
  wide,
  children,
}: {
  onCancel: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="modal-veil" onClick={onCancel}>
      <div
        className={'modal-card' + (wide ? ' wide' : '')}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
