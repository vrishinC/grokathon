# Census income context

`dist/data/census-block-groups.geojson` contains three whole block-group polygons from **U.S. Census Bureau TIGERweb ACS2023**, selected by intersection with the application display rectangle: west −82.89, south 35.40, east −82.80, north 35.47. The geographic vintage is January 1, 2023. Coordinates are WGS84 longitude/latitude as returned by the Census service. Full polygons extend outside the display rectangle; the income estimate describes that full block group.

The attributes are an exact GEOID join to the **2019–2023 American Community Survey 5-year estimate**, detailed table **B19013**, downloaded from the [official Census summary file](https://www2.census.gov/programs-surveys/acs/summary_file/2023/table-based-SF/data/5YRData/acsdt5y2023-b19013.dat). The universe is households. Dollar values are 2023 inflation-adjusted U.S. dollars. The [variable definitions](https://api.census.gov/data/2023/acs/acs5/groups/B19013.html) identify both the estimate and its margin of error. The margins of error use the [Census Bureau's 90% confidence level](https://www2.census.gov/programs-surveys/acs/methodology/design_and_methodology/2024/acs_design_methodology_ch12_2024.pdf).

| GEOID | Census geography | Median household income | Margin of error (90%) |
| --- | --- | ---: | ---: |
| 370879213011 | Block Group 1, Tract 9213.01 | $50,104 | ±$14,978 |
| 370879213022 | Block Group 2, Tract 9213.02 | $81,750 | ±$33,801 |
| 370879213023 | Block Group 3, Tract 9213.02 | $39,629 | ±$17,168 |

All three are in Haywood County, North Carolina (state FIPS `37`, county FIPS `087`). These estimates provide community context for the displayed area. They are not event-specific household incomes, income of individual building residents, poverty classifications, or evidence of flood disparity. Income comparison must account for the sizeable margins of error. Historical flood exposure still requires a calibrated inundation product and defensible exposure methodology.

## Data contract

Each GeoJSON feature retains its full Polygon/MultiPolygon geometry and has a string `id` equal to `properties.GEOID`.

| Property | Type | Meaning |
| --- | --- | --- |
| `GEOID` | string | 12-digit Census block-group identifier |
| `NAME` | string | Original TIGERweb block-group name |
| `display_name` | string | Name plus tract, county and state |
| `STATE`, `COUNTY`, `TRACT`, `BLKGRP` | string | Original Census geography codes |
| `median_household_income` | number or null | B19013_E001; Census API equivalent B19013_001E |
| `moe` | number or null | B19013_M001; Census API equivalent B19013_001M |
| `raw_estimate`, `raw_moe` | string | Exact source cells, retained even for missing/suppressed values |
| `income_status`, `moe_status` | string | `available` or `unavailable`; consumers must check before formatting |
| `vintage` | string | `2019–2023 ACS 5-year` |
| `acs_year` | number | 2023 release |
| `income_unit` | string | `2023 inflation-adjusted USD` |
| `moe_confidence` | number | 0.90 |
| `geometry_vintage` | string | `2023-01-01` |
| `source_url`, `geometry_source_url` | string | Public Census source links |

Missing/suppressed/capped values are retained verbatim in raw fields and become `null` in numeric fields. They must never be displayed as $0. Current selected rows contain no suppressed cells. Point estimates are not significance tests; do not assume the block groups have statistically different incomes simply from their colors.

## Refresh and provenance

Run `node scripts/fetch-census.mjs` with network access and Node.js 20 or newer. It downloads the small boundary response and the ~17 MB national B19013 table, joins only the selected block groups, and updates both data files. It fails if the response is truncated, expected columns are absent, or any boundary has no matching survey record. No Census API key or external npm dependency is needed.

For reproducible processing of previously downloaded source responses:

```sh
node scripts/fetch-census.mjs --geometry /path/to/query.geojson --table /path/to/acsdt5y2023-b19013.dat
```

`dist/data/census-provenance.json` records exact source/download URLs, SHA-256 checksums of the raw responses, selection and join methods, units, vintage, limitations, and the retrieval timestamp. Census data are public U.S. government data; retain attribution to the U.S. Census Bureau.
