# Implementation status

The existing static explorer remains the application's core. This pass adds a complete landing story, explorer controls and income context, and a purpose-built animated film. It does not replace the research data that must still be produced before this can claim calibrated flood depths or affected-population estimates.

## Delivered

| Area | Implemented behavior |
| --- | --- |
| Landing page | Cinematic hero with original landscape loop, historical peak summary, source ribbon, direct explorer entry, and visible research status |
| Story | Interactive coarse-to-fine scale illustration, five keyboard-operable methodology tabs, conceptual HAND water-height slider, event comparison, community uncertainty chart, impact section, and closing navigation |
| Existing explorer | Real streamed Cesium terrain/imagery, 1,310 building footprints, mapped waterways/roads, event switching, observed playback, map layer switches, exaggeration, view controls, valley tour, and original asset preview retained |
| Explorer additions | Jump-to-peak, selected gauge-stage reading, peak marker, 0.5×/1×/2×/4× playback, searchable building list, previous/next inspection, map keyboard controls, and Flood / Income / Combined modes |
| Prediction comparison | Local JSON import retained; observed and imported model hydrographs share axes. Peak error, timing error, NSE and paired-sample coverage are computed from supplied data. No model is bundled. |
| Census context | Three authoritative 2019–2023 ACS B19013 block-group estimates with 90% margins of error; full January 1, 2023 TIGERweb geometry, exact GEOID join, raw values, source links and reproducible fetch script |
| Responsive and accessible UI | Compact mobile navigation, expandable explorer controls, responsive map/details, visible focus, skip link, semantic tab controls, motion pause, reduced-motion behavior, and video controls/captions |
| Video | Finished 34-second 1080 × 1920 H.264/AAC film; 10-second 1920 × 1080 silent hero loop; posters; source in `video/`; playable film and download on the page |
| Reproducibility | Separate pinned video dependencies, deterministic scene/audio renderers, static validation/build scripts, scientific/data contracts, and asset credits |

Both film deliverables are present in the requested `public/videos/` directory and in `dist/videos/` for static serving. Render and preview instructions are in [video/README.md](../video/README.md). The 3D film and hero use procedural illustrative scenery; the geographic explorer uses the real datasets listed in [ASSET_CREDITS.md](../ASSET_CREDITS.md).

## Actual data and illustrative elements

| Component | Data status |
| --- | --- |
| USGS Fred and Helene flow/stage | Real observations: 384 Fred samples and 1,093 Helene samples; original qualifiers and timestamps retained |
| Event peak captions | Recorded USGS peaks: Fred 19,800 cfs / 16.03 ft; Helene 15,900 cfs / 14.10 ft |
| Explorer terrain/imagery | Real runtime Esri services; not a bundled USGS 3DEP 10 m elevation raster |
| Buildings and river/road geometry | Real Microsoft/Esri and OpenStreetMap data; mixed-date building inventory, no verified building heights |
| Income context | Real ACS estimates in 2023 dollars; area-level context, not individual household income or event-specific exposure |
| Explorer water extent | Illustrative buffer driven by the selected flow and normalized by its event peak; no calibrated depth values |
| Resolution and HAND graphics | Concept diagrams; ~10 m depth resolution remains a research target |
| Video terrain, structures and water | Original procedural illustration; not surveyed Cruso locations or reconstructed historical inundation |
| Prediction metrics | Available only after a user imports model samples. Calculated on matched samples, with explicit coverage and unavailable states. |

The full corridor formula and scientific caveats are preserved in [README.md](../README.md). In particular, gauge stage refers to a local gauge datum; it is not water depth at a home. Both historical events intentionally reach the same peak illustrative corridor width. This cannot establish which flood inundated more land.

## Research still required

1. **Calibrated depth:** delineated basin, conditioned terrain, drainage/HAND, explicit coordinate and vertical references, reach-specific rating/calibration relationships, and validated depth rasters or polygons. Bridges, debris, and hydraulic structures need explicit treatment.
2. **Trained prediction:** weather/basin inputs, documented NeuralHydrology training, independent held-out historical events, and a reproducible model artifact. The current import/metrics interface does not constitute a trained or validated model.
3. **Population exposure:** documented population and occupancy data, appropriate geographic vintage, building allocation assumptions, uncertainty, and intersection with calibrated flood depths.
4. **Disparity analysis:** validated exposure joined to socioeconomic context, uncertainty-aware comparisons, and a clear distinction between community estimates and individual households.
5. **Historical validation:** event-specific high-water marks or dated aerial evidence, suitable evaluation metrics, and assessment of source coverage and missing data.

No flooded-building count, people-affected total, household income assignment, depth value, or prediction skill claim is invented to fill these gaps. The application remains a research demonstration; National Weather Service and local emergency management information are the sources for operational warnings.

## Checks and runtime requirements

`npm test` runs the hydrology/import/comparison tests. `npm run lint` runs ESLint after installing development dependencies; `npm run check` checks application JavaScript syntax; `npm run build` validates the deployable static files. There is no TypeScript compiler step in this JavaScript repository. The website itself requires a static HTTP server and network access to its runtime imagery, terrain, CDN engine and font services. It needs no API keys or `.env` file.

Census processing was checked for three unique matching GEOIDs, exact retained geometry, consistency between raw/numeric values, and provenance counts. Video technical specifications and rendering workflow are documented in its README. Browser layout and playback remain dependent on device WebGL capability and external service availability; graceful terrain and map failures are exposed in the UI.

## Deployment

No hosted preview, publication, or Cloud Run deployment was performed. Serve `dist/` with the existing static-server or Docker workflow. `public/videos/` holds the requested source deliverables; the website uses the matching `dist/videos/` copies.
