export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtDate = (d) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

const link = 'underline-offset-4 hover:underline';

export function layout(site, page) {
  const url = site.url + page.path;
  const fullTitle = page.path === '/' ? page.title : `${page.title} · ${site.name}`;
  const img = page.image || '/og/site.png';
  const image = img.startsWith('http') ? img : site.url + img;
  const card = img.startsWith('/og/');
  const jsonld = JSON.stringify(page.jsonld).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="${esc(site.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="author" content="${esc(site.name)}">
<meta name="robots" content="${page.noindex ? 'noindex' : 'index, follow, max-image-preview:large'}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="${esc(site.locale)}">
<meta property="og:type" content="${page.type === 'article' ? 'article' : 'website'}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(`${page.title} · ${site.motto}`)}">
${card ? '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n' : ''}${page.type === 'article' ? `<meta property="article:published_time" content="${page.date.toISOString()}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}" href="/feed.xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-96x96.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#18181b">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${jsonld}</script>
</head>
<body class="bg-white text-zinc-700 antialiased dark:bg-zinc-950 dark:text-zinc-300">
<div class="mx-auto flex min-h-screen max-w-2xl flex-col px-6">
  <header class="flex items-center justify-between py-8 text-sm">
    <a href="/" class="font-semibold text-zinc-900 dark:text-zinc-100">${esc(site.name)}</a>
    <nav class="flex gap-5">
      <a href="/blog/" class="${link}">Blog</a>
      <a href="/about/" class="${link}">About</a>
      <a href="/feed.xml" class="${link}">RSS</a>
    </nav>
  </header>
  <main class="flex-1 pb-16">
${page.body}
  </main>
  <footer class="border-t border-zinc-200 py-8 text-sm text-zinc-500 dark:border-zinc-800">
    © ${new Date().getFullYear()} ${esc(site.name)}
  </footer>
</div>
</body>
</html>
`;
}

export const postMeta = (p) =>
  `<time datetime="${p.date.toISOString().slice(0, 10)}">${fmtDate(p.date)}</time> · ${p.readingTime} min read`;

function preview(p, h) {
  return `<li>
  <a href="${p.url}" class="group block">
    <h${h} class="font-medium text-zinc-900 group-hover:underline underline-offset-4 dark:text-zinc-100">${esc(p.title)}</h${h}>
    <p class="mt-0.5 text-sm text-zinc-500">${postMeta(p)}</p>
    <p class="mt-1.5 text-zinc-600 dark:text-zinc-400">${esc(p.description)}</p>
  </a>
</li>`;
}

// h: heading level for post titles, one below the section heading they sit under
export const previewList = (posts, h = 3) =>
  `<ul class="space-y-8">${posts.map((p) => preview(p, h)).join('\n')}</ul>`;

export function homeBody(site, latest) {
  const socials = site.socials
    .map((s) => `<a href="${esc(s.url)}" rel="me noopener" class="${link} text-zinc-900 dark:text-zinc-100">${esc(s.label)}</a>`)
    .join('\n      ');
  const avatar = (size) => esc(`${site.avatar.replace(/\.\w+$/, '')}-${size}.webp`);
  return `    <section class="flex items-center gap-5">
      <img src="${avatar(192)}" srcset="${avatar(96)} 1x, ${avatar(192)} 2x, ${avatar(288)} 3x" alt="Photo of ${esc(site.name)}" width="96" height="96" class="h-24 w-24 rounded-full object-cover">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">${esc(site.name)}</h1>
        <p class="text-zinc-500">${esc(site.tagline)}</p>
      </div>
    </section>
    <p class="mt-6 leading-relaxed">${esc(site.bio)}</p>
    <nav aria-label="Social links" class="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
      ${socials}
    </nav>
    <section class="mt-14">
      <h2 class="mb-6 text-sm font-semibold uppercase tracking-wider text-zinc-500">Latest writing</h2>
      ${latest.length ? previewList(latest) : '<p class="text-zinc-500">Nothing here yet.</p>'}
      <a href="/blog/" class="${link} mt-8 inline-block text-sm text-zinc-900 dark:text-zinc-100">All posts →</a>
    </section>`;
}

export function blogIndexBody(posts) {
  return `    <h1 class="mb-10 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Blog</h1>
    ${posts.length ? previewList(posts, 2) : '<p class="text-zinc-500">Nothing here yet.</p>'}`;
}

export function postBody(p) {
  const tags = p.tags.length
    ? ` · ${p.tags.map((t) => esc(t)).join(', ')}`
    : '';
  return `    <article>
      <header class="mb-10">
        <h1 class="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">${esc(p.title)}</h1>
        <p class="mt-2 text-sm text-zinc-500">${postMeta(p)}${tags}</p>
      </header>
      <div class="prose prose-zinc max-w-none dark:prose-invert prose-code:before:content-none prose-code:after:content-none">
${p.html}
      </div>
    </article>
    <a href="/blog/" class="${link} mt-12 inline-block text-sm">← All posts</a>`;
}

// About page: a timeline whose thread gets thicker and shifts from grey to the accent stage by stage.
// --w (thread width) and --mix (share of accent) are set per stage; the classes read them.
const thread = 'border-[color-mix(in_oklab,var(--color-emerald-600)_var(--mix),var(--color-zinc-300))] dark:border-[color-mix(in_oklab,var(--color-emerald-400)_var(--mix),var(--color-zinc-700))]';
const node = 'bg-[color-mix(in_oklab,var(--color-emerald-600)_var(--mix),var(--color-zinc-300))] dark:bg-[color-mix(in_oklab,var(--color-emerald-400)_var(--mix),var(--color-zinc-700))]';
const lineAt = 'absolute left-[7px] top-3 -bottom-2 -translate-x-1/2 border-l-[length:var(--w)]';

export function aboutBody(about) {
  const last = about.stages.length - 1;
  const stages = about.stages.map((s, i) => {
    const vars = `--w:${(1 + i * 0.5).toFixed(1)}px;--mix:${Math.round((i / last) * 100)}%`;
    const dot = i === last
      ? 'h-3.5 w-3.5 bg-emerald-600 ring-4 ring-emerald-600/20 dark:bg-emerald-400 dark:ring-emerald-400/20'
      : `h-2.5 w-2.5 left-[2px] top-[7px] ${node}`;
    return `      <li class="relative pb-10 pl-9" style="${vars}">
        <span aria-hidden="true" class="${lineAt} ${thread}"></span>
        <span aria-hidden="true" class="absolute ${i === last ? 'left-0 top-[5px]' : ''} rounded-full ${dot}"></span>
        <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">${esc(s.role)}</h3>
        <p class="mt-1 leading-relaxed">${esc(s.text)}</p>
        <p class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">${s.skills.map(esc).join(' · ')}</p>
      </li>`;
  }).join('\n');
  const n = about.next;
  return `    <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">${esc(about.title)}</h1>
    <div class="mt-6 space-y-4 leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6">
${about.html}
    </div>
    <section class="mt-14">
      <h2 class="mb-8 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">${esc(about.timeline)}</h2>
      <ol>
${stages}
        <li class="relative pl-9">
          <span aria-hidden="true" class="absolute left-[7px] top-6 bottom-0 -translate-x-1/2 border-l-2 border-dashed border-emerald-600 dark:border-emerald-400"></span>
          <span aria-hidden="true" class="absolute left-0 top-[5px] h-3.5 w-3.5 rounded-full border-2 border-emerald-600 bg-white dark:border-emerald-400 dark:bg-zinc-950"></span>
          <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">What's next?</h3>
          <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Proposed research</p>
          <p class="mt-3 font-medium text-zinc-900 dark:text-zinc-100">${esc(n.title)}</p>
          <p class="mt-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Research questions</p>
          <ol class="mt-2 list-decimal space-y-2 pl-5 leading-relaxed">
            ${n.questions.map((q) => `<li>${esc(q)}</li>`).join('\n            ')}
          </ol>
          <p class="mt-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Case study</p>
          <p class="mt-2 leading-relaxed">${esc(n.case)}</p>
        </li>
      </ol>
    </section>`;
}

export const notFoundBody =`    <h1 class="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Page not found</h1>
    <p class="mt-3"><a href="/" class="${link}">Back to the homepage</a></p>`;
