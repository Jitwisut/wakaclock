'use client';

import { type ComponentRef, useEffect, useRef, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>_+*';
const DURATION_MS = 750;

/** Only Latin letters and digits decode; Thai, spaces and punctuation stay put. */
function decodes(char: string) {
  return /[\da-z]/i.test(char);
}

/** The text partway through decoding: characters settle left to right. */
export function scrambleFrame(text: string, progress: number, random: () => number): string {
  if (progress >= 1) return text;
  return [...text]
    .map((char, index, chars) => {
      if (!decodes(char)) return char;
      const settleAt = 0.25 + (index / Math.max(1, chars.length)) * 0.75;
      if (progress >= settleAt) return char;
      return GLYPHS.charAt(Math.floor(random() * GLYPHS.length));
    })
    .join('');
}

/**
 * A monospace label that decodes from random glyphs into its text the first time it comes
 * into view. The real text is server-rendered and always available to assistive tech; the
 * moving glyphs are decoration and skipped under reduced motion.
 */
export function Scramble({ text }: { text: string }) {
  const ref = useRef<ComponentRef<'span'>>(null);
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const node = ref.current as ComponentRef<'span'>;
    let frame = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / DURATION_MS);
        setShown(scrambleFrame(text, progress, Math.random));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [text]);

  return (
    <span ref={ref}>
      <span aria-hidden="true">{shown}</span>
      <span className="tx-sr-only">{text}</span>
    </span>
  );
}
