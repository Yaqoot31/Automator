import { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({ value, duration = 1, className = '' }: AnimatedCounterProps) {
  const displayRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!displayRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            const obj = { val: 0 };
            gsap.to(obj, {
              val: value,
              duration,
              ease: 'power2.out',
              onUpdate: () => {
                if (displayRef.current) {
                  displayRef.current.textContent = Math.round(obj.val).toString();
                }
              },
            });
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(displayRef.current);
    return () => observer.disconnect();
  }, [value, duration]);

  return <span ref={displayRef} className={className}>0</span>;
}
