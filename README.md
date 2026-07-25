# Pure Path — multi-page clinic website

Polished multi-page rebuild of [purepath.au](https://purepath.au/) using the real brand assets, with local Nerang clinic details for SEO.

## Live site

After enabling GitHub Pages:  
**https://leaflock420-weedman.github.io/purepath-clone/**

## Pages (SEO)

| Page | File | Purpose |
|------|------|---------|
| Home | `index.html` | Hero, how it works, CTAs |
| About | `about.html` | Values & why choose us |
| Services | `services.html` | Hormone, plant-based, wellness |
| Visit | `visit.html` | Address, hours, phone, maps/social |
| FAQ | `faq.html` | Common questions |
| Book | `book.html` | Consultation request form |

Also includes `sitemap.xml`, `robots.txt`, and LocalBusiness/MedicalClinic JSON-LD on the home page.

## Contact (clinic)

- **Phone:** (07) 5632 8124  
- **Address:** Shop G3/52 Price St, Earle Plaza, Nerang QLD 4211  
- **Hours:** Mon–Sat 10 am–6 pm · Sunday closed  

## Run locally

```bash
cd purepath-clone
python -m http.server 8765
# open http://localhost:8765
```

## Stack

Simple static HTML + CSS + JS. No build step. Real images/icons in `/assets`.

## GitHub Pages

1. Repo Settings → Pages  
2. Source: **Deploy from a branch**  
3. Branch: `main` / root  
4. Save — site is live in ~1 minute  
