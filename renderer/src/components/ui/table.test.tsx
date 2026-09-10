import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

afterEach(cleanup);

function DocumentIndex() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Document</TableHead>
          <TableHead>Format</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Research notes</TableCell>
          <TableCell>Markdown</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Quarterly report</TableCell>
          <TableCell>PDF</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

describe('Table', () => {
  it('keeps real table semantics for its rows and columns', async () => {
    const view = render(<DocumentIndex />);
    expect(screen.getByRole('columnheader', { name: 'Document' })).toBeDefined();
    // Two body rows plus the header row.
    expect(screen.getAllByRole('row')).toHaveLength(3);
    await expectNoA11yViolations(view.container);
  });
});
