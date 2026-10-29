import { useState } from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = '', size = 20 }: LogoProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div 
        style={{ width: size, height: size }} 
        className={`rounded-lg bg-red-600 text-white font-bold text-xs flex items-center justify-center select-none ${className}`}
      >
        M
      </div>
    );
  }

  return (
    <img
      src="/favicon.svg"
      alt="MexxicanMX"
      width={size}
      height={size}
      className={`inline-block object-contain select-none ${className}`}
      onError={() => setError(true)}
    />
  );
}
