import { memo, type ComponentProps } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

function isHttpUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function markdownComponents(onOpenExternal?: (href: string) => void): Components {
  return {
    a: ({ href = '', children, ...props }: ComponentProps<'a'>) => {
      if (href.startsWith('#'))
        return (
          <a {...props} href={href}>
            {children}
          </a>
        );
      if (isHttpUrl(href)) {
        return (
          <a
            {...props}
            href={href}
            onClick={
              onOpenExternal
                ? (event) => {
                    event.preventDefault();
                    onOpenExternal(href);
                  }
                : undefined
            }
            rel="noreferrer"
            target="_blank"
          >
            {children}
          </a>
        );
      }
      // Local file navigation belongs to the source-context and artifact tasks.
      // Keep an untrusted relative link visibly inert until that authority exists.
      return <span>{children}</span>;
    },
    img: () => null,
  };
}

export const AgentMarkdown = memo(function AgentMarkdown({
  markdown,
  onOpenExternal,
}: {
  markdown: string;
  onOpenExternal?: (href: string) => void;
}) {
  return (
    <div
      className={[
        'min-w-0 text-[14px] leading-[1.6] whitespace-normal text-foreground',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        '[&_p]:my-3 [&_p]:whitespace-normal',
        '[&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-[18px] [&_h1]:leading-tight [&_h1]:font-semibold',
        '[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-[16px] [&_h2]:leading-tight [&_h2]:font-semibold',
        '[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-[14px] [&_h3]:font-semibold',
        '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5',
        '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5',
        '[&_li]:pl-0.5 [&_li>p]:my-0',
        '[&_a]:text-working [&_a]:underline [&_a]:decoration-working/35 [&_a]:underline-offset-[0.18em] hover:[&_a]:decoration-working',
        '[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-working/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.88em]',
        '[&_pre]:my-4 [&_pre]:max-w-full [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-surface-1 [&_pre]:p-3',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_hr]:my-5 [&_hr]:border-border',
        '[&_table]:my-4 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse',
        '[&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-medium',
        '[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top',
      ].join(' ')}
    >
      <ReactMarkdown components={markdownComponents(onOpenExternal)} remarkPlugins={[remarkGfm]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
});

export { isHttpUrl };
