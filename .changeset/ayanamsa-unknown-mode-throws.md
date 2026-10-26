---
'@node-jhora/core': patch
'@node-jhora/api': patch
---

Reject unknown and unsupported Swiss Ephemeris ayanamsa mode numbers instead of silently falling back to True Chitrapaksha. API and settings validation return 4xx for invalid `customAyanamsaMode`.
