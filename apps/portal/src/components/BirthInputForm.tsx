import React, { useState, useEffect } from 'react';
import { CITIES, searchCities } from '../services/cityData';
import type { City } from '../services/cityData';
import { DateTime } from 'luxon';

export interface BirthData {
  date: Date;
  timezone: string;
  location: {
    latitude: number;
    longitude: number;
    name: string;
  };
}

interface BirthInputFormProps {
  initialData?: BirthData;
  onCalculate: (data: BirthData) => void;
  className?: string;
}

export const BirthInputForm: React.FC<BirthInputFormProps> = ({
  onCalculate,
  className = ''
}) => {
  const [date, setDate] = useState('1998-12-06');
  const [time, setTime] = useState('09:23');
  const [search, setSearch] = useState('Chennai');
  const [selectedCity, setSelectedCity] = useState<City>(CITIES.find(c => c.name === 'Chennai') || CITIES[0]);
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (search && search !== selectedCity.name) {
      setSuggestions(searchCities(search));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [search, selectedCity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Use Luxon to parse date/time in the context of the city's timezone
    const dt = DateTime.fromISO(`${date}T${time}:00`, { zone: selectedCity.timezone });
    
    if (!dt.isValid) {
      alert("Invalid Date or Time");
      return;
    }

    onCalculate({
      date: dt.toJSDate(),
      timezone: selectedCity.timezone,
      location: {
        latitude: selectedCity.lat,
        longitude: selectedCity.lng,
        name: `${selectedCity.name}, ${selectedCity.country}`
      }
    });
  };

  return (
    <div className={`p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl ${className}`}>
      <h3 className="text-xl font-bold text-white mb-6">Birth Details</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Date of Birth</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Time of Birth</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="space-y-2 relative">
          <label className="text-sm text-gray-400">Place of Birth</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            placeholder="Search city..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-[#1a1c2e] border border-white/10 rounded-lg shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
              {suggestions.map((city) => (
                <button
                  key={`${city.name}-${city.lat}`}
                  type="button"
                  onClick={() => {
                    setSelectedCity(city);
                    setSearch(city.name);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/10 transition-colors flex justify-between items-center"
                >
                  <span>{city.name}</span>
                  <span className="text-xs text-gray-500">{city.country}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg transform active:scale-[0.98] transition-all"
        >
          Update Horoscope
        </button>
      </form>
    </div>
  );
};
