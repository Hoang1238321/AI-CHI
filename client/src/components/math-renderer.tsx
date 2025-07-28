import { useEffect, useRef } from "react";

interface MathRendererProps {
  content: string;
  className?: string;
}

declare global {
  interface Window {
    MathJax: any;
  }
}

export function MathRenderer({ content, className }: MathRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && window.MathJax) {
      // Process math in the content
      window.MathJax.typesetPromise([containerRef.current]).catch((err: any) => {
        console.log('MathJax typeset failed: ' + err.message);
      });
    }
  }, [content]);

  return (
    <div 
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}