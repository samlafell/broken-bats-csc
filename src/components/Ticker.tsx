import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface TickerData {
  lastGame: {
    result: string;
    score_us: number;
    score_them: number;
    opponent: string;
  } | null;
  nextGame: {
    opponent: string;
    date: string;
    time: string;
    location: string;
  } | null;
  standings: {
    wins: number;
    losses: number;
  };
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
}

export default function Ticker() {
  const [data, setData] = useState<TickerData | null>(null);

  useEffect(() => {
    api<TickerData>('/ticker').then(setData).catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="bg-stone-900 border-b border-stone-800 text-xs font-mono uppercase tracking-wider py-1.5 px-4 flex items-center justify-center">
        <span className="text-stone-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="bg-stone-900 border-b border-stone-800 text-xs font-mono uppercase tracking-wider py-1.5 px-4 flex items-center justify-between overflow-hidden">
      <div className="flex items-center gap-6 whitespace-nowrap animate-marquee">
        {data.lastGame && (
          <>
            <span className="text-stone-400">
              Last Game:{' '}
              <span className={`font-bold ${data.lastGame.result === 'W' ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.lastGame.result} {data.lastGame.score_us}-{data.lastGame.score_them}
              </span>{' '}
              vs {data.lastGame.opponent}
            </span>
            <span className="text-stone-600">|</span>
          </>
        )}
        {data.nextGame && (
          <>
            <span className="text-stone-400">
              Next Game:{' '}
              <span className="text-stone-200 font-bold">
                {formatShortDate(data.nextGame.date)} @ {data.nextGame.time}
              </span>{' '}
              vs {data.nextGame.opponent}
            </span>
            <span className="text-stone-600">|</span>
          </>
        )}
        <span className="text-stone-400">
          Standings:{' '}
          <span className="text-stone-200 font-bold">
            {data.standings.wins > data.standings.losses ? '1st' : ''} ({data.standings.wins}-{data.standings.losses})
          </span>
        </span>
      </div>
    </div>
  );
}
