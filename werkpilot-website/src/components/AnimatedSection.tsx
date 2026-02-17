'use client';

import { useInView } from '@/hooks/useInView';

type AnimationType = 'fade-up' | 'fade-in' | 'fade-left' | 'fade-scale';

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  animation?: AnimationType;
  delay?: number;
  as?: 'div' | 'section';
}

const animationClassMap: Record<AnimationType, string> = {
  'fade-up': 'animate-on-scroll',
  'fade-in': 'animate-on-scroll',
  'fade-left': 'animate-on-scroll-left',
  'fade-scale': 'animate-on-scroll-scale',
};

export default function AnimatedSection({
  children,
  className = '',
  style,
  animation = 'fade-up',
  delay = 0,
  as: Tag = 'div',
}: AnimatedSectionProps) {
  const { ref, isInView } = useInView(0.1);

  return (
    <Tag
      ref={ref}
      className={`${animationClassMap[animation]} ${isInView ? 'in-view' : ''} ${className}`}
      style={{
        ...style,
        transitionDelay: delay ? `${delay}ms` : undefined,
      }}
    >
      {children}
    </Tag>
  );
}
