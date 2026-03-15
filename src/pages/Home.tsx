import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, Calendar, ArrowRight, Download } from 'lucide-react';
import { api } from '../lib/api';

interface Player {
  id: number;
  name: string;
  nickname: string | null;
  position: string;
  batting_avg: string;
  fun_stat: string | null;
  image_url: string | null;
  status: string;
}

interface Game {
  id: number;
  opponent: string;
  date: string;
  time: string;
  location: string;
  field_name: string | null;
}

interface MediaAsset {
  id: number;
  name: string;
  file_type: string;
  file_size: string | null;
}

export default function Home() {
  const location = useLocation();
  const [roster, setRoster] = useState<Player[]>([]);
  const [nextGame, setNextGame] = useState<Game | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);

  useEffect(() => {
    api<Player[]>('/roster').then(setRoster).catch(console.error);
    api<Game | null>('/schedule?next=true').then(setNextGame).catch(console.error);
    api<MediaAsset[]>('/media').then(setMediaAssets).catch(console.error);
  }, []);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location]);

  const displayName = (p: Player) =>
    p.nickname ? `${p.name.split(' ')[0]} "${p.nickname}" ${p.name.split(' ').slice(1).join(' ')}` : p.name;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <div className="pb-24">
      {/* Hero Section */}
      <section className="relative h-[70vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 bg-stone-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-stone-800 via-stone-950 to-stone-950 opacity-60" />
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 2px, transparent 2px)', backgroundSize: '32px 32px' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-transparent" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6 text-white drop-shadow-2xl">
            The Boys of Summer <br/>
            <span className="text-amber-500">Are Back.</span>
          </h1>
          <p className="text-xl md:text-2xl text-stone-300 font-medium mb-8 max-w-2xl mx-auto">
            Defending the Carolina Sandlot Collective (CSC) Championship. Cold beers, pulled muscles, and pure baseball.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#schedule" className="px-8 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-full uppercase tracking-widest transition-transform hover:scale-105 active:scale-95">
              View Schedule
            </a>
            <a href="#roster" className="px-8 py-4 bg-stone-800 hover:bg-stone-700 text-white font-bold rounded-full uppercase tracking-widest transition-colors">
              Meet the Team
            </a>
          </div>
        </div>
      </section>

      {/* Next Game Card */}
      <section id="schedule" className="max-w-5xl mx-auto px-4 -mt-20 relative z-20 scroll-mt-24">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 md:p-10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
          {nextGame ? (
            <>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-amber-500 font-bold uppercase tracking-wider text-sm mb-4">
                  <Calendar className="w-4 h-4" />
                  <span>Next Matchup</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-2">
                  Broken Bats <span className="text-stone-500">vs</span> {nextGame.opponent}
                </h2>
                <div className="flex items-center gap-4 text-stone-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> {formatDate(nextGame.date)} @ {nextGame.time}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {nextGame.location}{nextGame.field_name ? `, ${nextGame.field_name}` : ''}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 w-full md:w-auto">
                <a 
                  href="#" 
                  className="flex items-center justify-center gap-2 w-full md:w-auto px-6 py-4 bg-stone-800 hover:bg-stone-700 rounded-xl font-bold uppercase tracking-wider transition-colors"
                >
                  <MapPin className="w-5 h-5" />
                  Get Directions
                </a>
              </div>
            </>
          ) : (
            <div className="text-center w-full py-4">
              <p className="text-stone-400">No upcoming games scheduled.</p>
            </div>
          )}
        </div>
      </section>

      {/* Roster Showcase */}
      <section id="roster" className="max-w-7xl mx-auto px-4 py-24 scroll-mt-12">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">Starting Lineup</h2>
          <a href="#" className="flex items-center gap-2 text-amber-500 font-bold uppercase tracking-wider hover:text-amber-400 transition-colors">
            Full Roster <ArrowRight className="w-5 h-5" />
          </a>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {roster.filter(p => p.status === 'Active').slice(0, 4).map((player) => (
            <div key={player.id} className="group relative bg-stone-900 rounded-2xl overflow-hidden border border-stone-800 hover:border-stone-700 transition-colors">
              <div className="aspect-[3/4] overflow-hidden relative">
                <img 
                  src={player.image_url ?? `https://picsum.photos/seed/${player.id}/400/500`} 
                  alt={player.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6 w-full">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-amber-500 font-black text-2xl">{player.position}</span>
                    <span className="text-stone-300 font-mono text-sm">AVG {player.batting_avg}</span>
                  </div>
                  <h3 className="text-xl font-bold uppercase tracking-tight mb-2">{displayName(player)}</h3>
                  {player.fun_stat && (
                    <div className="bg-stone-950/80 backdrop-blur-sm rounded-lg p-3 border border-stone-800">
                      <span className="text-xs text-stone-400 uppercase tracking-wider block mb-1">Scouting Report</span>
                      <span className="text-sm font-medium text-stone-200">{player.fun_stat}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Media Assets Section */}
      <section id="media" className="max-w-7xl mx-auto px-4 py-12 border-t border-stone-800/50 scroll-mt-12">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-2">Brand Assets</h2>
            <p className="text-stone-400">Download official Broken Bats logos and icons.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {mediaAssets.map((asset) => (
            <div key={asset.id} className="bg-stone-900 border border-stone-800 rounded-2xl p-6 flex flex-col items-center text-center group hover:border-amber-500/50 transition-colors">
              <div className="w-24 h-24 bg-stone-950 rounded-xl border border-stone-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <div className="w-12 h-12 text-amber-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-bold uppercase tracking-tight mb-1">{asset.name}</h3>
              <p className="text-stone-500 text-sm font-mono mb-6">{asset.file_type}{asset.file_size ? ` • ${asset.file_size}` : ''}</p>
              <button className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-amber-600 hover:text-white text-stone-300 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors w-full justify-center">
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
