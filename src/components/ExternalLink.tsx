import React from 'react';
import { openExternalUrl } from '../lib/external-links';

type ExternalLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement>;

export default function ExternalLink({ href = '', onClick, children, ...props }: ExternalLinkProps) {
  const isExternal = href.startsWith('http://') || href.startsWith('https://');

  if (!isExternal) {
    return (
      <a href={href} onClick={onClick} {...props}>
        {children}
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        openExternalUrl(href);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
