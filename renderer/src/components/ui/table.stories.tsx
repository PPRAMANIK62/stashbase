import type { Meta, StoryObj } from '@storybook/react-vite';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

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
