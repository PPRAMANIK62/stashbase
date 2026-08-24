/**
 * The user half of a turn: the sent message head with its attachments,
 * the collapsible message text (file mentions chipped back into place),
 * the copy/edit actions under the bubble, and the inline editor that
 * resends an edited prompt. Mention parsing is pure and lives in
 * `lib/mentionText`.
 */
import { cn } from '@/common/lib/utils';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/common/components/ui/button';
import { Textarea } from '@/common/components/ui/textarea';
import { ChevronDownIcon, CopyIcon, EditIcon } from '@/common/components/icons';
import { basename } from '@/common/lib/paths';
import { AttachmentChip, AttachmentLightbox } from '@/features/agent-panel/components/AttachmentChip';
import { segmentFileMentions } from '@/features/agent-panel/lib/mentionText';
import { turnHeadClass } from '@/features/agent-panel/lib/panelStyles';
import type { Attachment, Block } from '@/features/agent-panel/lib/types';

export function UserTurnHead({
  block, onCopy, onSendEdit,
}: {
  block: Extract<Block, { kind: 'user' }>;
  onCopy: (text: string) => void;
  onSendEdit: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.text);

  useEffect(() => {
    if (!editing) setDraft(block.text);
  }, [block.text, editing]);

  return (
    <>
      <div className={turnHeadClass}>
        {block.attachments && block.attachments.length > 0 && <MessageAttachments attachments={block.attachments} />}
        {editing ? (
          <InlineUserMessageEditor
            text={draft}
            saveLabel="Send"
            onChange={setDraft}
            onCancel={() => {
              setDraft(block.text);
              setEditing(false);
            }}
            onSave={() => {
              const text = draft.trim();
              if (!text) return;
              setEditing(false);
              onSendEdit(text);
            }}
          />
        ) : (
          block.text && (
            <UserMessageText
              text={block.text}
              attachmentPaths={block.attachments?.map((attachment) => attachment.path)}
            />
          )
        )}
      </div>
      {/* Actions live BELOW the bubble now, not floating in its corner: a
        * quiet copy/edit row that also opens a little breathing room before
        * the agent's reply. Revealed on hover/focus of the whole turn. */}
      {!editing && block.text && (
        <UserMessageActions
          text={block.text}
          onCopy={onCopy}
          onEdit={() => setEditing(true)}
        />
      )}
    </>
  );
}

/** Sent image attachments intentionally mirror the composer thumbnail, but
 * are transcript content rather than removable composer state. */
export function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  return (
    <>
      {/* Chips wrap inside the bubble and sit a step clear of the message
        * text below them. */}
      <div className="mb-1.5 flex flex-wrap gap-1">
        {attachments.map((attachment) => (
          <AttachmentChip
            key={attachment.path}
            attachment={attachment}
            onPreview={() => setPreviewAttachment(attachment)}
          />
        ))}
      </div>
      <AttachmentLightbox attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </>
  );
}

function InlineUserMessageEditor({
  text, saveLabel = 'Save', onChange, onCancel, onSave,
}: {
  text: string;
  saveLabel?: string;
  onChange: (text: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    });
  }, []);
  return (
    <div className="agent-turn-edit flex flex-col gap-3.5">
      {/* `.agent-turn-edit textarea` (agent-panel.css) still owns the
        * composer-idiom look — no border, no background, inherited type,
        * and the auto-grow bounds. It cannot clear the primitive's focus
        * halo, which is a box-shadow, so `ring-0` does that here: a text
        * field always matches :focus-visible, and the bubble turning into
        * an edit card IS the focus affordance. */}
      <Textarea
        className="p-0 focus-visible:ring-0"
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          onChange(e.target.value);
          e.currentTarget.style.height = 'auto';
          e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSave();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={onSave}>{saveLabel}</Button>
      </div>
    </div>
  );
}

const USER_TEXT_CHAR_LIMIT = 300;
const USER_TEXT_LINE_LIMIT = 4;

export function UserMessageText({ text, attachmentPaths }: { text: string; attachmentPaths?: string[] }) {
  const [open, setOpen] = useState(false);
  const preview = userTextPreview(text);
  const collapsible = preview !== text;
  return (
    <span className="block min-w-0 flex-1">
      {renderUserFileMentions(open || !collapsible ? text : preview, attachmentPaths)}
      {collapsible && !open && <span className="text-muted-foreground">…</span>}
      {collapsible && (
        <Button
          variant="ghost"
          className="mt-1.5 h-auto w-max gap-1 p-0 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Show less' : 'Show more'}
          <ChevronDownIcon className={cn('size-3 transition-transform duration-fast ease-out', open && 'rotate-180')} />
        </Button>
      )}
    </span>
  );
}

/** The composer serializes its atomic @-mention widget as @<path>. Restore
 * that same compact file chip in the transcript (parsing rules live in
 * mentionText.ts). */
function renderUserFileMentions(text: string, attachmentPaths?: string[]): ReactNode[] {
  return segmentFileMentions(text, attachmentPaths).map((segment) => segment.kind === 'mention'
    ? (
      <span key={`${segment.start}:${segment.path}`} className="agent-file-mention" title={segment.path}>
        {basename(segment.path)}
        <span className="sr-only">{` (file mention: ${segment.path})`}</span>
      </span>
    )
    : segment.text);
}

/** Copy + edit on every user message (ChatGPT-history register). Editing
 * resends the edited text as a NEW prompt — agent sessions cannot rewind,
 * so this is resend-from-history, never a fork. */
function UserMessageActions({
  text, onCopy, onEdit,
}: {
  text: string;
  onCopy: (text: string) => void;
  onEdit: () => void;
}) {
  /* `role="group"`, not a bare div: an aria-label on a role-less element is
   * not exposed at all, so this row of actions was announcing nothing.
   * Group rather than toolbar — toolbar promises roving arrow-key
   * navigation these two buttons do not implement. */
  return (
    <div
      /* Revealed on hover or keyboard focus of the whole turn, which is
       * `group/turn` on the turn wrapper in AgentMessages. The reserved
       * row also opens a little space between the user message and the
       * agent's reply. The -2px lift closes the gap the transcript's own
       * 10px turn gap would otherwise leave above a row that is mostly
       * empty space. */
      className="-mt-0.5 flex items-center justify-end gap-0.5 text-muted-foreground opacity-0 transition-surface group-hover/turn:opacity-100 group-focus-within/turn:opacity-100"
      role="group"
      aria-label="Message actions"
    >
      {/* 14, the app-wide chrome glyph size, over `icon-xs`'s 12: at 12
        * these two sat a step below every other icon in the panel. */}
      <Button variant="ghost" size="icon-xs" aria-label="Copy message" onClick={() => onCopy(text)}>
        <CopyIcon className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon-xs" aria-label="Edit and resend" onClick={onEdit}>
        <EditIcon className="size-3.5" />
      </Button>
    </div>
  );
}

function userTextPreview(text: string): string {
  const lines = text.split(/\r?\n/);
  let out = lines.slice(0, USER_TEXT_LINE_LIMIT).join('\n');
  if (out.length > USER_TEXT_CHAR_LIMIT) out = out.slice(0, USER_TEXT_CHAR_LIMIT);
  if (lines.length > USER_TEXT_LINE_LIMIT || text.length > out.length) return out.trimEnd();
  return text;
}
