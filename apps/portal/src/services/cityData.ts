export interface City {
  name: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
}

export const CITIES: City[] = [
  { name: 'Chennai', country: 'India', lat: 13.0827, lng: 80.2707, timezone: 'Asia/Kolkata' },
  { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, timezone: 'Europe/London' },
  { name: 'New York', country: 'USA', lat: 40.7128, lng: -74.0060, timezone: 'America/New_York' },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, timezone: 'Asia/Tokyo' },
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093, timezone: 'Australia/Sydney' },
  { name: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708, timezone: 'Asia/Dubai' },
  { name: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198, timezone: 'Asia/Singapore' },
  { name: 'San Francisco', country: 'USA', lat: 37.7749, lng: -122.4194, timezone: 'America/Los_Angeles' },
  { name: 'Berlin', country: 'Germany', lat: 52.5200, lng: 13.4050, timezone: 'Europe/Berlin' },
  { name: 'New Delhi', country: 'India', lat: 28.6139, lng: 77.2090, timezone: 'Asia/Kolkata' },
  { name: 'Mumbai', country: 'India', lat: 19.0760, lng: 72.8777, timezone: 'Asia/Kolkata' },
  { name: 'Bengaluru', country: 'India', lat: 12.9716, lng: 77.5946, timezone: 'Asia/Kolkata' },
  { name: 'Hyderabad', country: 'India', lat: 17.3850, lng: 78.4867, timezone: 'Asia/Kolkata' },
  { name: 'Ahmedabad', country: 'India', lat: 23.0225, lng: 72.5714, timezone: 'Asia/Kolkata' },
  { name: 'Pune', country: 'India', lat: 18.5204, lng: 73.8567, timezone: 'Asia/Kolkata' },
  { name: 'Surat', country: 'India', lat: 21.1702, lng: 72.8311, timezone: 'Asia/Kolkata' },
  { name: 'Kolkata', country: 'India', lat: 22.5726, lng: 88.3639, timezone: 'Asia/Kolkata' },
  { name: 'Lucknow', country: 'India', lat: 26.8467, lng: 80.9462, timezone: 'Asia/Kolkata' },
  { name: 'Jaipur', country: 'India', lat: 26.9124, lng: 75.7873, timezone: 'Asia/Kolkata' }
];

export function searchCities(query: string): City[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return CITIES.filter(c => 
    c.name.toLowerCase().includes(q) || 
    c.country.toLowerCase().includes(q)
  );
}
