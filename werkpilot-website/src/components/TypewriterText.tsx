'use client';

import { useState, useEffect, useRef } from 'react';

interface TypewriterTextProps {
  texts: string[];
  className?: string;
  style?: React.CSSProperties;
  speed?: number;
  pauseDuration?: number;
}

export default function TypewriterText({ texts, className, style, speed = 50, pauseDuration = 2000 }: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const currentText = texts[textIndex];

    if (!isDeleting && charIndex < currentText.length) {
      timeoutRef.current = setTimeout(() => {
        setDisplayText(currentText.slice(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, speed);
    } else if (!isDeleting && charIndex === currentText.length) {
      timeoutRef.current = setTimeout(() => setIsDeleting(true), pauseDuration);
    } else if (isDeleting && charIndex > 0) {
      timeoutRef.current = setTimeout(() => {
        setDisplayText(currentText.slice(0, charIndex - 1));
        setCharIndex(charIndex - 1);
      }, speed / 2);
    } else if (isDeleting && charIndex === 0) {
      setIsDeleting(false);
      setTextIndex((textIndex + 1) % texts.length);
    }

    return () => clearTimeout(timeoutRef.current);
  }, [charIndex, isDeleting, textIndex, texts, speed, pauseDuration]);

  return (
    <span className={className} style={style}>
      {displayText}
      <span
        style={{
          borderRight: '2px solid currentColor',
          marginLeft: '2px',
          animation: 'blink 1s step-end infinite',
        }}
      />
    </span>
  );
}
