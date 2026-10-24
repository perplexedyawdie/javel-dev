---
title: Hello, world
description: Why this site exists, and how posts work. Delete this sample once you've written your own.
date: 2026-10-01
tags: [meta]
---

This site is built from plain markdown files. To publish a post, drop a `.md` file into the `posts/` directory and rebuild.

## Front matter

Each post starts with a small YAML block:

```yaml
---
title: My post title
description: One or two sentences, used for search results and link previews.
date: 2026-10-03
tags: [kubernetes, ci]
draft: false   # set to true to hide it
---
```

The filename becomes the URL, so `posts/my-post.md` lives at `/blog/my-post/`.
