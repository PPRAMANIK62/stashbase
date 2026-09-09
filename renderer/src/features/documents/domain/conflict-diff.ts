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
      ...(diskIndex === undefined
        ? {}
        : { diskLineNumber: diskIndex + 1, diskText: diskLines[diskIndex] ?? '' }),
      ...(editorIndex === undefined
        ? {}
        : { editorLineNumber: editorIndex + 1, editorText: editorLines[editorIndex] ?? '' }),
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
  const editorBlock: string[] = [];
  const diskBlock: string[] = [];
  const flushChangedBlock = () => {
    if (editorBlock.length === 0 && diskBlock.length === 0) return;
    mergedLines.push(
      '<<<<<<< Editor Version',
      ...editorBlock,
      '=======',
      ...diskBlock,
      '>>>>>>> Disk Version',
    );
    editorBlock.length = 0;
    diskBlock.length = 0;
  };

  for (const row of computeConflictDiff(editorContent, diskContent)) {
    if (row.type === 'equal') {
      flushChangedBlock();
      mergedLines.push(row.editorText ?? '');
      continue;
    }
    if (row.editorText !== undefined) editorBlock.push(row.editorText);
    if (row.diskText !== undefined) diskBlock.push(row.diskText);
  }
  flushChangedBlock();
  return mergedLines.join('\n');
}
