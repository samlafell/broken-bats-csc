import React, { useState, useEffect, useMemo } from 'react';
import { Users, Calendar, Map as MapIcon, Bell, Search, Plus, Clock, X, Save, Trash2, Filter, ChevronDown } from 'lucide-react';
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

interface DuesRecord {
  id: number;
  player_id: number;
  player_name: string;
  amount_paid: number;
  amount_total: number;
  season: string;
}

interface Field {
  id: number;
  name: string;
  date: string;
  time_slot: string;
  status: string;
  last_updated: string;
}

interface Game {
  id: number;
  opponent: string;
  date: string;
  time: string;
  location: string;
  field_name: string | null;
  result: string | null;
  score_us: number | null;
  score_them: number | null;
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'roster' | 'fields' | 'schedule'>('roster');
  const [rosterData, setRosterData] = useState<Player[]>([]);
  const [duesData, setDuesData] = useState<DuesRecord[]>([]);
  const [fieldData, setFieldData] = useState<Field[]>([]);
  const [scheduleData, setScheduleData] = useState<Game[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [fieldFilter, setFieldFilter] = useState<string>('all');
  const [showNewGameForm, setShowNewGameForm] = useState(false);
  const [newGame, setNewGame] = useState({ opponent: '', date: '', time: '', location: '', field_name: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    api<Player[]>('/roster').then(setRosterData).catch(console.error);
    api<DuesRecord[]>('/dues').then(setDuesData).catch(console.error);
    api<Field[]>('/fields').then(setFieldData).catch(console.error);
    api<Game[]>('/schedule').then(setScheduleData).catch(console.error);
  };

  const getDuesForPlayer = (playerId: number) =>
    duesData.find((d) => d.player_id === playerId);

  const handleRemind = async (player: Player) => {
    alert(`Reminder sent to ${player.name}!`);
  };

  const handleBookField = async (field: Field) => {
    try {
      await api(`/fields/${field.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Booked' }),
      });
      loadData();
    } catch (err) {
      console.error('Booking failed:', err);
    }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/schedule', {
        method: 'POST',
        body: JSON.stringify(newGame),
      });
      setNewGame({ opponent: '', date: '', time: '', location: '', field_name: '' });
      setShowNewGameForm(false);
      loadData();
    } catch (err) {
      console.error('Create game failed:', err);
    }
  };

  const handleDeleteGame = async (id: number) => {
    if (!confirm('Delete this game?')) return;
    try {
      await api(`/schedule/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const filteredRoster = rosterData.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const uniqueFieldNames = useMemo(
    () => [...new Set(fieldData.map((f) => f.name))].sort(),
    [fieldData]
  );

  const filteredFields = useMemo(
    () => fieldFilter === 'all' ? fieldData : fieldData.filter((f) => f.name === fieldFilter),
    [fieldData, fieldFilter]
  );

  const fieldsByDate = useMemo(() => {
    const grouped = new Map<string, Field[]>();
    for (const field of filteredFields) {
      const existing = grouped.get(field.date) ?? [];
      existing.push(field);
      grouped.set(field.date, existing);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredFields]);

  const lastScraped = useMemo(() => {
    if (fieldData.length === 0) return null;
    return fieldData.reduce((latest, f) =>
      f.last_updated > latest ? f.last_updated : latest,
      fieldData[0].last_updated
    );
  }, [fieldData]);

  const availabilitySummary = useMemo(() => {
    const summary = new Map<string, { available: number; total: number }>();
    for (const f of fieldData) {
      const entry = summary.get(f.name) ?? { available: 0, total: 0 };
      entry.total++;
      if (f.status === 'Available') entry.available++;
      summary.set(f.name, entry);
    }
    return summary;
  }, [fieldData]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-2">Manager's Office</h1>
        <p className="text-stone-400 text-lg">Automation, reducing the headache of herding adult men.</p>
      </header>

      {/* Admin Navigation */}
      <div className="flex overflow-x-auto pb-4 mb-8 gap-2 border-b border-stone-800">
        <button 
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeTab === 'roster' ? 'bg-stone-800 text-white border-b-2 border-amber-500' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
          }`}
        >
          <Users className="w-5 h-5" /> Roster & Dues
        </button>
        <button 
          onClick={() => setActiveTab('fields')}
          className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeTab === 'fields' ? 'bg-stone-800 text-white border-b-2 border-amber-500' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
          }`}
        >
          <MapIcon className="w-5 h-5" /> Field Scout
        </button>
        <button 
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeTab === 'schedule' ? 'bg-stone-800 text-white border-b-2 border-amber-500' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
          }`}
        >
          <Calendar className="w-5 h-5" /> Schedule Builder
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 md:p-8">
        
        {activeTab === 'roster' && (
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold uppercase tracking-tight">Roster Management</h2>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input 
                    type="text" 
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-stone-600 focus:ring-1 focus:ring-stone-600"
                  />
                </div>
                <button className="p-2 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-400 text-xs uppercase tracking-wider">
                    <th className="p-4 font-medium">Player</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Dues Paid</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/50">
                  {filteredRoster.map((player) => {
                    const playerDues = getDuesForPlayer(player.id);
                    const paid = playerDues?.amount_paid ?? 0;
                    const total = playerDues?.amount_total ?? 300;
                    return (
                      <tr key={player.id} className="hover:bg-stone-800/30 transition-colors">
                        <td className="p-4 font-bold">{player.name}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            player.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {player.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-stone-800 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${paid === total ? 'bg-emerald-500' : paid > 0 ? 'bg-amber-500' : 'bg-red-500'}`} 
                                style={{ width: `${total > 0 ? (paid / total) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-mono text-stone-400">${paid}/${total}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          {paid < total && (
                            <button
                              onClick={() => handleRemind(player)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-md text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                              <Bell className="w-3 h-3" /> Remind
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'fields' && (
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-tight mb-1">Field Scout</h2>
                <p className="text-sm text-stone-400">Automated scraper results from Raleigh Parks & Rec.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                  <select
                    value={fieldFilter}
                    onChange={(e) => setFieldFilter(e.target.value)}
                    className="appearance-none bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-8 py-1.5 text-xs font-mono focus:outline-none focus:border-stone-600"
                  >
                    <option value="all">All Fields</option>
                    {uniqueFieldNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                </div>
                <span className="text-xs font-mono text-stone-500 bg-stone-950 px-3 py-1.5 rounded-full border border-stone-800 whitespace-nowrap">
                  {lastScraped
                    ? `Scraped: ${new Date(lastScraped + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })} ${new Date(lastScraped + 'Z').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}`
                    : 'No data yet'}
                </span>
              </div>
            </div>

            {uniqueFieldNames.length > 0 && fieldFilter === 'all' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
                {uniqueFieldNames.map((name) => {
                  const stats = availabilitySummary.get(name);
                  const pct = stats && stats.total > 0 ? Math.round((stats.available / stats.total) * 100) : 0;
                  return (
                    <button
                      key={name}
                      onClick={() => setFieldFilter(name)}
                      className="bg-stone-950 border border-stone-800 rounded-lg p-3 text-left hover:border-stone-600 transition-colors"
                    >
                      <p className="font-bold text-sm truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-stone-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${pct > 50 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-stone-400">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {fieldsByDate.length === 0 && (
              <div className="text-center py-12">
                <MapIcon className="w-16 h-16 text-stone-700 mx-auto mb-4" />
                <p className="text-stone-400">No field data yet. The bot scrapes daily at 6 AM ET.</p>
              </div>
            )}

            {fieldsByDate.map(([date, fields]) => (
              <div key={date} className="mb-8 last:mb-0">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-4 h-4 text-stone-500" />
                  <h3 className="text-lg font-bold">
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </h3>
                  <span className="text-xs font-mono text-stone-500">
                    {fields.filter((f) => f.status === 'Available').length}/{fields.length} slots open
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fields.map((field) => (
                    <div key={field.id} className="bg-stone-950 border border-stone-800 rounded-xl p-5">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="font-bold text-lg">{field.name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                          field.status === 'Available'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-stone-800 text-stone-500'
                        }`}>
                          {field.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-stone-400">
                        <Clock className="w-4 h-4" /> {field.time_slot}
                      </div>
                      {field.status === 'Available' && (
                        <button
                          onClick={() => handleBookField(field)}
                          className="w-full mt-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
                        >
                          Book Field
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold uppercase tracking-tight">Schedule Builder</h2>
              <button
                onClick={() => setShowNewGameForm(!showNewGameForm)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl uppercase tracking-wider transition-colors"
              >
                {showNewGameForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {showNewGameForm ? 'Cancel' : 'New Game'}
              </button>
            </div>

            {showNewGameForm && (
              <form onSubmit={handleCreateGame} className="bg-stone-950 border border-stone-800 rounded-xl p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Opponent"
                  value={newGame.opponent}
                  onChange={(e) => setNewGame({ ...newGame, opponent: e.target.value })}
                  required
                  className="bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-stone-600"
                />
                <input
                  type="date"
                  value={newGame.date}
                  onChange={(e) => setNewGame({ ...newGame, date: e.target.value })}
                  required
                  className="bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-stone-600"
                />
                <input
                  type="text"
                  placeholder="Time (e.g. 10:00 AM)"
                  value={newGame.time}
                  onChange={(e) => setNewGame({ ...newGame, time: e.target.value })}
                  required
                  className="bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-stone-600"
                />
                <input
                  type="text"
                  placeholder="Location"
                  value={newGame.location}
                  onChange={(e) => setNewGame({ ...newGame, location: e.target.value })}
                  required
                  className="bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-stone-600"
                />
                <input
                  type="text"
                  placeholder="Field Name (optional)"
                  value={newGame.field_name}
                  onChange={(e) => setNewGame({ ...newGame, field_name: e.target.value })}
                  className="bg-stone-900 border border-stone-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-stone-600"
                />
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg py-2 uppercase tracking-wider transition-colors"
                >
                  <Save className="w-5 h-5" /> Save Game
                </button>
              </form>
            )}

            <div className="space-y-4">
              {scheduleData.map((game) => (
                <div key={game.id} className="bg-stone-950 border border-stone-800 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-lg">vs {game.opponent}</h3>
                      {game.result && (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          game.result === 'W' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {game.result} {game.score_us}-{game.score_them}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-stone-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" /> {game.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" /> {game.time}
                      </span>
                      <span>{game.location}{game.field_name ? `, ${game.field_name}` : ''}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteGame(game.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-red-600 text-stone-400 hover:text-white rounded-md text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              ))}
              {scheduleData.length === 0 && (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-stone-700 mx-auto mb-4" />
                  <p className="text-stone-400">No games scheduled yet. Click "New Game" to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
