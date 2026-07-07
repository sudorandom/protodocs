import React, { useEffect, useState } from 'react';

export interface ContextMenuState {
  x: number;
  y: number;
  file: string;
  symbol: string;
}

interface ContextMenuProps {
  state: ContextMenuState | null;
  onClose: () => void;
}

export default function ContextMenu({ state, onClose }: ContextMenuProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSymbol, setCopiedSymbol] = useState(false);

  useEffect(() => {
    if (!state) return;
    setCopiedLink(false);
    setCopiedSymbol(false);

    const handleClose = () => onClose();
    // Close context menu on left clicks anywhere, scrolling, or pressing Escape
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, { passive: true });
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state, onClose]);

  if (!state) return null;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#/files/${state.file}?symbol=${state.symbol}`;

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

    setCopiedLink(true);
    setTimeout(() => {
      setCopiedLink(false);
      onClose();
    }, 1000);
  };

  const handleCopySymbol = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.symbol);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = state.symbol;
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

    setCopiedSymbol(true);
    setTimeout(() => {
      setCopiedSymbol(false);
      onClose();
    }, 1000);
  };

  // Adjust menu position if it overflows the window
  const menuWidth = 224; // w-56 is 224px
  const menuHeight = 90; // approximate height
  let left = state.x;
  let top = state.y;

  if (left + menuWidth > window.innerWidth) {
    left = Math.max(10, window.innerWidth - menuWidth - 10);
  }
  if (top + menuHeight > window.innerHeight) {
    top = Math.max(10, window.innerHeight - menuHeight - 10);
  }

  return (
    <div
      className="fixed z-[100] w-56 py-1 bg-app-panel/95 backdrop-blur-md border border-app-border rounded-lg shadow-2xl animate-scaleUp text-app-textMain select-none font-sans"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()} // prevent context menu on the menu itself
    >
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-app-textMuted border-b border-app-border/50 mb-1 select-none">
        Symbol Actions
      </div>

      <button
        onClick={handleCopyLink}
        className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-app-accentBg hover:text-app-accent flex items-center justify-between transition-colors duration-100 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          <span>Copy Link to Element</span>
        </div>
        {copiedLink && <span className="text-[10px] text-emerald-400 font-bold">Copied!</span>}
      </button>

      <button
        onClick={handleCopySymbol}
        className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-app-accentBg hover:text-app-accent flex items-center justify-between transition-colors duration-100 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 00-2.25 2.25v6" />
          </svg>
          <span>Copy Full Name (FQN)</span>
        </div>
        {copiedSymbol && <span className="text-[10px] text-emerald-400 font-bold">Copied!</span>}
      </button>
    </div>
  );
}
