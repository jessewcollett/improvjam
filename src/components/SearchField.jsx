import { Search, X } from 'lucide-react';

export default function SearchField({
  value,
  onChange,
  placeholder,
  ringClass = 'focus:ring-blue-500',
  compact = false,
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`block w-full pl-10 ${value ? 'pr-11' : 'pr-3'} ${compact ? 'py-2' : 'py-3'} border border-gray-700 rounded-xl bg-[#1A1A1A] text-base text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 ${ringClass}`}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1 top-1/2 -translate-y-1/2 min-w-11 min-h-11 flex items-center justify-center text-gray-400 hover:text-white"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );
}
