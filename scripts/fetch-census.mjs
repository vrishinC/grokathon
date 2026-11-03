#!/usr/bin/env node
/**
 * Refresh the Census context layer using public, authoritative Census services.
 * Run: node scripts/fetch-census.mjs
 * Offline replay: node scripts/fetch-census.mjs --geometry /path/to/query.geojson
 *                --table /path/to/acsdt5y2023-b19013.dat
 * No Census API key or third-party package is required.
 */
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist', 'data');
const bbox = [-82.89, 35.40, -82.80, 35.47];
const geometryService = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2023/MapServer/10';
const geometryUrl = `${geometryService}/query?${new URLSearchParams({
  where: "STATE='37' AND COUNTY='087'",
  geometry: bbox.join(','),
  geometryType: 'esriGeometryEnvelope',
  inSR: '4326',
  spatialRel: 'esriSpatialRelIntersects',
  outFields: 'GEOID,NAME,STATE,COUNTY,TRACT,BLKGRP',
  returnGeometry: 'true',
  outSR: '4326',
  f: 'geojson',
})}`;
const tableUrl = 'https://www2.census.gov/programs-surveys/acs/summary_file/2023/table-based-SF/data/5YRData/acsdt5y2023-b19013.dat';
const tablePage = 'https://data.census.gov/table/ACSDT5Y2023.B19013';
const variablePage = 'https://api.census.gov/data/2023/acs/acs5/groups/B19013.html';
const args = process.argv.slice(2);

function fileArgument(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${name} requires a file path.`);
  return args[index + 1];
}

async function readSource(url, localPath) {
  if (localPath) return readFile(localPath, 'utf8');
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Census download failed: HTTP ${response.status} for ${url}`);
  return response.text();
}

