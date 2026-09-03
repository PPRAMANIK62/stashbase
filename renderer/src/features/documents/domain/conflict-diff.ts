export interface ConflictDiffRow {
  diskLineNumber?: number;
  diskText?: string;
  editorLineNumber?: number;
  editorText?: string;
  type: 'equal' | 'insert' | 'delete' | 'modify';
}

/** Retains shared context and linearly aligns the changed middle. */
export function computeConflictDiff(editorContent: string, diskContent: string): ConflictDiffRow[] {
  const editorLines = editorContent.split('\n');
  const diskLines = diskContent.split('\n');
  const sharedLimit = Math.min(editorLines.length, diskLines.length);
  let prefixLength = 0;
  while (prefixLength < sharedLimit && editorLines[prefixLength] === diskLines[prefixLength]) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < sharedLimit - prefixLength &&
    editorLines[editorLines.length - suffixLength - 1] ===
      diskLines[diskLines.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  const rows: ConflictDiffRow[] = [];
  const addRow = (
    editorIndex: number | undefined,
    diskIndex: number | undefined,
    type: ConflictDiffRow['type'],
  ) => {
    rows.push({
      diskLineNumber: diskIndex === undefined ? undefined : diskIndex + 1,
      diskText: diskIndex === undefined ? undefined : diskLines[diskIndex],
      editorLineNumber: editorIndex === undefined ? undefined : editorIndex + 1,
      editorText: editorIndex === undefined ? undefined : editorLines[editorIndex],
      type,
    });
  };

  for (let index = 0; index < prefixLength; index += 1) addRow(index, index, 'equal');

  const editorMiddleEnd = editorLines.length - suffixLength;
  const diskMiddleEnd = diskLines.length - suffixLength;
  const middleLength = Math.max(editorMiddleEnd - prefixLength, diskMiddleEnd - prefixLength);
  for (let offset = 0; offset < middleLength; offset += 1) {
    const editorIndex = prefixLength + offset < editorMiddleEnd ? prefixLength + offset : undefined;
    const diskIndex = prefixLength + offset < diskMiddleEnd ? prefixLength + offset : undefined;
    addRow(
      editorIndex,
      diskIndex,
      editorIndex === undefined ? 'insert' : diskIndex === undefined ? 'delete' : 'modify',
    );
  }

  for (let offset = suffixLength; offset > 0; offset -= 1) {
    addRow(editorLines.length - offset, diskLines.length - offset, 'equal');
  }
  return rows;
}

export function buildConflictMarkerDraft(editorContent: string, diskContent: string): string {
  const mergedLines: string[] = [];
  const rows = computeConflictDiff(editorContent, diskContent);
  let index = 0;
  while (index < rows.length) {
    const row = rows[index];
    if (row.type === 'equal') {
      mergedLines.push(row.editorText ?? '');
      index += 1;
      continue;
    }

    const editorBlock: string[] = [];
    const diskBlock: string[] = [];
    while (index < rows.length && rows[index]?.type !== 'equal') {
      const changedRow = rows[index];
      if (changedRow?.editorText !== undefined) editorBlock.push(changedRow.editorText);
      if (changedRow?.diskText !== undefined) diskBlock.push(changedRow.diskText);
      index += 1;
    }
    mergedLines.push(
      '<<<<<<< Editor Version',
      ...editorBlock,
      '=======',
      ...diskBlock,
      '>>>>>>> Disk Version',
    );
  }
  return mergedLines.join('\n');
}
