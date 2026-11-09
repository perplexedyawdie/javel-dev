// Lighthouse CI: audits the built site in dist/ before deploy. Errors block the deploy; perf is a warning
// because single CI runs are noisy. Reports stay on disk (and in the Actions artifact), never public.
const fs = require('node:fs');

const posts = fs.existsSync('dist/blog')
  ? fs.readdirSync('dist/blog', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `/blog/${d.name}/`)
  : [];

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: ['/', '/blog/', '/about/', ...posts].map((p) => `http://localhost${p}`),
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        'categories:seo': ['error', { minScore: 1 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'image-alt': 'error',
        'color-contrast': 'error',
        'document-title': 'error',
        'meta-description': 'error',
        'unsized-images': 'error',
        'image-delivery-insight': 'error',
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci/reports',
    },
  },
};