// ACS missing/suppressed/capped cells must never become a displayed dollar value.
// Preserve the exact source cell separately, including blanks and sentinel text.
function usableNumber(raw) {
  if (typeof raw !== 'string' || !/^\d+(?:\.\d+)?$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

const [geometryText, tableText] = await Promise.all([
  readSource(geometryUrl, fileArgument('--geometry')),
  readSource(tableUrl, fileArgument('--table')),
]);
const sourceGeometry = JSON.parse(geometryText);
if (sourceGeometry.type !== 'FeatureCollection' || !sourceGeometry.features?.length) {
  throw new Error('Census geometry service did not return a nonempty FeatureCollection.');
}
if (sourceGeometry.exceededTransferLimit) throw new Error('Census geometry query was truncated.');

const lines = tableText.replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
const headers = lines.shift().split('|');
const geoIndex = headers.indexOf('GEO_ID');
const estimateIndex = headers.indexOf('B19013_E001');
const moeIndex = headers.indexOf('B19013_M001');
if ([geoIndex, estimateIndex, moeIndex].some(index => index < 0)) {
  throw new Error('Unexpected Census summary-file columns.');
}
const requestedGeoids = new Set(sourceGeometry.features.map(feature => feature.properties.GEOID));
const rows = new Map();
for (const line of lines) {
  const cells = line.split('|');
  const geo = cells[geoIndex];
  if (!geo?.startsWith('1500000US')) continue;
  const geoid = geo.slice('1500000US'.length);
  if (requestedGeoids.has(geoid)) {
    if (rows.has(geoid)) throw new Error(`Duplicate Census record for ${geoid}.`);
    rows.set(geoid, cells);
  }
}

const features = sourceGeometry.features.map(feature => {
  const { GEOID, NAME, STATE, COUNTY, TRACT, BLKGRP } = feature.properties;
  if (!/^37087\d{7}$/.test(GEOID)) throw new Error(`Unexpected geography ${GEOID}.`);
  const row = rows.get(GEOID);
  if (!row) throw new Error(`No ACS income record matched block group ${GEOID}.`);
  const rawEstimate = row[estimateIndex] ?? '';
  const rawMoe = row[moeIndex] ?? '';
  const median = usableNumber(rawEstimate);
  const moe = usableNumber(rawMoe);
  return {
    type: 'Feature',
    id: GEOID,
    geometry: feature.geometry,
    properties: {
      GEOID, NAME, STATE, COUNTY, TRACT, BLKGRP,
      display_name: `${NAME}, Census Tract ${Number(TRACT.slice(0, 4))}.${TRACT.slice(4)}, Haywood County, North Carolina`,
      median_household_income: median,
      moe,
      raw_estimate: rawEstimate,
      raw_moe: rawMoe,
      income_status: median === null ? 'unavailable' : 'available',
      moe_status: moe === null ? 'unavailable' : 'available',
      vintage: '2019–2023 ACS 5-year',
      acs_year: 2023,
      income_unit: '2023 inflation-adjusted USD',
      moe_confidence: 0.90,
      geometry_vintage: '2023-01-01',
      source_url: tablePage,
      geometry_source_url: geometryService,
    },
  };
}).sort((a, b) => a.id.localeCompare(b.id));

const collection = { type: 'FeatureCollection', name: 'ACS 2019–2023 median household income context', features };
const hash = text => createHash('sha256').update(text).digest('hex');
const limitations = [
  'These are 2019–2023 pooled ACS household-income estimates, in 2023 inflation-adjusted dollars. They are contextual estimates, not income measured during either flood event.',
  'A block-group median does not establish the income of any particular resident, household, or building. Do not attach it to an individual property as household income.',
  'Margins of error use the Census Bureau standard 90% confidence level. Differences in point estimates do not by themselves establish statistically significant differences.',
  'Whole block-group geometries that intersect the display rectangle are retained. The source estimates describe the whole block group, including areas outside the rectangle.',
  'The display rectangle is not a delineated watershed. The illustrative river corridor is not calibrated inundation. Neither permits a conclusion about historical flooding or income-specific flood exposure.',
  'No population allocation, households affected, depth, damage, poverty status, or disproportionate-impact score is inferred from this income table.',
  'Raw estimate and margin-of-error cells are retained. Missing, suppressed, bounded, or other nonnumeric values render as null, never as zero income.',
];
const provenance = {
  retrieved_at: new Date().toISOString(),
  title: 'ACS block-group income context for the Cruso display area',
  status: 'real Census estimates; contextual, not flood exposure',
  display_bbox_wgs84: bbox,
  bbox_order: 'west,south,east,north',
  geographic_coverage: { state_fips: '37', county_fips: '087', county_name: 'Haywood County, North Carolina', selection: 'Block groups intersecting the display rectangle; full polygons retained.' },
  counts: { block_groups: features.length, available_income: features.filter(f => f.properties.income_status === 'available').length },
  period: { acs_release: 2023, pooled_years: [2019, 2020, 2021, 2022, 2023], income_dollar_year: 2023, geometry_vintage: '2023-01-01' },
  sources: [
    { id: 'acs_income', title: 'U.S. Census Bureau, 2023 ACS 5-Year Detailed Table B19013', url: tablePage, download_url: tableUrl, variables_url: variablePage, sha256: hash(tableText), fields: { median_household_income: 'B19013_E001 (API equivalent B19013_001E)', moe: 'B19013_M001 (API equivalent B19013_001M)' }, universe: 'Households', unit: '2023 inflation-adjusted USD', margin_of_error_confidence: 0.90 },
    { id: 'census_geometry', title: 'U.S. Census Bureau TIGERweb ACS2023 Census Block Groups', url: geometryService, download_url: geometryUrl, sha256: hash(geometryText), source_crs: 'EPSG:3857', requested_output_crs: 'EPSG:4326', geometry_processing: 'Census service transforms returned geometry to WGS84. All returned coordinate values and whole polygons retained without simplification or clipping.' },
    { id: 'summary_file_method', title: 'Census ACS Summary File format', url: 'https://www.census.gov/programs-surveys/acs/data/summary-file.Getting_Started.html' },
    { id: 'moe_method', title: 'ACS survey design and methodology, variance estimation', url: 'https://www2.census.gov/programs-surveys/acs/methodology/design_and_methodology/2024/acs_design_methodology_ch12_2024.pdf' },
  ],
  join: 'Exact 12-digit TIGERweb GEOID matched to the suffix of ACS GEO_ID 1500000US + GEOID. No spatial allocation of survey estimates.',
  source_access_note: 'The public Census API returned a Missing Key page. The official public Census summary-file download supplies the same table without an API key.',
  license: 'U.S. Census Bureau public data; retain source attribution.',
  limitations,
};

await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'census-block-groups.geojson'), JSON.stringify(collection));
await writeFile(path.join(output, 'census-provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`Saved ${features.length} matched Census block groups to ${output}.`);
for (const { properties: p } of features) console.log(`${p.GEOID}: ${p.median_household_income} +/- ${p.moe}`);
