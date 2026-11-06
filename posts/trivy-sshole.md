---
title: "Can Trivy flag SSHOLE in Alpine images with the openssh package?"
date: 2026-11-06
description: "Investigating the journey from disclosure to detection shows us how Trivy detects SSHOLE and also what can prevent it from flagging vulnerable openssh packages"
tags: [tips, trivy]
---

Yes, Trivy will flag vulnerable OpenSSH versions. These conditions need to be met for it to be flagged:

- the openssh package was installed from the Alpine repo
- Alpine maintainers published the version number of the fix to [secdb](https://secdb.alpinelinux.org/). On Alpine 3.24, that's `openssh 10.3_p1-r2`.

## How does data flow from disclosure to detection?
![Five steps from disclosure to detection: the maintainer is alerted to the OpenSSH password auth bypass, pushes the patch (384e25e6), records fixed version 10.3_p1-r2 as a secfix that lands in secdb, scanners pull it into their advisory DB, and the scan flags openssh 10.3_p1-r1 in an alpine:3.24 image.](/blog/trivy-sshole/alpine-cve-flow.png)
## How does the fix get to Trivy?

TLDR: 
1. maintainers push patch 
2. maintainers update secfix details in the APKBUILD
3. CVE + patch details pushed to secdb
4. Trivy downloads details to its DB
5. Trivy scan detects vulnerable package
### Maintainers push patched package

A maintainer creates the fix and pushes the patch to Alpine's package repo. For SSHOLE on 3.24, that's [main/openssh: fix password authentication (384e25e6)](https://gitlab.alpinelinux.org/alpine/aports/-/commit/384e25e6). 

### Maintainers push secfix details
After pushing the patch, maintainers also create what's known as a secfix. A secfix is a comment block in the package's build file (APKBUILD) that records which version patches which CVE:

```
# secfixes:
#   10.3_p1-r2:
#     - CVE-2026-123158
```

After it's merged ([1d539b51](https://gitlab.alpinelinux.org/alpine/aports/-/commit/1d539b51) for 3.24, [819ca256](https://gitlab.alpinelinux.org/alpine/aports/-/commit/819ca256416f083854095c167c495d2cc664fd57) for edge), it shows up in secdb shortly after.

### Details about the patch get stored in secdb

secdb is Alpine's security database. It's a set of JSON files, one per release and repo (e.g. `v3.24/main.json`), generated from all the secfixes in aports. For each package, it lists the CVEs that were fixed and the version that fixed them.

Here’s what that looks like:
```bash
$ curl -s https://secdb.alpinelinux.org/v3.24/main.json | jq -c '.packages[] | select(.pkg.name=="openssh") | .pkg.secfixes["10.3_p1-r2"]'
["CVE-2026-123158"]
```

### Trivy gets details about which CVE the patch fixes
Trivy pulls secdb into its own vulnerability DB. 

Scanning generally follows these steps:
- create an SBOM using the list of installed packages from the apk database
- compare the installed version against the fixed version in the Trivy vulnerability DB.

**Result:** If the installed version is lower than the fixed version, it gets flagged.

## Why would a vulnerable openssh package not get flagged?

Sometimes there's a lag between when the patch gets pushed and when the secfix gets added to secdb. In that window, scanners that depend only on secdb won't flag vulnerable versions, even though the patched version is already available.

That's what happened with SSHOLE on 3.24. The patch was pushed Nov 5 at 08:59 UTC, but the secfix wasn't added until Nov 6 at 10:34 UTC, about 25.5 hours later.

Here's what that looked like on Nov 5 at 20:35 UTC:

```bash
$ # the patched version is already in the 3.24 repo
$ curl -s https://dl-cdn.alpinelinux.org/alpine/v3.24/main/x86_64/APKINDEX.tar.gz | tar -xzO APKINDEX | awk '/^P:openssh-server$/{f=1} f&&/^V:/{print;f=0}'
V:10.3_p1-r2
$ # but secdb doesn't have the CVE yet
$ curl -s https://secdb.alpinelinux.org/v3.24/main.json | grep -c 'CVE-2026-123158'
0
$ # so the image with the vulnerable version comes back clean
$ podman exec sshole-vuln apk info -v | grep '^openssh'
openssh-keygen-10.3_p1-r1
openssh-server-10.3_p1-r1
openssh-server-common-10.3_p1-r1
$ trivy image -q -f json --input vuln.tar | jq '[.Results[].Vulnerabilities[]? | select(.VulnerabilityID=="CVE-2026-123158")] | length'
0
```

To see what this process looks like for PHP2SHELL, check out [Can Trivy flag PHP2SHELL in a container image?](/blog/trivy-php2shell/).
