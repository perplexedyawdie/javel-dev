---
title: "Can Trivy flag PHP2SHELL in a container image?"
date: 2026-10-30
---

Trivy detects vulnerable packages by first creating a Software Bill of Materials that contains all the packages installed on the distro via the package manager from the official distro pkg repo. It then checks the packages against the CVE advisory feed for the specific distro & release.

![](/blog/trivy-php2shell/image-1.png)

This process seems pretty straightforward, however on closer look, there are actually a few conditions that must be met before a vulnerable pkg can be flagged. Let’s approach these as a series of questions that will provide all the details needed to evaluate a pkg.


## What packages are in the image?

![](/blog/trivy-php2shell/image-2.png)

Trivy only detects packages that are recorded in the package DB. Packages can be invisible to Trivy for two reasons:
- if the package was built from source 
- if the package DB was removed from the image

Here’s what this looks like in practice:
```bash
$ # holds: php8.3 installed from .deb, so dpkg knows about it
$ docker compose exec c1-holds php -v | head -1
PHP 8.3.6 (cli) (built: Oct  7 2026 18:06:38) (NTS)
$ docker compose exec c1-holds dpkg -l 'php8.3*' | awk '/^ii/ {print $2, $3}'
php8.3-cli 8.3.6-0ubuntu0.24.04.12
php8.3-common 8.3.6-0ubuntu0.24.04.12
php8.3-opcache 8.3.6-0ubuntu0.24.04.12
php8.3-readline 8.3.6-0ubuntu0.24.04.12
$ trivy image -q --list-all-pkgs -f json php2shell:c1-holds | jq -r '.Results[].Packages[].Name' | grep php
php-common
php8.3-cli
php8.3-common
php8.3-opcache
php8.3-readline
$ # broken: same PHP built from source, dpkg never hears about it
$ docker compose exec c1-broken-source php -v | head -1
PHP 8.3.6 (cli) (built: Oct 30 2026 12:58:49) (NTS)
$ docker compose exec c1-broken-source dpkg -l 'php8.3*'
dpkg-query: no packages found matching php8.3*
$ trivy image -q --list-all-pkgs -f json php2shell:c1-broken-source | jq -r '.Results[].Packages[].Name' | grep php
$ # broken: installed from .deb, then /var/lib/dpkg deleted
$ docker compose exec c1-broken-no-db php -v | head -1
PHP 8.3.6 (cli) (built: Oct  7 2026 18:06:38) (NTS)
$ docker compose exec c1-broken-no-db dpkg -l 'php8.3*'
dpkg-query: no packages found matching php8.3*
$ trivy image php2shell:c1-broken-no-db 2>&1 | grep -o 'No OS package is detected.*'
No OS package is detected. Make sure you haven't deleted any files that contain information about the installed packages.
```


## Where does Trivy get CVE data?

![](/blog/trivy-php2shell/image-3.png)

A security advisory feed is published for each distro and it’s associated release. Trivy pulls this data to know which source packages to match against what’s captured in the SBOM.

This is what it looks like:
```bash
$ # holds: os-release says Ubuntu 24.04
$ docker compose exec c2-holds grep -E '^(ID|VERSION_ID)=' /etc/os-release
VERSION_ID="24.04"
ID=ubuntu
$ trivy image -q -f json php2shell:c2-holds | jq -c .Metadata.OS
{"Family":"ubuntu","Name":"24.04"}
$ trivy image -q -f json php2shell:c2-holds | grep -c '"VulnerabilityID": "CVE-2026-109618"'
4
$ # broken: os-release says fakeos 1.0, lsb-release and debian_version removed
$ docker compose exec c2-broken grep -E '^(ID|VERSION_ID)=' /etc/os-release
ID=fakeos
VERSION_ID="1.0"
$ docker compose exec c2-broken ls /etc/lsb-release /etc/debian_version
ls: cannot access '/etc/lsb-release': No such file or directory
ls: cannot access '/etc/debian_version': No such file or directory
$ trivy image -q -f json php2shell:c2-broken | jq -c .Metadata.OS
{"Family":"none","Name":""}
$ trivy image -q -f json php2shell:c2-broken | grep -c '"VulnerabilityID": "CVE-2026-109618"'
0
```

## Are all detected packages scanned?

![](/blog/trivy-php2shell/image-4.png)

Packages can either be installed from local sources, pulled from official distro owned repos or 3rd pary repos. Trivy scans packages that are sourced from distro owned repos. On Ubuntu, it determines this by checking if the specified Maintainer exists on a provided deny list.

