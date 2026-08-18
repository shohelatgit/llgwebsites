# Employee site workflow

This repository contains all 29 LLG sites. Shohel and other editors only need GitHub access for normal copy, image, logo, and style changes. Cloudflare access is optional because approved changes deploy through GitHub Actions.

## 1. Get the repository

```powershell
git clone https://github.com/acg-data/llg-websites.git
cd llg-websites
git switch main
git pull --ff-only
```

Create one branch per request:

```powershell
git switch -c staff/site-name-short-description
```

Example: `staff/ws-crawlspace-new-photos`.

## 2. Change the intended site only

Each site is a top-level directory. The full directory-to-preview map is in the repository [README](../README.md).

Common files inside a site:

- `index.html`: homepage content and clone-derived structure.
- `brand-system.css`: target colors and typography variables.
- `clone-override.css`: target-specific responsive refinements.
- `media/`: logo, project, and representative images used by that site.
- `services/`, `about/`, `contact/`, and `service-areas/`: supporting SEO pages.
- `portfolio-runtime.js`: shared navigation and form behavior for that site output.

Keep each clone family’s structure intact. Change target branding, copy, photos, and approved business facts without flattening sites into a shared generic template.

## 3. Preview locally

From the repository root, replace `<site-directory>` with the folder being edited:

```powershell
python -m http.server 8000 --directory <site-directory>
```

Open `http://localhost:8000/` and check desktop plus a narrow mobile width. Confirm that navigation, images, forms, and visible calls to action still make sense.

## 4. Preserve conversion and staging controls

- Do not remove `noindex,nofollow` or the Cloudflare staging headers.
- Do not change the form endpoint from `/v1/website-leads` on the shared integrations Worker.
- Do not remove Turnstile, the honeypot field, consent controls, or site keys.
- Only expose a `tel:` link when `data/sites.json` marks the number `callrail-active` or `callrail-shared`.
- Ask the owner before changing domains, phone numbers, forms, tracking scripts, schema facts, or custom-domain settings.

## 5. Run the audit

First-time setup:

```powershell
python -m pip install --requirement requirements-ci.txt
```

Run before every pull request:

```powershell
python tools/audit-static-sites.py
```

The expected result is `Static audit: 29/29 passed`.

## 6. Commit and open a pull request

```powershell
git status --short
git add -- <only-the-files-you-changed>
git commit -m "Update Site Name photos and copy"
git push -u origin HEAD
gh pr create --base main --fill
```

The pull request template asks for the affected site, change type, checks, and screenshots. The validation workflow audits the entire portfolio and reports exactly which Cloudflare project will deploy.

## 7. Deployment after approval

After the pull request is approved and merged into `main`, GitHub Actions deploys only the changed site directories to their existing `clone-rebuild.<project>.pages.dev` URLs. The workflow verifies HTTP 200 and confirms the preview is still `noindex`.

An owner can also open **Actions → Deploy Cloudflare Pages → Run workflow** and enter one site key/project name or `all`.

## Access required

- Normal editing: Write access to `acg-data/llg-websites` on GitHub.
- Approvals: repository owner/reviewer access.
- Logs and manual rollbacks: optional Cloudflare account access.
