// Checks every published post in posts/ against the house shape (front matter, GEO question headings,
// alt text, code fences, internal links). Exits 1 on any problem so CI blocks the deploy.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const site = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));
const KEYS = ['title', 'date', 'description', 'tags', 'image', 'slug', 'draft'];
const CATEGORIES = ['tips', 'experiment'];
const TERMINAL = ['bash', 'sh', 'shell', 'console'];
const MAX_TITLE = 70; // Bing flags longer <title>s
const DESCRIPTION = [50, 160];

// same as build.js
const slugify = (s) =>
  s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const files = fs.readdirSync('posts').filter((f) => f.endsWith('.md'));
const posts = files.map((file) => {
  const raw = fs.readFileSync(path.join('posts', file), 'utf8');
  const { data, content } = matter(raw);
  return { file, raw, data, content, slug: slugify(data.slug || file.replace(/\.md$/, '')) };
});
const slugs = new Set(posts.filter((p) => !p.data.draft).map((p) => p.slug));

const problems = [];
let checked = 0;

for (const { file, raw, data, content } of posts) {
  if (data.draft) continue;
  checked++;
  const fail = (rule, msg) => problems.push(`posts/${file}: ${rule}: ${msg}`);

  // --- front matter ---
  for (const k of Object.keys(data)) if (!KEYS.includes(k)) fail('front-matter', `unknown key "${k}" (allowed: ${KEYS.join(', ')})`);

  if (typeof data.title !== 'string' || !data.title.trim()) fail('title', 'missing');
  else {
    const full = `${data.title} · ${site.name}`;
    if (full.length > MAX_TITLE) fail('title', `page title "${full}" is ${full.length} chars (max ${MAX_TITLE})`);
  }

  const rawDate = raw.match(/^date:\s*["']?([^"'\n]*)["']?\s*$/m)?.[1];
  if (!rawDate) fail('date', 'missing');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || isNaN(new Date(rawDate))) fail('date', `"${rawDate}" is not a valid YYYY-MM-DD date`);

  if (typeof data.description !== 'string' || !data.description.trim()) fail('description', 'missing');
  else if (data.description.length < DESCRIPTION[0] || data.description.length > DESCRIPTION[1])
    fail('description', `${data.description.length} chars (want ${DESCRIPTION[0]}-${DESCRIPTION[1]})`);

  if (!Array.isArray(data.tags)) fail('tags', `missing (one of ${CATEGORIES.join('/')} plus 1-2 tech tags)`);
  else {
    const cats = data.tags.filter((t) => CATEGORIES.includes(t));
    const tech = data.tags.filter((t) => !CATEGORIES.includes(t));
    if (cats.length !== 1) fail('tags', `need exactly one category (${CATEGORIES.join(' or ')}), got ${cats.length}`);
    if (tech.length < 1 || tech.length > 2) fail('tags', `need 1-2 tech tags, got ${tech.length}`);
  }

  // --- body ---
  const lines = content.split('\n');
  const offset = raw.split('\n').length - lines.length; // line numbers in the file, not the body
  let fence = null; // { lang, start, terminal }
  let prevLevel = 1; // the template renders the title as the h1

  lines.forEach((line, i) => {
    const at = `line ${i + 1 + offset}`;
    const open = line.match(/^\s*(```|~~~)\s*([\w-]*)/);
    if (open) {
      if (!fence) fence = { marker: open[1], lang: open[2], start: at, terminal: false };
      else if (line.trim().startsWith(fence.marker)) {
        if (fence.terminal && !TERMINAL.includes(fence.lang))
          fail('code-fence', `${fence.start}: block has "$ " commands, tag it \`\`\`bash`);
        fence = null;
      }
      return;
    }
    if (fence) {
      if (line.startsWith('$ ')) fence.terminal = true;
      return;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1) fail('heading', `${at}: no "# " in the body, the title comes from front matter`);
      if (level === 2 && !text.endsWith('?')) fail('heading', `${at}: "## ${text}" should be a question ending in "?"`);
      if (level > prevLevel + 1) fail('heading', `${at}: jumps from h${prevLevel} to h${level}`);
      prevLevel = level;
    }

    for (const [, alt, src] of line.matchAll(/!\[([^\]]*)\]\(\s*([^)\s]+)[^)]*\)/g)) {
      if (!alt.trim()) fail('image', `${at}: ${src} has no alt text`);
      if (src.startsWith('/') && !fs.existsSync(path.join('public', src))) fail('image', `${at}: ${src} not found in public/`);
    }

    const links = line.replace(/!\[[^\]]*\]\([^)]*\)/g, ''); // images are checked above
    for (const [, slug] of links.matchAll(/\]\(\s*\/blog\/([^/)#\s]+)\/?[^)]*\)/g)) {
      if (!slugs.has(slug)) fail('link', `${at}: /blog/${slug}/ is not a published post`);
    }
  });
  if (fence) fail('code-fence', `${fence.start}: code block is never closed`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n✗ ${problems.length} problem(s) in ${checked} post(s)`);
  process.exit(1);
}
console.log(`✓ ${checked} post(s) pass`);