Here’s what that looks like:
```bash
$ # holds: php8.3-* maintained by Ubuntu
$ docker compose exec c3-holds dpkg-query -W -f='${Package}: ${Maintainer}\n' 'php8.3-*' | grep @
php8.3-cli: Ubuntu Developers <ubuntu-devel-discuss@lists.ubuntu.com>
php8.3-common: Ubuntu Developers <ubuntu-devel-discuss@lists.ubuntu.com>
php8.3-opcache: Ubuntu Developers <ubuntu-devel-discuss@lists.ubuntu.com>
php8.3-readline: Ubuntu Developers <ubuntu-devel-discuss@lists.ubuntu.com>
$ trivy image --debug php2shell:c3-holds 2>&1 | grep -o 'Skipping third-party packages.*'
$ trivy image -q -f json php2shell:c3-holds | grep -c '"VulnerabilityID": "CVE-2026-109618"'
4
$ # broken (simulated): same packages, Maintainer rewritten to Docker's
$ docker compose exec c3-broken dpkg-query -W -f='${Package}: ${Maintainer}\n' 'php8.3-*' | grep @
php8.3-cli: Docker <support@docker.com>
php8.3-common: Docker <support@docker.com>
php8.3-opcache: Docker <support@docker.com>
php8.3-readline: Docker <support@docker.com>
$ trivy image --debug php2shell:c3-broken 2>&1 | grep -o 'Skipping third-party packages.*'
Skipping third-party packages   packages=[php8.3-cli php8.3-common php8.3-opcache php8.3-readline]
$ trivy image -q -f json php2shell:c3-broken | grep -c '"VulnerabilityID": "CVE-2026-109618"'
0
```

## When is a package vulnerable?

![](/blog/trivy-php2shell/image-5.png)

Advisory releases are updated with CVE’s until they reach end of life. Trivy will flag all relevant CVE’s detected using the advisory release associated with the distro. In this case, since Ubuntu 24.10 is EOL, it does not contain an updated list of CVE’s and this, PHP2SHELL would not be detected there.

This is what that looks like:
```bash
$ # holds: noble (24.04), and the advisory has a noble entry
$ docker compose exec c4-holds grep VERSION_CODENAME /etc/os-release
VERSION_CODENAME=noble
$ docker compose exec c4-holds dpkg-query -W php8.3-cli
php8.3-cli      8.3.6-0ubuntu0.24.04.12
$ curl -s https://raw.githubusercontent.com/aquasecurity/vuln-list/main/ubuntu/2026/CVE-2026-109618.json | jq -c '.Patches."php8.3".noble'
{"Status":"released","Note":"8.3.6-0ubuntu0.24.04.13"}
$ trivy image -q -f json php2shell:c4-holds | grep -c '"VulnerabilityID": "CVE-2026-109618"'
4
$ # broken: oracular (24.10), php8.3 installed, but no oracular entry
$ docker compose exec c4-broken grep VERSION_CODENAME /etc/os-release
VERSION_CODENAME=oracular
$ docker compose exec c4-broken dpkg-query -W php8.3-cli
php8.3-cli      8.3.11-0ubuntu0.24.10.5
$ curl -s https://raw.githubusercontent.com/aquasecurity/vuln-list/main/ubuntu/2026/CVE-2026-109618.json | jq -c '.Patches."php8.3".oracular'
null
$ trivy image php2shell:c4-broken 2>&1 | grep -o 'This OS version is no longer supported.*'
This OS version is no longer supported by the distribution      family="ubuntu" version="24.10"
$ trivy image -q -f json php2shell:c4-broken | grep -c '"VulnerabilityID": "CVE-2026-109618"'
0
```

## How does Trivy tell a vulnerable version from a patched one?

![](/blog/trivy-php2shell/image-6.png)

The security advisory also contains the specific version of a package that is patched and safe to install. If the version number installed on the system is less than the patched version, it will be flagged as vulnerable. In the event that no patched version is available, all versions of the package will be flagged.

