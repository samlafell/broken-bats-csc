import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Ticker() {
  return (
    <div className="bg-stone-900 border-b border-stone-800 text-xs font-mono uppercase tracking-wider py-1.5 px-4 flex items-center justify-between overflow-hidden">
      <div className="flex items-center gap-6 whitespace-nowrap animate-marquee">
        <span className="text-stone-400">Last Game: <span className="text-emerald-400 font-bold">W 5-3</span> vs Tigers</span>
        <span className="text-stone-600">|</span>
        <span className="text-stone-400">Next Game: <span className="text-stone-200 font-bold">Sat 4/12 @ 10AM</span> vs Yankees</span>
        <span className="text-stone-600">|</span>
        <span className="text-stone-400">Standings: <span className="text-stone-200 font-bold">1st (8-2)</span></span>
      </div>
    </div>
  );
}
