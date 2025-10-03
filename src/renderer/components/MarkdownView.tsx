import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Components } from 'react-markdown';

interface Props {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<Props> = ({ content, className }) => {
  return (
    <div className={className + ' prose prose-sm dark:prose-invert max-w-none'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          code(codeProps) {
            const { children, className, node } = codeProps as any;
            const inline = (node?.position?.start?.line === node?.position?.end?.line) && !/\n/.test(String(children));
            const match = /language-(\w+)/.exec(className || '');
            if (!inline && match) {
              return (
                <pre className="rounded bg-gray-800 text-gray-100 p-3 overflow-auto text-xs">
                  <code>{String(children).replace(/\n$/, '')}</code>
                </pre>
              );
            }
            return <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-[11px]">{children}</code>;
          },
          a(aProps) {
            const { href, children } = aProps as any;
            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">{children}</a>;
          }
        } as Components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
