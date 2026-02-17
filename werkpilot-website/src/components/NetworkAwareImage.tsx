'use client';

import Image from 'next/image';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface NetworkAwareImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

export default function NetworkAwareImage({ src, alt, width, height, className, priority }: NetworkAwareImageProps) {
  const network = useNetworkStatus();

  // Reduce quality for slow connections
  const quality = network === 'slow' ? 60 : 85;
  const sizes = network === 'slow'
    ? `(max-width: 768px) ${Math.round(width * 0.5)}px, ${width}px`
    : `(max-width: 768px) ${width}px, ${width}px`;

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      quality={quality}
      sizes={sizes}
      priority={priority}
    />
  );
}
