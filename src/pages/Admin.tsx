import { useState } from 'react';
import { Users, Calendar, Map, Bell, Search, Plus, Clock } from 'lucide-react';

const ROSTER_DATA = [
  { id: 1, name: 'Jimmy Carter', status: 'Active', duesPaid: 300, duesTotal: 300 },
  { id: 2, name: 'Dave Smith', status: 'Active', duesPaid: 150, duesTotal: 300 },
  { id: 3, name: 'Mike Johnson', status: 'Active', duesPaid: 0, duesTotal: 300 },
  { id: 4, name: 'Tom Davis', status: 'Injured', duesPaid: 300, duesTotal: 300 },
];

const FIELD_DATA = [
  { id: 1, name: 'Centennial Park', date: 'Sat 4/12', time: '9AM-12PM', status: 'Available' },
  { id: 2, name: 'Elm Street Turf', date: 'Sat 4/12', time: '2PM-5PM', status: 'Available' },
  { id: 3, name: 'Memorial Field', date: 'Sun 4/13', time: '10AM-1PM', status: 'Booked' },
];

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'roster' | 'fields' | 'schedule'>('roster');

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
          <Map className="w-5 h-5" /> Field Scout
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
                  {ROSTER_DATA.map((player) => (
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
                              className={`h-2 rounded-full ${player.duesPaid === player.duesTotal ? 'bg-emerald-500' : player.duesPaid > 0 ? 'bg-amber-500' : 'bg-red-500'}`} 
                              style={{ width: `${(player.duesPaid / player.duesTotal) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-mono text-stone-400">${player.duesPaid}/${player.duesTotal}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        {player.duesPaid < player.duesTotal && (
                          <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-md text-xs font-bold uppercase tracking-wider transition-colors">
                            <Bell className="w-3 h-3" /> Remind
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'fields' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-tight mb-1">Field Scout</h2>
                <p className="text-sm text-stone-400">Automated scraper results from local Parks & Rec.</p>
              </div>
              <span className="text-xs font-mono text-stone-500 bg-stone-950 px-3 py-1 rounded-full border border-stone-800">
                Last updated: Today, 6:00 AM
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FIELD_DATA.map((field) => (
                <div key={field.id} className="bg-stone-950 border border-stone-800 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-bold text-lg">{field.name}</h3>
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                      field.status === 'Available' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-stone-800 text-stone-500'
                    }`}>
                      {field.status}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-stone-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> {field.date}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" /> {field.time}
                    </div>
                  </div>
                  {field.status === 'Available' && (
                    <button className="w-full mt-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-lg text-sm font-bold uppercase tracking-wider transition-colors">
                      Book Field
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-stone-700 mx-auto mb-4" />
            <h2 className="text-2xl font-bold uppercase tracking-tight mb-2">Schedule Builder</h2>
            <p className="text-stone-400 max-w-md mx-auto mb-6">
              Drag and drop interface for building the season schedule. Integrates directly with the public ticker.
            </p>
            <button className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl uppercase tracking-wider transition-colors">
              Create New Game
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
