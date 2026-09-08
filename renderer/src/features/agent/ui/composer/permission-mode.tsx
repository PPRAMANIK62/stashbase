import { Bolt, ChevronDown, FilePenLine, MessageCircleQuestion, ScrollText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import type { AgentAccessMode } from '@/protocols/websocket/agent-session';

const MODES: Array<{
  description: string;
  id: AgentAccessMode;
  label: string;
}> = [
  {
    description: 'Ask before actions',
    id: 'default',
    label: 'Ask',
  },
  {
    description: 'Propose without editing',
    id: 'plan',
    label: 'Plan',
  },
  {
    description: 'Make ordinary edits',
    id: 'acceptEdits',
    label: 'Edit',
  },
  {
    description: 'Pause for higher-risk actions',
    id: 'auto',
    label: 'Auto',
  },
];

const MODE_ICONS = {
  default: MessageCircleQuestion,
  plan: ScrollText,
  acceptEdits: FilePenLine,
  auto: Bolt,
} satisfies Record<AgentAccessMode, typeof MessageCircleQuestion>;

export function AgentPermissionMode({
  disabled,
  mode,
  onChange,
}: {
  disabled?: boolean;
  mode: AgentAccessMode;
  onChange(mode: AgentAccessMode): void;
}) {
  const activeIndex = Math.max(
    0,
    MODES.findIndex((entry) => entry.id === mode),
  );
  const active = MODES[activeIndex];
  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <Button
            aria-label={`Permission mode: ${active.label}. ${active.description}`}
            disabled={disabled}
            leadingIcon={MODE_ICONS[active.id]}
            size="compact"
            trailingIcon={ChevronDown}
            variant="ghost"
          >
            {active.label}
          </Button>
        }
      />
      <DropdownContent
        align="end"
        checkedIndex={activeIndex}
        className="w-72"
        selectionAppearance="none"
        side="top"
      >
        {MODES.map((entry, index) => (
          <MenuItem
            checked={entry.id === mode}
            description={entry.description}
            descriptionLayout="inline"
            icon={MODE_ICONS[entry.id]}
            index={index}
            key={entry.id}
            label={entry.label}
            onSelect={() => onChange(entry.id)}
          />
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}
