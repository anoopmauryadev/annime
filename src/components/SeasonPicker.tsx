"use client";

import { ChevronDown } from "lucide-react";

export type SeasonOption = { id: number; season_number: number; title?: string | null };

export default function SeasonPicker({ seasons, value, onChange }: {
  seasons: SeasonOption[];
  value: number;
  onChange: (season: number) => void;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Choose Season</span>
      <span className="relative inline-block max-w-full">
        <select aria-label="Choose Season" value={value} onChange={event => onChange(Number(event.target.value))}
          className="max-w-full appearance-none rounded-lg bg-[#1e1e24] py-2 pl-3 pr-10 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#ff640a] cursor-pointer">
          {seasons.map(season => <option key={season.id} value={season.season_number}>
            {season.title || `Season ${season.season_number}`}
          </option>)}
        </select>
        <ChevronDown aria-hidden size={20} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#ff640a]" />
      </span>
    </label>
  );
}
