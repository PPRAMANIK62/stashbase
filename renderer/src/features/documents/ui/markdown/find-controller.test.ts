import { describe, expect, it } from 'vite-plus/test';

import { buildFindCorpus, type FindCorpusNode } from './find-controller';

function text(data: string): FindCorpusNode {
  return { data, firstChild: null, nextSibling: null, nodeType: Node.TEXT_NODE };
}

function element(tagName: string, ...children: FindCorpusNode[]): FindCorpusNode {
  children.forEach((child, index) => {
    child.nextSibling = children[index + 1] ?? null;
  });
  return {
    firstChild: children[0] ?? null,
    nextSibling: null,
    nodeType: Node.ELEMENT_NODE,
    tagName,
  };
}

describe('Markdown Find corpus', () => {
  it('joins inline text but separates blocks and excludes executable text', () => {
    const root = element(
      'DIV',
      element('P', text('key'), element('STRONG', text('board'))),
      element('P', text('next')),
      element('SCRIPT', text('secret')),
    );
    const corpus = buildFindCorpus(root).joined;

    expect(corpus).toContain('keyboard');
    expect(corpus).not.toContain('keyboardnext');
    expect(corpus).not.toContain('secret');
  });
});
