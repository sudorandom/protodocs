import React, { useEffect, useRef, useState, useCallback } from 'react';

interface MinimapProps {
  contentRef: React.RefObject<HTMLElement | null>;
  activeFile: string;
  schema: any;
  theme: 'dark' | 'light' | 'cyberpunk';
}

interface CachedElement {
  top: number;
  left: number;
  width: number;
  height: number;
  type: 'text' | 'block' | 'heading' | 'media' | 'comment';
  indent: number;
}

export default function Minimap({ contentRef, activeFile, schema, theme }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [cachedElements, setCachedElements] = useState<CachedElement[]>([]);
  const [currentScale, setCurrentScale] = useState<number>(1);
  const [currentMinimapScrollY, setCurrentMinimapScrollY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Re-cache content elements when file or schema changes
  const updateElementsCache = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;

    const contentRect = content.getBoundingClientRect();
    const elementsList: CachedElement[] = [];

    const selectors = [
      { selector: 'p, li, blockquote, table, pre code, .proto-text, .proto-heading', type: 'text' },
      { selector: '.text-syn-comment:not(.proto-text *)', type: 'comment' },
      { selector: 'pre, .proto-block', type: 'block' },
      { selector: 'h1, h2, h3, h4, h5, h6', type: 'heading' },
      { selector: 'img, svg, canvas', type: 'media' },
    ];

    selectors.forEach((sel) => {
      const elements = content.querySelectorAll(sel.selector);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        if (el.id === 'minimap' || el.closest('#minimap')) continue;

        const rect = el.getBoundingClientRect();
        if (rect.height === 0 || rect.width === 0) continue;

        const indentAttr = el.getAttribute('data-indent');
        const indent = indentAttr ? parseInt(indentAttr, 10) : 0;

        elementsList.push({
          top: rect.top - contentRect.top + content.scrollTop,
          left: rect.left - contentRect.left + content.scrollLeft,
          width: rect.width,
          height: rect.height,
          type: sel.type as any,
          indent,
        });
      }
    });

    setCachedElements(elementsList);
  }, [contentRef]);

  // Draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const content = contentRef.current;
    if (!canvas || !content) return;

    const clientWidth = canvas.clientWidth;
    const clientHeight = canvas.clientHeight;
    if (clientWidth === 0 || clientHeight === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== clientWidth * dpr || canvas.height !== clientHeight * dpr) {
      canvas.width = clientWidth * dpr;
      canvas.height = clientHeight * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, clientWidth, clientHeight);

    const documentHeight = content.scrollHeight;
    const windowHeight = content.clientHeight;
    const scrollY = content.scrollTop;

    // Use a fixed max-width content reference for scaling (usually max-w-4xl is 896px)
    const contentWidth = Math.max(content.scrollWidth, 896);
    const scale = clientWidth / contentWidth;
    
    // Scale y coordinates relative to how much scroll container height is
    const scaledHeight = documentHeight * scale;

    let minimapScrollY = 0;
    if (scaledHeight > clientHeight) {
      const scrollPercent = scrollY / (documentHeight - windowHeight);
      const clampPercent = Math.max(0, Math.min(1, isNaN(scrollPercent) ? 0 : scrollPercent));
      minimapScrollY = clampPercent * (scaledHeight - clientHeight);
    }

    // Save scales and minimap scroll offset for mouse scroll-to events
    setCurrentScale(scale);
    setCurrentMinimapScrollY(minimapScrollY);

    // Color palettes based on active theme
    let textCol = 'rgba(255, 255, 255, 0.15)';
    let commentCol = 'rgba(255, 255, 255, 0.05)';
    let blockCol = 'rgba(255, 255, 255, 0.08)';
    let headingCol = 'rgba(59, 130, 246, 0.7)'; // standard dark mode blue
    let mediaCol = 'rgba(139, 92, 246, 0.4)';  // standard dark mode purple
    let sliderFill = 'rgba(255, 255, 255, 0.06)';
    let sliderBorder = 'rgba(255, 255, 255, 0.35)';

    if (theme === 'cyberpunk') {
      textCol = 'rgba(10, 189, 198, 0.2)';
      commentCol = 'rgba(10, 189, 198, 0.06)';
      blockCol = 'rgba(234, 0, 217, 0.1)';
      headingCol = 'rgba(234, 0, 217, 0.6)';
      mediaCol = 'rgba(252, 238, 10, 0.4)';
      sliderFill = 'rgba(234, 0, 217, 0.08)';
      sliderBorder = 'rgba(234, 0, 217, 0.5)';
    } else if (theme === 'light') {
      textCol = 'rgba(0, 0, 0, 0.12)';
      commentCol = 'rgba(0, 0, 0, 0.04)';
      blockCol = 'rgba(0, 0, 0, 0.06)';
      headingCol = 'rgba(37, 99, 235, 0.6)';
      mediaCol = 'rgba(124, 58, 237, 0.35)';
      sliderFill = 'rgba(0, 0, 0, 0.04)';
      sliderBorder = 'rgba(0, 0, 0, 0.25)';
    }

    // Draw elements
    cachedElements.forEach((el) => {
      // 16px of horizontal offset per indent level
      const indentOffset = el.indent * 16;
      const x = (el.left + indentOffset) * scale;
      const y = el.top * scale - minimapScrollY;
      const w = Math.max(2, (el.width - indentOffset) * scale);
      const h = el.height * scale;

      // Skip elements that are completely out of canvas view
      if (y + h < 0 || y > clientHeight) return;

      if (el.type === 'text') ctx.fillStyle = textCol;
      else if (el.type === 'comment') ctx.fillStyle = commentCol;
      else if (el.type === 'block') ctx.fillStyle = blockCol;
      else if (el.type === 'heading') ctx.fillStyle = headingCol;
      else if (el.type === 'media') ctx.fillStyle = mediaCol;

      ctx.fillRect(x, y, w, h);
    });

    // Draw viewport slider indicator
    const viewportTop = scrollY * scale - minimapScrollY;
    const viewportHeight = windowHeight * scale;

    ctx.fillStyle = sliderFill;
    ctx.fillRect(0, viewportTop, clientWidth, viewportHeight);

    ctx.strokeStyle = sliderBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, viewportTop, clientWidth - 1, viewportHeight);
  }, [contentRef, theme, cachedElements]);

  // Scroll target handler
  const scrollToMinimapY = useCallback((clientY: number, dragging: boolean) => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const rect = container.getBoundingClientRect();
    const clickY = clientY - rect.top;

    const windowHeight = content.clientHeight;
    const documentHeight = content.scrollHeight;

    if (documentHeight <= windowHeight) return;

    const scaledHeight = documentHeight * currentScale;
    const viewportHeight = windowHeight * currentScale;
    const trackHeight = scaledHeight > windowHeight ? windowHeight : scaledHeight;

    let targetScrollY = 0;
    if (dragging) {
      const maxSliderTop = trackHeight - viewportHeight;
      if (maxSliderTop <= 0) return;

      const boxTop = Math.max(0, Math.min(maxSliderTop, clickY - viewportHeight / 2));
      const scrollPercent = boxTop / maxSliderTop;
      targetScrollY = scrollPercent * (documentHeight - windowHeight);
    } else {
      const Y_doc = (clickY + currentMinimapScrollY) / currentScale;
      targetScrollY = Y_doc - windowHeight / 2;
    }

    content.scrollTo({
      top: targetScrollY,
      behavior: dragging ? 'auto' : 'smooth',
    });
  }, [contentRef, currentScale, currentMinimapScrollY]);

  // Mutable refs to draw and scrollToMinimapY to avoid resetting scroll/resize listeners on change
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  const scrollToMinimapYRef = useRef(scrollToMinimapY);
  useEffect(() => {
    scrollToMinimapYRef.current = scrollToMinimapY;
  }, [scrollToMinimapY]);

  // Setup listeners and timers
  useEffect(() => {
    updateElementsCache();

    // Deferred checks for async/late rendering elements
    const t1 = setTimeout(updateElementsCache, 500);
    const t2 = setTimeout(updateElementsCache, 1500);
    const t3 = setTimeout(updateElementsCache, 3000);

    const content = contentRef.current;
    if (!content) {
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }

    let observer: ResizeObserver | null = null;
    if (window.ResizeObserver) {
      observer = new ResizeObserver(() => {
        updateElementsCache();
      });
      // Observe the inner wrapper child so we detect height changes when items expand/collapse
      if (content.firstElementChild) {
        observer.observe(content.firstElementChild);
      } else {
        observer.observe(content);
      }
    }

    const handleScroll = () => {
      drawRef.current();
    };

    const handleResize = () => {
      updateElementsCache();
    };

    content.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (observer) {
        observer.disconnect();
      }
      content.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [contentRef, activeFile, schema, updateElementsCache]);

  // Redraw when draw callback changes (or any of its dependencies do)
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle Drag events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        scrollToMinimapYRef.current(e.clientY, true);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length > 0) {
        scrollToMinimapYRef.current(e.touches[0].clientY, true);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  return (
    <div
      id="minimap"
      ref={containerRef}
      className="hidden xl:block fixed top-14 bottom-0 right-4 w-[120px] z-40 bg-transparent border-l border-app-border/10 opacity-60 hover:opacity-100 hover:bg-app-hoverBg/10 transition-all duration-200 cursor-pointer select-none"
      onMouseDown={(e) => {
        setIsDragging(true);
        scrollToMinimapY(e.clientY, false);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        if (e.touches.length > 0) {
          scrollToMinimapY(e.touches[0].clientY, false);
        }
      }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
    </div>
  );
}
