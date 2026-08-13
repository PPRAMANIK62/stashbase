import React, { type ComponentProps } from 'react';
import rehypeKatex from 'rehype-katex';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { normalizeAgentMathDelimiters } from './agentMath';

function localAssistantLinkPath(href: string): string | null {
  if (!href || href.startsWith('#') || href.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(href)) return null;
  const path = href.split('#', 1)[0];
  if (!path) return null;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function isHttpUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function AgentMarkdown({ markdown, onOpenArtifact }: {
  markdown: string;
  onOpenArtifact: (path: string) => void;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
      rehypePlugins={[[rehypeKatex, {
        throwOnError: false,
        trust: false,
      }]]}
      components={{
        a: ({ href = '', children, ...props }: ComponentProps<'a'>) => {
          const localPath = localAssistantLinkPath(href);
          if (localPath) {
            return <a {...props} href={href} onClick={(event) => {
              event.preventDefault();
              onOpenArtifact(localPath);
            }}>{children}</a>;
          }
          if (href.startsWith('#') || isHttpUrl(href)) return <a {...props} href={href}>{children}</a>;
          return <span {...props}>{children}</span>;
        },
        // Agent output must not gain a remote-network image surface.
        img: () => null,
      }}
    >
      {normalizeAgentMathDelimiters(markdown)}
    </ReactMarkdown>
  );
}

export { localAssistantLinkPath, isHttpUrl };
