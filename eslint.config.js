export default [{
  ignores:['**/node_modules/**'],
},{
  files:['dist/*.js','scripts/*.mjs','tests/*.mjs','video/*.mjs','video/scene.js'],
  languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:Object.fromEntries([
    'window','document','location','fetch','console','setTimeout','clearTimeout','requestAnimationFrame','cancelAnimationFrame','performance','matchMedia','IntersectionObserver','CustomEvent','URL','URLSearchParams','process','Buffer','TextEncoder','AbortSignal',
  ].map(name=>[name,'readonly']))},
  rules:{'no-undef':'error','no-dupe-args':'error','no-dupe-keys':'error','no-duplicate-case':'error','no-unreachable':'error','no-unexpected-multiline':'error','valid-typeof':'error','no-cond-assign':['error','except-parens'],'constructor-super':'error'},
}];
