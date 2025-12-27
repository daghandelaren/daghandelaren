'use client';

import SearchBox from '@/components/ui/SearchBox';
import Select from '@/components/ui/Select';

interface FilterBarProps {
  onSearchChange: (search: string) => void;
  onSourceChange: (source: string) => void;
  onAssetClassChange: (assetClass: string) => void;
  sources: string[];
  hideSearch?: boolean;
}

export default function FilterBar({
  onSearchChange,
  onSourceChange,
  onAssetClassChange,
  sources,
  hideSearch = false,
}: FilterBarProps) {
  const sourceOptions = [
    { value: '', label: 'All Sources' },
    ...sources.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
  ];

  const assetClassOptions = [
    { value: '', label: 'All Asset Classes' },
    { value: 'forex', label: 'Forex' },
    { value: 'commodity', label: 'Commodities' },
    { value: 'index', label: 'Indices' },
    { value: 'crypto', label: 'Crypto' },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      {/* Search - conditionally rendered */}
      {!hideSearch && (
        <SearchBox
          placeholder="Search instruments..."
          onSearch={onSearchChange}
          className="w-full sm:w-64"
        />
      )}

      {/* Source filter */}
      <Select
        options={sourceOptions}
        onChange={onSourceChange}
        className="w-full sm:w-44"
      />

      {/* Asset class filter */}
      <Select
        options={assetClassOptions}
        onChange={onAssetClassChange}
        className="w-full sm:w-48"
      />
    </div>
  );
}
