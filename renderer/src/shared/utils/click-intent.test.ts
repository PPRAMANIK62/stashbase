import { afterEach, describe, expect, it } from 'vite-plus/test';

import { holdsTextSelection } from './click-intent';

function selectInside(node: Node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
});

describe('holdsTextSelection', () => {
  it('reports the selection a drag left inside the row that was clicked', () => {
    document.body.innerHTML =
      '<button id="row"><span id="name">Research</span><span>~/Documents</span></button>';
    const row = document.getElementById('row') as HTMLElement;
    selectInside(document.getElementById('name') as HTMLElement);

    expect(holdsTextSelection(row)).toBe(true);
  });

  it('lets an ordinary click through while another surface holds the selection', () => {
    document.body.innerHTML =
      '<p id="prose">Copied from here</p><button id="row"><span>Research</span></button>';
    selectInside(document.getElementById('prose') as HTMLElement);

    expect(holdsTextSelection(document.getElementById('row') as HTMLElement)).toBe(false);
  });

  it('lets a plain click through, which collapses the selection at its press', () => {
    document.body.innerHTML = '<button id="row"><span id="name">Research</span></button>';
    const row = document.getElementById('row') as HTMLElement;
    const name = document.getElementById('name') as HTMLElement;
    const range = document.createRange();
    range.setStart(name.childNodes[0] as Node, 2);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(holdsTextSelection(row)).toBe(false);
  });
});
