'use client';

import { useState, useCallback } from 'react';
import { debounce } from '@/lib/utils';

interface SearchBoxProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  className?: string;
  debounceMs?: number;
  variant?: 'default' | 'compact';
}

export default function SearchBox({
  placeholder = 'Search...',
  onSearch,
  className = '',
  debounceMs = 300,
  variant = 'default',
}: SearchBoxProps) {
  const [value, setValue] = useState('');

  // Debounced search handler
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      onSearch(query);
    }, debounceMs),
    [onSearch]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    debouncedSearch(newValue);
  };

  const handleClear = () => {
    setValue('');
    onSearch('');
  };

  const isCompact = variant === 'compact';
  const inputClass = isCompact ? 'input-compact' : 'input';
  const iconSize = isCompact ? 'h-4 w-4' : 'h-5 w-5';
  const paddingLeft = isCompact ? 'pl-9' : 'pl-10';
  const paddingRight = isCompact ? 'pr-8' : 'pr-10';

  return (
    <div className={`relative ${className}`}>
      {/* Search icon */}
      <div className={`absolute inset-y-0 left-0 ${isCompact ? 'pl-2.5' : 'pl-3'} flex items-center pointer-events-none`}>
        <svg
          className={`${iconSize} text-text-muted`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Input */}
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${inputClass} ${paddingLeft} ${paddingRight}`}
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={handleClear}
          className={`absolute inset-y-0 right-0 ${isCompact ? 'pr-2' : 'pr-3'} flex items-center text-text-muted hover:text-text-primary transition-colors`}
        >
          <svg
            className={iconSize}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
