import fs from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const require = createRequire(import.meta.url);
const font = (weight) => fs.readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));
const fonts = [400, 600, 700].map((weight) => ({ name: 'Inter', data: font(weight), weight, style: 'normal' }));

// zinc palette, matching the site's dark mode
const c = { bg: '#09090b', text: '#f4f4f5', muted: '#a1a1aa', label: '#71717a', line: '#27272a' };

const h = (type, style, children) => ({ type, props: { style: { display: 'flex', ...style }, children } });

// faint tiled outline texture: coffee cups and checklists (24×24 line icons)
const cup = '<path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M7.5 2.5v2.5M10 2v3M12.5 2.5v2.5"/><path d="M3 21h14"/>';
const checklist = '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 2.5h6v2H9z"/><path d="M8 9.5l1.5 1.5L12 8.5M14 10h2.5M8 15.5l1.5 1.5L12 14.5M14 16h2.5"/>';
const texture = 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<defs><pattern id="p" width="200" height="200" patternUnits="userSpaceOnUse">
<g fill="none" stroke="${c.text}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
<g transform="translate(28 24) rotate(-8 24 24) scale(2.2)">${cup}</g>
<g transform="translate(124 118) rotate(10 24 24) scale(2)">${checklist}</g>
</g></pattern></defs>
<rect width="1200" height="630" fill="url(#p)" opacity="0.1"/></svg>`).toString('base64');

// button-style call to action that sits under the headline
const cupIcon = 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c.bg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cup}</svg>`).toString('base64');
const pill = (children) => h('div', {
  alignSelf: 'flex-start', alignItems: 'center', marginTop: 36, padding: '14px 32px 14px 24px',
  borderRadius: 9999, backgroundColor: c.text, color: c.bg, fontSize: 28, fontWeight: 600,
}, [{ type: 'img', props: { src: cupIcon, width: 32, height: 32, style: { marginRight: 14 } } }, ...children]);

let avatar;
const titleSize = (t) => (t.length <= 40 ? 72 : t.length <= 70 ? 60 : 50);
const bare = (url) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

// 1200×630 PNG preview card; with no title it's the site-wide card
export async function renderCard(site, { title, readingTime } = {}) {
  avatar ??= `data:image/jpeg;base64,${fs.readFileSync('public' + site.avatar).toString('base64')}`;
  // post cards: title up top, motto in the footer; site card: motto up top, socials in the footer
  const headline = h('div', { flexDirection: 'column' }, title
    ? [
        h('div', { fontSize: titleSize(title), fontWeight: 700, color: c.text, lineHeight: 1.15, letterSpacing: '-0.02em' }, title),
        pill([h('div', {}, site.cta.post), h('div', { marginLeft: 12, color: c.label, fontWeight: 400 }, `· ${readingTime} min read`)]),
      ]
    : [
        h('div', { fontSize: 80, fontWeight: 700, color: c.text, lineHeight: 1.1, letterSpacing: '-0.025em' }, site.motto),
        pill([h('div', {}, site.cta.site)]),
      ]);
  const footer = title
    ? [h('div', { fontSize: 30, color: c.muted }, site.motto)]
    : site.socials.filter((s) => s.onCard).map((s) => h('div', { alignItems: 'baseline', fontSize: 30 }, [
        h('div', { color: c.label, marginRight: 16 }, s.label),
        h('div', { color: c.text, fontWeight: 600 }, bare(s.url)),
      ]));

  const tree = h('div', {
    width: 1200, height: 630, flexDirection: 'column', justifyContent: 'space-between',
    boxSizing: 'border-box', padding: '64px 80px', backgroundColor: c.bg, fontFamily: 'Inter',
  }, [
    { type: 'img', props: { src: texture, width: 1200, height: 630, style: { position: 'absolute', top: 0, left: 0 } } },
    h('div', { alignItems: 'center' }, [
      { type: 'img', props: { src: avatar, width: 72, height: 72, style: { borderRadius: 9999 } } },
      h('div', { marginLeft: 24, fontSize: 32, fontWeight: 600, color: c.text }, site.name),
      h('div', { marginLeft: 'auto', fontSize: 28, color: c.label }, bare(site.url)),
    ]),
    headline,
    h('div', { borderTop: `2px solid ${c.line}`, paddingTop: 32, gap: 48 }, footer),
  ]);

  const svg = await satori(tree, { width: 1200, height: 630, fonts });
  return new Resvg(svg).render().asPng();
}

// square site icon (same design as public/favicon.svg) drawn with Inter so it renders the same everywhere
export async function renderIcon(size, { radius = 0 } = {}) {
  const tree = h('div', {
    width: size, height: size, alignItems: 'center', justifyContent: 'center', borderRadius: radius,
    backgroundColor: '#18181b', color: '#fff', fontFamily: 'Inter', fontSize: size / 2, fontWeight: 700, lineHeight: 1,
  }, 'J');
  const svg = await satori(tree, { width: size, height: size, fonts });
  return new Resvg(svg).render().asPng();
}