Here’s how it looks:
```bash
$ # holds: the .12 build from Launchpad
$ docker compose exec c5-holds dpkg-query -W -f='${Version}\n' php8.3-cli
8.3.6-0ubuntu0.24.04.12
$ docker compose exec c5-holds sh -c 'dpkg --compare-versions "$(dpkg-query -W -f="\${Version}" php8.3-cli)" lt 8.3.6-0ubuntu0.24.04.13 && echo below fix || echo at/after fix'
below fix
$ trivy image -q -f json php2shell:c5-holds | grep -c '"VulnerabilityID": "CVE-2026-109618"'
4
$ # broken: whatever apt installs today (.13)
$ docker compose exec c5-broken dpkg-query -W -f='${Version}\n' php8.3-cli
8.3.6-0ubuntu0.24.04.13
$ docker compose exec c5-broken sh -c 'dpkg --compare-versions "$(dpkg-query -W -f="\${Version}" php8.3-cli)" lt 8.3.6-0ubuntu0.24.04.13 && echo below fix || echo at/after fix'
at/after fix
$ trivy image -q -f json php2shell:c5-broken | grep -c '"VulnerabilityID": "CVE-2026-109618"'
0
```

## Where does Trivy keep its CVE data?

![](/blog/trivy-php2shell/image-7.png)

Trivy uses an offline copy of the CVE data during the scan. This creates the potential for a scenario where a CVE is released before the current data is refreshed. 

This is what that can look like:
```bash
$ # holds: today's DB has the advisory
$ docker run --rm php2shell:stale-db --cache-dir /fresh version | grep UpdatedAt
  UpdatedAt: 2026-10-30 07:16:25.054174501 +0000 UTC
$ docker run --rm --entrypoint dbkey php2shell:stale-db get /fresh/db/trivy.db 'ubuntu 24.04' php8.3 CVE-2026-109618
{"FixedVersion":"8.3.6-0ubuntu0.24.04.13"}
$ trivy image -q -f json php2shell:c6-holds | grep -c '"VulnerabilityID": "CVE-2026-109618"'
4
$ # broken (simulated): a DB from before 21 Oct, same image, --skip-db-update
$ docker run --rm php2shell:stale-db version | grep UpdatedAt
  UpdatedAt: 2026-10-20 07:00:00 +0000 UTC
$ docker run --rm --entrypoint dbkey php2shell:stale-db get /root/.cache/trivy/db/trivy.db 'ubuntu 24.04' php8.3 CVE-2026-109618
not found
$ docker run --rm -v /var/run/docker.sock:/var/run/docker.sock php2shell:stale-db image -q -f json --skip-db-update php2shell:c6-holds | grep -c '"VulnerabilityID": "CVE-2026-109618"'
0
```

## Why might a vulnerable package not show up in the report?

![](/blog/trivy-php2shell/image-8.png)

Trivy can be configured using flags, environmental variables or policies/ignore files. There can be cases where a specific config can lead to a vulnerability being filtered. Here are some examples:
- **Severity** : if this is set to LOW/MEDIUM, any CVE rated outside of that will be dropped
- **Fix status**: drops findings Ubuntu has no fix for
- **.trivyignore**: drops any CVE listed in the file
- **Repo policy**: drops findings that match rules defined here
- **VEX**: drops findings marked as `not_affected`
- **Skip dirs**: if the location of the pkg DB is defined here, all pkgs will become invisible to Trivy

Here’s what each looks like in practice:
```bash
$ # holds: default scan, every severity
$ trivy image -q -f json php2shell:c7-holds | jq -r '.Results[].Vulnerabilities[]? | select(.VulnerabilityID=="CVE-2026-109618") | .Severity' | sort -u
CRITICAL
$ trivy image -q -f json php2shell:c7-holds | grep -c '"VulnerabilityID": "CVE-2026-109618"'
4
$ # broken: same image, scan settings filter it out
$ trivy image -q -f json --severity LOW,MEDIUM php2shell:c7-holds | grep -c '"VulnerabilityID": "CVE-2026-109618"'
0
$ docker run --rm -e TRIVY_SEVERITY=LOW,MEDIUM -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.76.1 image -q -f json php2shell:c7-holds | grep -c '"VulnerabilityID": "CVE-2026-109618"'
0
$ cat scenarios/c7-filters/.trivyignore
CVE-2026-109618
$ docker run --rm -v "$PWD/scenarios/c7-filters/.trivyignore:/.trivyignore" -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.76.1 image -q -f json --ignorefile /.trivyignore php2shell:c7-holds | grep -c '"VulnerabilityID": "CVE-2026-109618"'
0
```


If all these conditions are met, then Trivy will be able to effectively evaluate the vulnerability status of a package.

Want to see it for yourself? The full lab is on GitHub: [detecting-php2shell-with-trivy](https://github.com/perplexedyawdie/detecting-php2shell-with-trivy). Spin it up and try each scenario in a real environment.
