import { useState } from 'react';

const GRADIENTS = [
  'from-pink-500 to-rose-500',
  'from-purple-500 to-indigo-500',
  'from-cyan-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-fuchsia-500 to-pink-600',
  'from-teal-400 to-emerald-600',
];

const getGradientForName = (name = '') => {
  if (!name) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
};

export const normalizeAvatarUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const serverBase = apiBase.replace(/\/api\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${serverBase}${cleanPath}`;
};

export default function Avatar({
  src,
  name = '',
  size = 'md',
  shape = 'rounded-full',
  className = '',
  alt,
  ...props
}) {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-16 h-16 text-lg',
    '2xl': 'w-24 h-24 text-3xl font-extrabold',
  }[size] || size;

  const resolvedSrc = normalizeAvatarUrl(src);
  const initial = name?.trim()?.[0]?.toUpperCase() || '?';
  const bgGradient = getGradientForName(name);

  if (resolvedSrc && !hasError) {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-gray-100 ${sizeClasses} ${shape} ${className}`}
        {...props}
      >
        <img
          src={resolvedSrc}
          alt={alt || name || 'Avatar'}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover ${shape}`}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 font-bold text-white bg-gradient-to-tr ${bgGradient} shadow-sm select-none ${sizeClasses} ${shape} ${className}`}
      {...props}
    >
      {initial}
    </div>
  );
}
