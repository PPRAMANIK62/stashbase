import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { shapeTokens } from '@/lib/shape-context';
import { textFieldClass } from '@/shared/ui/text-field';

const FIELD_CLASS = textFieldClass(
  'resize-y bg-background font-mono text-caption text-foreground',
  shapeTokens.input,
);

export interface RevisionPreviewProps {
  onStart(proposal: string): void;
  refusal: string | null;
}

/** Development controls that open a revision review on the document in front
 *  of the reader, standing in for an agent proposal. */
export function RevisionPreview({ onStart, refusal }: RevisionPreviewProps) {
  const id = useId();
  const [proposal, setProposal] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-muted-foreground">
        Paste a whole revised Markdown document. It opens as suggested changes on the document in
        front of you, for you to accept or reject.
      </p>
      <label className="text-caption" htmlFor={id}>
        Revised document
      </label>
      <textarea
        className={FIELD_CLASS}
        id={id}
        onChange={(event) => setProposal(event.target.value)}
        placeholder={'# Title\n\nThe revised opening line.\n'}
        rows={8}
        value={proposal}
      />
      {refusal && (
        <p className="text-caption text-destructive" role="alert">
          {refusal}
        </p>
      )}
      <Button
        className="self-start"
        disabled={proposal.trim().length === 0}
        onClick={() => onStart(proposal)}
        size="compact"
        variant="tertiary"
      >
        Start review
      </Button>
    </div>
  );
}
