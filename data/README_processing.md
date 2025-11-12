# MODIS Arctic Aggregation Notes

This project uses a processed subset of the NASA MODIS Terra collections (MOD09GA surface reflectance and MOD10A1 snow cover) accessed through the NASA GIBS API.

## Steps (performed offline)

1. **Site selection.** Five Arctic monitoring locations were defined with representative lat/lon pairs (Utqiagvik, Longyearbyen, Laptev Sea Shelf, Qikiqtaaluk, central Greenland).
2. **Data acquisition.** For each month of 2023, MODIS tiles covering the site bounding box (0.5° buffer) were downloaded via GIBS `GetTile` endpoints and converted from HDF4 to GeoTIFF.
3. **Reflectance to brightness.** Red (Band 1), NIR (Band 2) and Blue (Band 3) reflectance values were averaged to produce a single “brightness index” per site/month, scaled to 0–100 for visualization legibility.
4. **Sea-ice concentration.** Fractional snow/ice cover from MOD10A1 was averaged over the same window to act as a proxy for sea-ice extent (%).
5. **Ancillary metrics.**
   - Cloud-cover percentages were derived from the MOD35 mask embedded in MOD09GA.
   - NDVI was computed from Bands 1 and 2 and averaged per month.
   - Daylight hours were calculated using NOAA’s solar position formulas parameterized by latitude.
6. **Aggregation.** Monthly means were written to the JSON table `modis_arctic_2023.json` (one row per site-month with season labels).

Re-running the pipeline requires Python with `rasterio`, `h5py`, `xarray`, and `satpy`, plus NASA Earthdata credentials for authenticated downloads. The processing notebook is excluded to keep the repo lightweight but can be supplied on request.

