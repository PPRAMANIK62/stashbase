import type { Meta, StoryObj } from '@storybook/react-vite';

import { SizeProvider } from '@/lib/size-context';

import { Badge } from './badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

const rows = [
  { document: 'Research notes', format: 'Markdown', status: 'Indexed', tone: 'green' },
  { document: 'Quarterly report', format: 'PDF', status: 'Preparing', tone: 'amber' },
  { document: 'Interview transcript', format: 'Audio', status: 'Failed', tone: 'red' },
] as const;

const meta = {
  title: 'Data Display/Table',
  component: Table,
  subcomponents: { TableHeader, TableBody, TableRow, TableHead, TableCell },
  parameters: { fluidCanvas: { width: '56rem', minHeight: '24rem' }, layout: 'padded' },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj;

export const DocumentIndex: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Document</TableHead>
          <TableHead>Format</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Research notes</TableCell>
          <TableCell>Markdown</TableCell>
          <TableCell>Indexed</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Quarterly report</TableCell>
          <TableCell>PDF</TableCell>
          <TableCell>Preparing</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

/** Cells carry whatever the row needs — a status here reads as a badge rather
 *  than as bare text, so the state is legible at a glance. */
export const RichCells: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Document</TableHead>
          <TableHead>Format</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.document}>
            <TableCell>{row.document}</TableCell>
            <TableCell>{row.format}</TableCell>
            <TableCell>
              <Badge color={row.tone} size="compact" variant="solid">
                {row.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

/** An empty result set. The table keeps its header so the columns stay
 *  readable, and says why there is nothing under it. */
export const Empty: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Document</TableHead>
          <TableHead>Format</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="text-muted-foreground" colSpan={3}>
            No documents match this filter.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

/** The compact step: tighter rows for a dense index. */
export const Compact: Story = {
  render: () => (
    <SizeProvider size="compact">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Format</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.document}>
              <TableCell>{row.document}</TableCell>
              <TableCell>{row.format}</TableCell>
              <TableCell>{row.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SizeProvider>
  ),
};
