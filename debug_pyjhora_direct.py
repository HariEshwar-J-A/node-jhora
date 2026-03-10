#!/usr/bin/env python3
"""
debug_pyjhora_direct.py — Call PyJHora directly to get reference values
"""

import sys
sys.path.insert(0, 'E:/Code Base/Github/astrology/PyJHora/src')

from jhora.core.ephemeris import get_planet_positions
from jhora.core.panchanga import get_date_panchanga
from datetime import datetime

# J2000 epoch: 2000-01-01 12:00 UTC
dt = datetime(2000, 1, 1, 12, 0, 0)
lat, lon = 51.4779, 0.0015

print("PyJHora Planet Positions (Lahiri Ayanamsa)")
print("=" * 100)

try:
    planets = get_planet_positions(dt, lat, lon, ayanamsa_order=1)

    for p in planets:
        name = p.get('name', 'Unknown')
        lon_sid = p.get('longitude', 0)
        lat_ecl = p.get('latitude', 0)
        dist = p.get('distance', 0)
        speed = p.get('speed', 0)

        # Calculate tropical from sidereal (reverse the ayanamsa subtraction)
        ayanamsa = 23.857103  # Lahiri at J2000
        lon_trop = lon_sid + ayanamsa

        print(f"\n{name}:")
        print(f"  Sidereal: {lon_sid:.6f}°")
        print(f"  Tropical: {lon_trop:.6f}°")
        print(f"  Latitude: {lat_ecl:.6f}°")
        print(f"  Distance: {dist:.8f} AU")
        print(f"  Speed:    {speed:.6f} °/day")

except Exception as e:
    print(f"Error calling PyJHora: {e}")
    import traceback
    traceback.print_exc()
