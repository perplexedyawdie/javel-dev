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

![Terminal: What packages are in the image?](/blog/trivy-php2shell/c1.webp)


## Where does Trivy get CVE data?

![](/blog/trivy-php2shell/image-3.png)

A security advisory feed is published for each distro and it’s associated release. Trivy pulls this data to know which source packages to match against what’s captured in the SBOM.

This is what it looks like:

![Terminal: Where does Trivy get CVE data?](/blog/trivy-php2shell/c2.webp)

## Are all detected packages scanned?

![](/blog/trivy-php2shell/image-4.png)

Packages can either be installed from local sources, pulled from official distro owned repos or 3rd pary repos. Trivy scans packages that are sourced from distro owned repos. On Ubuntu, it determines this by checking if the specified Maintainer exists on a provided deny list.

Here’s what that looks like:

![Terminal: Are all detected packages scanned?](/blog/trivy-php2shell/c3.webp)

## When is a package vulnerable?

![](/blog/trivy-php2shell/image-5.png)

Advisory releases are updated with CVE’s until they reach end of life. Trivy will flag all relevant CVE’s detected using the advisory release associated with the distro. In this case, since Ubuntu 24.10 is EOL, it does not contain an updated list of CVE’s and this, PHP2SHELL would not be detected there.

This is what that looks like:

![Terminal: When is a package vulnerable?](/blog/trivy-php2shell/c4.webp)

## How does Trivy tell a vulnerable version from a patched one?

![](/blog/trivy-php2shell/image-6.png)

The security advisory also contains the specific version of a package that is patched and safe to install. If the version number installed on the system is less than the patched version, it will be flagged as vulnerable. In the event that no patched version is available, all versions of the package will be flagged.

Here’s how it looks:

![Terminal: How does Trivy tell a vulnerable version from a patched one?](/blog/trivy-php2shell/c5.webp)

## Where does Trivy keep its CVE data?

![](/blog/trivy-php2shell/image-7.png)

Trivy uses an offline copy of the CVE data during the scan. This creates the potential for a scenario where a CVE is released before the current data is refreshed. 

This is what that can look like:

![Terminal: Where does Trivy keep its CVE data?](/blog/trivy-php2shell/c6.webp)

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

![Terminal: Why might a vulnerable package not show up in the report?](/blog/trivy-php2shell/c7.webp)


If all these conditions are met, then Trivy will be able to effectively evaluate the vulnerability status of a package.