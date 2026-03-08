# MH Montagetechnik – Website (DE) + Admin + Upload + DSGVO/TTDSG

This project contains:
- Premium responsive frontend (German)
- Animations (window/door/roller shutter) + scroll reveal
- Admin panel: login, create/edit/delete projects, upload multiple images
- Legal pages: Impressum + Datenschutzerklärung
- Cookie banner with settings (Analytics only with consent)
- Contact form API with SMTP email sending + rate limiting + honeypot

## Requirements (Apps you should have)
**Required**
1. Node.js **LTS** (includes npm) – https://nodejs.org
2. VS Code (you already have it)
3. Git (recommended) – https://git-scm.com

**Helpful / optional**
- SQLite browser (DB viewer): “DB Browser for SQLite”
- Image editor: Photoshop/GIMP/Canva
- FTP/SFTP client (if you deploy via upload): FileZilla
- A terminal (Windows Terminal / iTerm / Linux shell)

## Quick start (local)
```bash
npm install
cp .env.example .env
# edit .env (at least SESSION_SECRET)
node server.js
```

Open:
- Site: http://localhost:3000
- Admin: http://localhost:3000/admin/login

First admin user is auto-created if no users exist:
- username: admin
- password: admin123  (CHANGE ASAP)

## Demo content (optional)
```bash
npm run seed
```

## Contact form email
This site provides an API endpoint:
- POST /api/contact

It sends email via SMTP using .env settings.
Test with Postman:
- URL: http://localhost:3000/api/contact
- Body (JSON): { "name":"...", "email":"...", "phone":"...", "message":"...", "company":"", "_csrf":"TOKEN" }

CSRF token is included in the page (hidden field) – for API tests you can fetch it from /kontakt page source.

## Deployment notes (VPS / Hetzner recommended)
- Run with PM2
- Use Nginx reverse proxy
- Enable HTTPS via Certbot

If you want, I can provide a ready Nginx config for your domain.

## Legal note
Templates are provided and are commonly used patterns (TMG/DSGVO/TTDSG),
but for maximum legal certainty (especially if you add marketing pixels, newsletters, etc.)
you should have a lawyer or Datenschutz service review your final setup.


## Frontend structure (safe to redesign)
Change only these files for design:
- `public/css/theme.css` → colors, radius, shadows, font
- `public/css/base.css` → reset, typography, grid, container
- `public/css/components.css` → header, buttons, cards, forms, footer
- `public/css/pages.css` → hero, page-specific sections/layout
- `views/*.ejs` → move sections around / change markup

Do NOT touch for design:
- `server.js`
- `data/db.js`


### New catalog pages
- `/produkte`
- `/produktkatalog/:id`
- `/haustueren-designs`
