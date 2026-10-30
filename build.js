import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { layout, postBody, homeBody, blogIndexBody, notFoundBody, esc } from './templates.js';
import sharp from 'sharp';
import { renderCard, renderIcon } from './og.js';

const site = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));
site.url = site.url.replace(/\/$/, '');
const DIST = 'dist';

// --- markdown setup ---------------------------------------------------------
const slugify = (s) =>
  s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let usedIds = new Set();
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight: (code, lang) => {
      // terminal sessions: highlight `$ ` command lines as bash, leave their output as plain text
      if (/^(bash|sh|shell|console)$/.test(lang) && /^\$ /m.test(code)) {
        return code.split('\n').map((l) => l.startsWith('$ ')
          ? `<span class="hljs-prompt">$</span> ${hljs.highlight(l.slice(2), { language: 'bash' }).value}`
          : `<span class="hljs-output">${esc(l)}</span>`).join('\n');
      }
      return hljs.highlight(code, { language: hljs.getLanguage(lang) ? lang : 'plaintext' }).value;
    },
  }),
  {
    renderer: {
      image({ href, title, text }) {
        const t = title ? ` title="${esc(title)}"` : '';
        return `<img src="${esc(href)}" alt="${esc(text)}"${t} loading="lazy" decoding="async">`;
      },
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        let id = slugify(inner) || 'section';
        for (let i = 2; usedIds.has(id); i++) id = `${slugify(inner)}-${i}`;
        usedIds.add(id);
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
    },
  },
);

// --- load posts -------------------------------------------------------------
function loadPosts() {
  const posts = [];
  for (const file of fs.readdirSync('posts').filter((f) => f.endsWith('.md'))) {
    const { data, content } = matter(fs.readFileSync(path.join('posts', file), 'utf8'));
    if (data.draft) continue;
    if (!data.title) throw new Error(`posts/${file}: missing "title" in front matter`);
    if (!data.date) throw new Error(`posts/${file}: missing "date" in front matter (YYYY-MM-DD)`);
    const date = new Date(data.date);
    if (isNaN(date)) throw new Error(`posts/${file}: invalid date "${data.date}"`);

    usedIds = new Set();
    const html = marked.parse(content);
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const slug = slugify(data.slug || file.replace(/\.md$/, ''));
    posts.push({
      slug,
      url: `/blog/${slug}/`,
      title: data.title,
      description: data.description || text.slice(0, 157).trimEnd() + '…',
      date,
      tags: data.tags || [],
      image: data.image,
      readingTime: Math.max(1, Math.round(text.split(' ').length / 220)),
      html,
    });
  }
  return posts.sort((a, b) => b.date - a.date);
}

// --- output helpers ---------------------------------------------------------
const write = (rel, content) => {
  const out = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content);
};

const person = {
  '@type': 'Person',
  name: site.name,
  url: site.url,
  jobTitle: site.tagline,
  image: site.url + site.avatar,
  sameAs: site.socials.map((s) => s.url).filter((u) => u.startsWith('http')),
};

// --- build ------------------------------------------------------------------
const posts = loadPosts();

// keep dist/styles.css so `dev` (tailwind --watch) isn't disrupted
fs.mkdirSync(DIST, { recursive: true });
for (const e of fs.readdirSync(DIST)) if (e !== 'styles.css') fs.rmSync(path.join(DIST, e), { recursive: true });
if (fs.existsSync('public')) fs.cpSync('public', DIST, { recursive: true });

// social preview cards: one for the site, one per post unless front matter sets `image`
write('og/site.png', await renderCard(site));
for (const p of posts.filter((p) => !p.image)) {
  write(`og/${p.slug}.png`, await renderCard(site, { title: p.title, readingTime: p.readingTime }));
  p.image = `/og/${p.slug}.png`;
}

// icons: PNG/ICO favicons (Google ignores SVG), apple-touch-icon, web manifest
const radius = (size) => Math.round(size / 4);
const ico = (pngs) => {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size, e);
    head.writeUInt8(size, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
};
write('favicon.ico', ico(await Promise.all([32, 48].map(async (size) => ({ size, data: await renderIcon(size, { radius: radius(size) }) })))));
write('favicon-96x96.png', await renderIcon(96, { radius: radius(96) }));
write('apple-touch-icon.png', await renderIcon(180));
for (const size of [192, 512]) write(`icon-${size}.png`, await renderIcon(size));
write('site.webmanifest', JSON.stringify({
  name: site.name,
  short_name: site.name,
  start_url: '/',
  display: 'minimal-ui',
  background_color: '#18181b',
  theme_color: '#18181b',
  icons: [192, 512].map((size) => ({ src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png' })),
}, null, 2));

// avatar at 1x/2x/3x of its 96px display size, so the home page doesn't download the full photo
const avatarBase = site.avatar.replace(/\.\w+$/, '');
for (const size of [96, 192, 288]) {
  write(`${avatarBase}-${size}.webp`, await sharp('public' + site.avatar).resize(size, size).webp({ quality: 80 }).toBuffer());
}

write('index.html', layout(site, {
  path: '/',
  title: site.title,
  description: site.description,
  image: '/og/site.png',
  body: homeBody(site, posts.slice(0, 3)),
  jsonld: { '@context': 'https://schema.org', '@graph': [
    person,
    { '@type': 'WebSite', name: site.name, url: site.url, description: site.description },
  ] },
}));

write('blog/index.html', layout(site, {
  path: '/blog/',
  title: 'Blog',
  description: `Posts by ${site.name}. ${site.description}`,
  image: '/og/site.png',
  body: blogIndexBody(posts),
  jsonld: { '@context': 'https://schema.org', '@type': 'Blog', name: `${site.name} — Blog`, url: `${site.url}/blog/`, author: person },
}));

for (const p of posts) {
  write(`blog/${p.slug}/index.html`, layout(site, {
    path: p.url,
    type: 'article',
    title: p.title,
    description: p.description,
    date: p.date,
    image: p.image,
    body: postBody(p),
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.description,
      datePublished: p.date.toISOString(),
      dateModified: p.date.toISOString(),
      url: site.url + p.url,
      mainEntityOfPage: site.url + p.url,
      image: p.image ? (p.image.startsWith('http') ? p.image : site.url + p.image) : site.url + site.avatar,
      keywords: p.tags.join(', '),
      author: person,
    },
  }));
}

write('404.html', layout(site, {
  path: '/404.html', title: 'Page not found', description: 'Page not found.', noindex: true, image: '/og/site.png',
  body: notFoundBody, jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Page not found' },
}));

const day = (d) => d.toISOString().slice(0, 10);
const urls = [
  { loc: '/', lastmod: posts[0] && day(posts[0].date) },
  { loc: '/blog/', lastmod: posts[0] && day(posts[0].date) },
  ...posts.map((p) => ({ loc: p.url, lastmod: day(p.date) })),
];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${site.url}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`);

write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(site.name)}</title>
  <link>${site.url}/</link>
  <description>${esc(site.description)}</description>
  <language>${site.language}</language>
  <atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml"/>
${posts.map((p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${site.url}${p.url}</link>
    <guid isPermaLink="true">${site.url}${p.url}</guid>
    <pubDate>${p.date.toUTCString()}</pubDate>
    <description>${esc(p.description)}</description>
    <content:encoded xmlns:content="http://purl.org/rss/1.0/modules/content/"><![CDATA[${p.html.replaceAll(']]>', ']]]]><![CDATA[>')}]]></content:encoded>
  </item>`).join('\n')}
</channel>
</rss>
`);

console.log(`Built ${posts.length} post(s) → ${DIST}/`);
