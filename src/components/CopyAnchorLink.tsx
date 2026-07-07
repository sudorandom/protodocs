import React, { useState } from 'react';

interface CopyAnchorLinkProps {
  file: string;
  symbol: string;
  className?: string;
}

export default function CopyAnchorLink({ file, symbol, className = '' }: CopyAnchorLinkProps) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#/files/${file}?symbol=${symbol}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative inline-flex items-center select-none ${className}`}>
      <button
        onClick={handleCopy}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`p-1 rounded cursor-pointer transition-all duration-150 active:scale-90 hover:scale-110 flex items-center justify-center
          ${copied
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5'
            : 'text-app-textMuted hover:text-app-textBright hover:bg-app-hoverBg border border-transparent hover:border-app-border/30'
          }`}
        aria-label="Copy link to symbol"
      >
        {copied ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="w-3.5 h-3.5 transition-transform duration-200 scale-100"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-3.5 h-3.5 transition-transform duration-200"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
        )}
      </button>

      <div
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] font-sans font-medium rounded bg-slate-900 text-slate-100 shadow-md border border-slate-700/30 whitespace-nowrap transition-all duration-150 pointer-events-none z-50
          ${showTooltip || copied
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-1 scale-95'
          }`}
      >
        {copied ? 'Copied link!' : 'Copy link to symbol'}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
      </div>
    </div>
  );
}
