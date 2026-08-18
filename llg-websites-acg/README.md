# LLG Websites

Private source repository for the 29 LLG local-service websites hosted on Cloudflare Pages.

The repository now also contains the scalable site factory review release: 115 identities, 86 profile-ready independent Workers, seven approved palette assignments, and the centralized test-mode lead intake source. See [factory/README.md](factory/README.md) and the live [portfolio review index](https://llg-site-review-index.justin-b75.workers.dev/).

## Employee workflow

Start with [Employee site workflow](docs/EMPLOYEE_SITE_WORKFLOW.md). Each website lives in its own top-level directory. Open a branch, change only the intended site, preview it locally, and submit a pull request into `main`.

Pull requests run the complete static portfolio audit. After a pull request is approved and merged, GitHub Actions deploys only the site directories changed by that pull request to their stable Cloudflare review URLs.

## Site directory

| Website | Repository directory | Cloudflare review URL |
|---|---|---|
| Austin Drain Guys | `austin-drain-guys/` | https://clone-rebuild.austin-drain-guys.pages.dev/ |
| Baltimore French Drain | `baltimore-french-drain/` | https://clone-rebuild.baltimore-french-drain.pages.dev/ |
| Charlotte Crawl Space | `charlotte-crawl-space/` | https://clone-rebuild.charlotte-crawl-space.pages.dev/ |
| Charlotte Precision Walls | `charlotte-precision-walls/` | https://clone-rebuild.charlotte-precision-walls.pages.dev/ |
| Chicago Drainage Guys | `chicago-drainage-guys/` | https://clone-rebuild.chicago-drainage-guys.pages.dev/ |
| Cincinnati Precision Walls | `cincinnati-precision-walls/` | https://clone-rebuild.cincinnati-precision-walls.pages.dev/ |
| Connecticut Drain Pros | `connecticut-drain-pros/` | https://clone-rebuild.connecticut-drain-pros.pages.dev/ |
| Crawlspace Cary NC | `crawlspace-cary-nc/` | https://clone-rebuild.crawlspace-cary-nc.pages.dev/ |
| Crawlspace Durham | `crawlspace-durham/` | https://clone-rebuild.crawlspace-durham.pages.dev/ |
| Crawlspace Greensboro | `crawlspace-greensboro/` | https://clone-rebuild.crawlspace-greensboro.pages.dev/ |
| Crawlspace Raleigh | `crawlspace-raleigh/` | https://clone-rebuild.crawlspace-raleigh.pages.dev/ |
| Crawlspace Wilmington | `crawlspace-wilmington/` | https://clone-rebuild.crawlspace-wilmington.pages.dev/ |
| Dallas Drain Guys | `dallas-drain-guys/` | https://clone-rebuild.dallas-drain-guys.pages.dev/ |
| Greensboro Drain Guys | `greensboro-drain-guys/` | https://clone-rebuild.greensboro-drain-guys.pages.dev/ |
| Jackson French Drain | `jackson-french-drain/` | https://clone-rebuild.jackson-french-drain.pages.dev/ |
| Little Rock French Drain | `little-rock-french-drain/` | https://clone-rebuild.little-rock-french-drain.pages.dev/ |
| Little Rock Precision Walls | `little-rock-precision-walls/` | https://clone-rebuild.little-rock-precision-walls.pages.dev/ |
| Louisville Precision Walls | `louisville-precision-walls/` | https://clone-rebuild.louisville-precision-walls.pages.dev/ |
| Morgantown Fence Pros | `morgantown-fence-pros/` | https://clone-rebuild.morgantown-fence-pros.pages.dev/ |
| Naples Pool Pros | `naples-pool-pros/` | https://clone-rebuild.naples-pool-pros.pages.dev/ |
| Nashville Crawlspace | `nashville-crawlspace/` | https://clone-rebuild.nashville-crawlspace.pages.dev/ |
| Nashville Backyards | `nashville-backyards/` | https://clone-rebuild.nashville-backyards.pages.dev/ |
| New Orleans French Drain | `new-orleans-french-drain/` | https://clone-rebuild.new-orleans-french-drain.pages.dev/ |
| PGH Painting Pros | `pgh-painting-pros/` | https://clone-rebuild.pgh-painting-pros.pages.dev/ |
| PGH Pool Service | `pgh-pool-service/` | https://clone-rebuild.pgh-pool-service.pages.dev/ |
| Pittsburgh French Drain | `Pittsburgh-French-Drain-Site/` | https://clone-rebuild.pittsburgh-french-drain-site.pages.dev/ |
| Salt Lake City Precision Walls | `salt-lake-city-precision-walls/` | https://clone-rebuild.salt-lake-city-precision-walls.pages.dev/ |
| Tulsa Drain Pros | `tulsa-drain-pros/` | https://clone-rebuild.tulsa-drain-pros.pages.dev/ |
| WS Crawl Space | `ws-crawl-space/` | https://clone-rebuild.ws-crawl-space.pages.dev/ |

## Deployment controls

- Review releases use the `clone-rebuild` Cloudflare Pages branch and remain `noindex`.
- `.github/workflows/validate-sites.yml` checks every pull request.
- `.github/workflows/deploy-cloudflare-pages.yml` deploys changed site folders after merge to `main` and supports a manual single-site or full-portfolio deployment.
- The deployment workflow requires repository Actions secrets named `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
- Custom-domain production promotion remains a separately approved release step.
