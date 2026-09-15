# India PHC Map

An interactive map of India's Primary Health Centres (PHCs). Zoom and pan across India, search by name or place, filter by state or rural/urban, and click any PHC to see its details. Each PHC links to its pin, directions, and a name search in Google Maps.

## Data

The data comes from the Ministry of Health & Family Welfare's [All India Health Centres Directory](https://www.data.gov.in/catalog/all-india-health-centres-directory) (as of 7 October 2016). The map shows 28,110 PHCs with usable coordinates.

- **The data is from 2016.** Some PHCs have since been renamed (Ayushman Arogya Mandir), upgraded, or closed, and newer PHCs are missing.
- **Some pins are approximate** (orange ring on the map). They may mark a village or block centre, or a nearby facility.
- **Cleaning:**
  - Duplicate "Andhra Pradesh Old" rows are dropped.
  - Swapped latitude/longitude is corrected.
  - The 50 PHCs without usable coordinates are omitted.
- **Map IDs:** in `data/phc.js`, a PHC's map ID is its row index. Personal links depend on these IDs, so never reorder or delete rows; only append.

## Personal links

A link ending in `#a=...` highlights the PHCs assigned to one person. The part after `#` stays in the browser and is never sent to GitHub. This repository contains no names or assignment data.

## Credits

- Maps: [Leaflet](https://leafletjs.com/) and [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster).
- Tiles: street and satellite basemaps © Esri and its data partners (including © OpenStreetMap contributors).
- Basemap boundaries are not authenticated by the Survey of India.
