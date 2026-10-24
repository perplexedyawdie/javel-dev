---
title: Debugging OOMKilled pods in Kubernetes
description: A quick checklist for working out why a container keeps getting killed, and whether to raise the limit or fix the leak.
date: 2026-09-24
tags: [kubernetes, debugging]
---

A pod that restarts with `OOMKilled` is telling you the container went over its memory limit. Here's the short path I follow.

## Confirm it's really OOM

```bash
kubectl describe pod my-app-7c9d | grep -A5 "Last State"
```

Look for `Reason: OOMKilled` and exit code `137`.

## Compare usage to the limit

```bash
kubectl top pod my-app-7c9d --containers
```

If usage sits near the limit under normal load, the limit is too low. If it climbs steadily over time, you likely have a leak, so raising the limit only delays the problem.

## Set requests and limits deliberately

```yaml
resources:
  requests:
    memory: 256Mi
  limits:
    memory: 512Mi
```

Setting requests and limits for memory to the same value gives the pod a predictable footprint and avoids surprise evictions under node pressure.
