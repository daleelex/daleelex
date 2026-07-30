import type { ServiceDoc } from '@daleelex/shared';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { resolveDocUrl } from '../lib/docLinks';

export function DocMarkdown({ doc }: { doc: ServiceDoc }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children, ...props }) => {
          const resolved = resolveDocUrl(href, doc, 'link');
          const external = !!resolved && /^https?:\/\//.test(resolved);
          return (
            <a
              {...props}
              href={resolved}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          );
        },
        img: ({ src, alt, ...props }) => (
          <img {...props} src={resolveDocUrl(src, doc, 'image')} alt={alt ?? ''} loading="lazy" />
        ),
      }}
    >
      {doc.contentMd}
    </ReactMarkdown>
  );
}
