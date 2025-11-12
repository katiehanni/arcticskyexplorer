# Project 3 · Interactive Visualization  
## Arctic Sky Explorer

**Question.** How do seasonal shifts in daylight, surface brightness, and sea-ice cover co-vary across the Arctic basin?

The live prototype (intended for GitHub Pages deployment) is in `index.html`. It combines a polar map with linked seasonal charts and summary panels, enabling exploratory analysis of MODIS-derived metrics for five Arctic monitoring sites.

---

### Data
- **Primary source:** NASA MODIS Terra MOD09GA (surface reflectance) and MOD10A1 (snow-ice cover) collections, accessed via the NASA GIBS API (2023 subset).
- **Processing:** We sampled nine spectral reflectance bands for each month of 2023, computed visible-light brightness composites (Bands 1–3), aggregated fractional snow/ice cover, and paired these with astronomically derived daylight hours per site.  
- **Dataset provided in repo:** `data/modis_arctic_2023.json` containing monthly aggregates for five stations (lat/lon, brightness index, daylight hours, sea ice concentration, NDVI, cloud cover).

To regenerate the JSON, consult `data/README_processing.md` (to be added in final submission) or rerun the Jupyter notebook used for batch GIBS downloads (not included in the repo due to size).

---

### Project Structure
- `index.html` — final interactive experience (polar map, linked seasonal chart, detail panel, write-up).
- `js/app.js` — D3 logic powering the interactions, dynamic queries, linked views, and tooltips.
- `data/modis_arctic_2023.json` — processed MODIS + daylight dataset used by the visualization.
- `exploratory/` — six exploratory sketches produced during ideation (static + motion prototypes).

---

### Interactions Implemented
- **Month slider + autoplay** to sweep through the annual cycle.
- **Season toggles** (Winter/Spring/Summer/Fall) to constrain exploration windows.
- **Linked site selection**: clicking a site on the map updates the seasonal profile and detail cards.
- **Details-on-demand** via hover tooltips (map nodes & seasonal chart markers).
- **Seasonal summary chart** contrasting average daylight vs. brightness across the Arctic.

---

### Local Development
1. Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).
2. All assets load locally except for the basemap (Natural Earth via `world-atlas`) which is fetched from `cdn.jsdelivr.net`.
3. No build step is required; ensure you have an internet connection for the basemap TopoJSON file.

---

### Team Roles & Effort (approx. total: 52 person-hours)
- **Data Wrangling & Aggregation:** Amrutha Potluri (12h)
- **Interaction Design & D3 Prototyping:** Audrey Chung (14h), Katie Hannigan (12h)
- **Narrative & Visual Polish:** Faline Le (8h)
- **Integration & Deployment Prep:** entire team (6h joint session)

---

### Exploratory Artifacts
All exploratory sketches remain accessible at `exploratory/exploratory.html` for reference. They capture alternative encodings (line, bar, heatmap, radial) considered during ideation.
