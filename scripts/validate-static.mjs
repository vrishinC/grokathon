import {readFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=resolve(root,'dist');
const html=await readFile(resolve(dist,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(ids).size,ids.length,'HTML IDs must be unique.');
const references=[...html.matchAll(/(?:src|href|poster|data-src)="(\.\/[^"]+)"/g)].map(match=>match[1]);
await Promise.all(references.filter(path=>!path.includes('#')).map(path=>access(resolve(dist,path))));
for(const name of ['observed-events.json','buildings.geojson','rivers.geojson','roads.geojson','places.geojson','census-block-groups.geojson','census-provenance.json','provenance.json']){
  const json=JSON.parse(await readFile(resolve(dist,'data',name),'utf8'));
  if(name.endsWith('.geojson'))assert.equal(json.type,'FeatureCollection',`${name}: expected GeoJSON`);
}
const census=JSON.parse(await readFile(resolve(dist,'data/census-block-groups.geojson'),'utf8'));
assert.equal(census.features.length,3,'Expected three documented Census block groups.');
for(const feature of census.features){
  assert.match(feature.properties.GEOID,/^37087\d{7}$/,'Haywood block-group GEOID');
  assert.equal(feature.properties.acs_year,2023);
  assert.ok(feature.properties.median_household_income>0);
  assert.ok(feature.properties.moe>0);
}
for(const name of ['aquatic-sustainability-story.mp4','aquatic-hero-loop.mp4','aquatic-story-poster.jpg','aquatic-hero-poster.jpg']){
  const [source,served]=await Promise.all([readFile(resolve(root,'public/videos',name)),readFile(resolve(dist,'videos',name))]);
  assert.ok(source.equals(served),`${name}: public and deployed copies must match`);
}
console.log(`Static build ready: ${references.length} local asset references, unique HTML IDs, geographic data and matching rendered media verified. Serve dist/; no compilation step is needed.`);
