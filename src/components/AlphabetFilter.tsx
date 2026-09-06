"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AlphabetFilter() {
  const letters = ["#", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
  const pathname = usePathname();

  return (
    <div className="py-4 px-4 md:px-5 bg-[#141519] rounded-xl my-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
          <span className="w-1 h-3.5 bg-[#ff640a] rounded-full"></span>
          A-Z Anime Directory
        </h3>
        <span className="text-[11px] text-gray-400 hidden md:inline">Browse by title alphabetically</span>
      </div>

      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
        {letters.map((letter) => {
          const letterVal = letter === "#" ? "0-9" : letter;
          const href = `/letter/${letterVal}`;
          const isActive = pathname === href;

          return (
            <Link
              key={letter}
              href={href}
              className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded text-xs font-bold font-mono transition-all ${
                isActive
                  ? "bg-[#ff640a] text-white"
                  : "bg-[#1e1e24] text-gray-300 hover:bg-[#ff640a] hover:text-white"
              }`}
            >
              {letter}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
