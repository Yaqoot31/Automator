import { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface BlurTextRevealProps {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}

export function BlurTextReveal({ text, className = '', delay = 0, stagger = 0.08 }: BlurTextRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const lineElements = containerRef.current.querySelectorAll('.blur-line');
    if (lineElements.length === 0) return;

    lineElements.forEach((el, i) => {
      gsap.fromTo(
        el,
        {
          filter: 'blur(10px)',
          opacity: 0,
        },
        {
          filter: 'blur(0px)',
          opacity: 1,
          duration: 1.2,
          delay: delay + i * stagger,
          ease: 'power2.out',
        }
      );
    });

    return () => {
      gsap.killTweensOf(lineElements);
    };
  }, [delay, stagger]);

  const lines = text.split('\n');

  return (
    <div ref={containerRef} className={className}>
      {lines.map((line, i) => (
        <div key={i} className="blur-line" style={{ opacity: 0 }}>
          {line || ' '}
        </div>
      ))}
    </div>
  );
}
