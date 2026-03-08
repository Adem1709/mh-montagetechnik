const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const csrf = require("csurf");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
require("dotenv").config();

const db = require("./data/db");

const app = express();
const PORT = process.env.PORT || 3000;

// --------- Static first (avoid CSRF on assets) ----------
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// --------- Security ----------
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// --------- Session ----------
app.use(session({
  secret: process.env.SESSION_SECRET || "change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax" }
}));

// --------- CSRF (global) ----------
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// --------- Views ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --------- Site config ----------
app.use((req, res, next) => {
  res.locals.SITE = {
    name: "MH Montagetechnik",
    owner: "Muhamet Hajdaraj",
    street: "Hauptstraße 148",
    zipCity: "69207 Sandhausen",
    region: "Heidelberg & Umgebung",
    phone: process.env.PHONE || "0176 84046502",
    email: process.env.EMAIL || "info@mh-montagetechnik.de",
    gaId: process.env.GA_MEASUREMENT_ID || "G-XXXXXXX",
    siteUrl: process.env.SITE_URL || "https://mh-montagetechnik.de"
  };
  res.locals.path = req.path;
  res.locals.csrfToken = (typeof req.csrfToken === 'function') ? req.csrfToken() : '';
  next();
});

// --------- Upload ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "public", "uploads")),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only JPG/PNG/WebP allowed"), ok);
  }
});

// --------- Auth helpers ----------
function isAuthed(req, res, next) {
  if (req.session?.userId) return next();
  return res.redirect("/admin/login");
}

function ensureFirstAdmin() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count === 0) {
    const username = "admin";
    const password = "admin123";
    const hash = bcrypt.hashSync(password, 12);
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hash);
    console.log("✅ First admin created: admin / admin123 (CHANGE ASAP)");
  }
}
ensureFirstAdmin();

// --------- Meta utility ----------
function pageMeta({ title, description, canonical }) {
  return { title, description, canonical };
}

// --------- Service pages (SEO) ----------
const servicePages = {
  "fenster-montage-heidelberg": {
    h1: "Fenster Montage in Heidelberg",
    intro: "Professionelle Fenstermontage (PVC/Alu) mit sauberer Ausführung, Aufmaß und Beratung.",
    bullets: [
      "Energiesparfenster & fachgerechte Abdichtung",
      "Schallschutz / Wärmeschutz Optionen",
      "Saubere Demontage & Entsorgung",
      "Aufmaß & Angebot – unverbindlich"
    ]
  },
  "tueren-einbau-heidelberg": {
    h1: "Türen Einbau in Heidelberg",
    intro: "Eingangs- und Innentüren: Montage, Austausch und Nachrüstung – sicher, präzise und langlebig.",
    bullets: [
      "Haustüren / Innentüren inkl. Zarge",
      "Sicherheitsoptionen (z.B. Mehrfachverriegelung)",
      "Dämmung & Dichtigkeit",
      "Termintreue und saubere Übergabe"
    ]
  },
  "rollladen-montage-heidelberg": {
    h1: "Rollladen Montage & Reparatur in Heidelberg",
    intro: "Rollläden für Wärme-, Sicht- und Einbruchschutz – Montage, Nachrüstung und Reparatur.",
    bullets: [
      "Innen- & Außenrollläden",
      "Motorisierung möglich",
      "Reparatur / Austausch von Gurt & Lamellen",
      "Schneller Service in der Region"
    ]
  },
  "jalousien-sonnenschutz-heidelberg": {
    h1: "Jalousien & Sonnenschutz in Heidelberg",
    intro: "Individuelle Lösungen für Sicht- und Sonnenschutz: Jalousien, Plissees, Rollo-Systeme.",
    bullets: [
      "Maßanfertigung",
      "Beratung zur optimalen Lösung",
      "Montage sauber & präzise",
      "Pflegeleichte Systeme"
    ]
  }
};

// --------- Public routes ----------
app.get("/", (req, res) => {
  const projects = db.prepare(`
    SELECT p.*,
      (SELECT image_path FROM project_images WHERE project_id = p.id ORDER BY sort_order ASC LIMIT 1) AS first_image
    FROM projects p
    ORDER BY p.created_at DESC
    LIMIT 6
  `).all();

  res.render("home", {
    meta: pageMeta({
      title: "Fenster & Türen Montage in Heidelberg | MH Montagetechnik",
      description: "Professionelle Fenster-, Türen- und Rollladenmontage in Heidelberg & Umgebung. Kostenlose Beratung, saubere Montage und Garantie.",
      canonical: `${res.locals.SITE.siteUrl}/`
    }),
    projects
  });
});

app.get("/galerie", (req, res) => {
  const category = (req.query.category || "").trim();
  let projects;
  if (category) {
    projects = db.prepare(`
      SELECT p.*,
        (SELECT image_path FROM project_images WHERE project_id = p.id ORDER BY sort_order ASC LIMIT 1) AS first_image
      FROM projects p
      WHERE p.category = ?
      ORDER BY p.created_at DESC
    `).all(category);
  } else {
    projects = db.prepare(`
      SELECT p.*,
        (SELECT image_path FROM project_images WHERE project_id = p.id ORDER BY sort_order ASC LIMIT 1) AS first_image
      FROM projects p
      ORDER BY p.created_at DESC
    `).all();
  }

  res.render("gallery", {
    meta: pageMeta({
      title: "Galerie | MH Montagetechnik",
      description: "Referenzen und Projekte: Fenster, Türen, Rollläden, Jalousien und mehr in Heidelberg & Umgebung.",
      canonical: `${res.locals.SITE.siteUrl}/galerie`
    }),
    projects,
    category
  });
});

app.get("/projekt/:id", (req, res) => {
  const id = Number(req.params.id);
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project) return res.status(404).send("Not found");

  const images = db.prepare("SELECT * FROM project_images WHERE project_id = ? ORDER BY sort_order ASC").all(id);

  res.render("project", {
    meta: pageMeta({
      title: `${project.title} | MH Montagetechnik`,
      description: project.description || "Projekt von MH Montagetechnik.",
      canonical: `${res.locals.SITE.siteUrl}/projekt/${id}`
    }),
    project,
    images
  });
});

app.get("/kontakt", (req, res) => {
  res.render("kontakt", {
    meta: pageMeta({
      title: "Kontakt | MH Montagetechnik",
      description: "Kontaktieren Sie MH Montagetechnik für Beratung, Aufmaß und ein unverbindliches Angebot in Heidelberg & Umgebung.",
      canonical: `${res.locals.SITE.siteUrl}/kontakt`
    })
  });
});

app.get("/impressum", (req, res) => {
  res.render("impressum", {
    meta: pageMeta({
      title: "Impressum | MH Montagetechnik",
      description: "Impressum gemäß § 5 TMG – MH Montagetechnik.",
      canonical: `${res.locals.SITE.siteUrl}/impressum`
    })
  });
});

app.get("/datenschutz", (req, res) => {
  res.render("datenschutz", {
    meta: pageMeta({
      title: "Datenschutzerklärung | MH Montagetechnik",
      description: "Datenschutzerklärung (DSGVO/TTDSG) inklusive Google Analytics mit Einwilligung (Consent).",
      canonical: `${res.locals.SITE.siteUrl}/datenschutz`
    })
  });
});

Object.keys(servicePages).forEach((slug) => {
  app.get(`/${slug}`, (req, res) => {
    const s = servicePages[slug];
    res.render("service", {
      meta: pageMeta({
        title: `${s.h1} | MH Montagetechnik`,
        description: `${s.intro} Beratung & Montage in Heidelberg & Umgebung.`,
        canonical: `${res.locals.SITE.siteUrl}/${slug}`
      }),
      slug,
      s
    });
  });
});


// --------- Product catalog routes ----------
app.get("/produkte", (req, res) => {
  const category = (req.query.category || "").trim();
  let products;
  if (category) {
    products = db.prepare("SELECT * FROM products WHERE category = ? ORDER BY created_at DESC").all(category);
  } else {
    products = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  }
  res.render("produkte", {
    meta: pageMeta({
      title: "Produkte | MH Montagetechnik",
      description: "Produkte von Niti Windows – professionell montiert durch MH Montagetechnik. Türen, Fenster, Rollläden und mehr.",
      canonical: `${res.locals.SITE.siteUrl}/produkte`
    }),
    products,
    category
  });
});

app.get("/produktkatalog/:id", (req, res) => {
  const id = Number(req.params.id);
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!product) return res.status(404).send("Not found");

  const specs = db.prepare("SELECT * FROM product_specs WHERE product_id = ? ORDER BY sort_order ASC").all(id);
  const images = db.prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC").all(id);

  res.render("produktkatalog", {
    meta: pageMeta({
      title: `${product.title} | Produkte | MH Montagetechnik`,
      description: product.short_desc || "Produktdetails von MH Montagetechnik / Niti Windows.",
      canonical: `${res.locals.SITE.siteUrl}/produktkatalog/${id}`
    }),
    product,
    specs,
    images
  });
});

app.get("/ueber-uns", (req, res) => {
  res.render("ueber-uns", {
    meta: pageMeta({
      title: "Über uns | MH Montagetechnik",
      description: "Familienbetrieb – Kooperation mit Niti Windows. Produktion & Montage aus einer Hand.",
      canonical: `${res.locals.SITE.siteUrl}/ueber-uns`
    })
  });
});



// --------- Door design catalog routes ----------
const doorDesigns = [
  { number: "Nr. 600", title: "Haustür Design 600", color: "RAL 7016", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 601", title: "Haustür Design 601", color: "Alu-Color RAL 7016", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 602", title: "Haustür Design 602", color: "Alu-Color RAL 7016", glass: "ESG Wood Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 603", title: "Haustür Design 603", color: "Alu-Color RAL 7016", glass: "ESG Wood & Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 604", title: "Haustür Design 604", color: "Alu-Color RAL 7016 + 9010", glass: "ESG Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 605", title: "Haustür Design 605", color: "Alu-Color RAL 7016", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 606", title: "Haustür Design 606", color: "Alu-Color RAL 9010", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 607", title: "Haustür Design 607", color: "Alu-Color RAL 7016", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 608", title: "Haustür Design 608", color: "Alu-Color RAL 7016", glass: "ESG Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 609", title: "Haustür Design 609", color: "Alu-Color RAL 7016", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 610", title: "Haustür Design 610", color: "Alu-Color RAL 7016", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 611", title: "Haustür Design 611", color: "Alu-Color RAL 7016", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 612", title: "Haustür Design 612", color: "Alu-Color RAL 7016", glass: "Design laut Katalog", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 613", title: "Haustür Design 613", color: "Alu-Color RAL 7016", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 614", title: "Haustür Design 614", color: "Alu-Color RAL 7016", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 615", title: "Haustür Design 615", color: "Alu-Color RAL 7016 - 9010", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 616", title: "Haustür Design 616", color: "Alu-Color RAL 7016", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 617", title: "Haustür Design 617", color: "Alu-Color RAL 7016", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" },
  { number: "Nr. 618", title: "Haustür Design 618", color: "Alu-Color RAL 9010", glass: "ESG Black Printed Glass", system: "Heroal D 92 UD / D 72" }
];

app.get("/haustueren-designs", (req, res) => {
  res.render("haustueren-designs", {
    meta: pageMeta({
      title: "Haustür-Designs 600–618 | MH Montagetechnik",
      description: "Design-Katalog für Haustüren mit Modellen 600–618, Farben und Glastypen. Produktion durch Niti Windows, Montage durch MH Montagetechnik.",
      canonical: `${res.locals.SITE.siteUrl}/haustueren-designs`
    }),
    designs: doorDesigns
  });
});

// --------- Contact API (SMTP) ----------
const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

app.post("/api/contact", contactLimiter, async (req, res) => {
  // Honeypot field "company" should stay empty
  const { name, email, phone, message, company } = req.body || {};
  if (company && String(company).trim().length > 0) {
    return res.status(200).json({ ok: true }); // silently accept bots
  }
  if (!name || !email || !message) return res.status(400).json({ ok: false, error: "Missing fields" });

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.SMTP_TO || process.env.EMAIL;
  const from = process.env.SMTP_FROM || `MH Montagetechnik <${process.env.EMAIL || "info@mh-montagetechnik.de"}>`;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";

  if (!host || !user || !pass || !to) {
    return res.status(500).json({ ok: false, error: "SMTP not configured (.env)" });
  }

  try {
    const transporter = nodemailer.createTransport({
      host, port, secure,
      auth: { user, pass }
    });

    const subject = `Neue Anfrage – MH Montagetechnik (${name})`;
    const text = [
      `Name: ${name}`,
      `E-Mail: ${email}`,
      `Telefon: ${phone || "-"}`,
      "",
      "Nachricht:",
      String(message)
    ].join("\n");

    await transporter.sendMail({
      from,
      to,
      replyTo: email,
      subject,
      text
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Mail send failed" });
  }
});

// --------- Admin auth ----------
app.get("/admin/login", (req, res) => {
  res.render("admin-login", { error: null });
});

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return res.render("admin-login", { error: "Login fehlgeschlagen." });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.render("admin-login", { error: "Login fehlgeschlagen." });

  req.session.userId = user.id;
  req.session.username = user.username;
  res.redirect("/admin");
});

app.post("/admin/logout", isAuthed, (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// Admin dashboard
app.get("/admin", isAuthed, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*,
      (SELECT image_path FROM project_images WHERE project_id = p.id ORDER BY sort_order ASC LIMIT 1) AS first_image,
      (SELECT COUNT(*) FROM project_images WHERE project_id = p.id) AS image_count
    FROM projects p
    ORDER BY p.created_at DESC
  `).all();

  res.render("admin-dashboard", { projects, username: req.session.username });
});

// Create another user (simple)
app.get("/admin/users/new", isAuthed, (req, res) => {
  res.render("admin-user-new", { error: null });
});

app.post("/admin/users/new", isAuthed, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.render("admin-user-new", { error: "Missing fields" });
  const hash = bcrypt.hashSync(password, 12);
  try {
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hash);
    res.redirect("/admin");
  } catch {
    res.render("admin-user-new", { error: "Username exists" });
  }
});

// Projects: create
app.get("/admin/projects/new", isAuthed, (req, res) => {
  res.render("admin-project-form", {
    mode: "create",
    project: { title: "", category: "Fenster", description: "" },
    images: []
  });
});

// note: multer before csurf token check is OK because csurf reads req.body AFTER multer
app.post("/admin/projects/new", isAuthed, upload.array("images", 10), csrfProtection, (req, res) => {
  const { title, category, description } = req.body;

  const result = db.prepare(
    `INSERT INTO projects (title, category, description, cover_image_path) VALUES (?, ?, ?, ?)`
  ).run(title, category, description || "", null);

  const projectId = result.lastInsertRowid;
  const files = req.files || [];
  const insertImg = db.prepare(`INSERT INTO project_images (project_id, image_path, sort_order) VALUES (?, ?, ?)`);

  files.forEach((f, idx) => {
    insertImg.run(projectId, `/uploads/${f.filename}`, idx);
  });

  // set cover to first image
  const first = db.prepare(`SELECT image_path FROM project_images WHERE project_id = ? ORDER BY sort_order ASC LIMIT 1`).get(projectId);
  if (first?.image_path) {
    db.prepare(`UPDATE projects SET cover_image_path = ?, updated_at = datetime('now') WHERE id = ?`).run(first.image_path, projectId);
  }

  res.redirect("/admin");
});

// Projects: edit
app.get("/admin/projects/:id/edit", isAuthed, (req, res) => {
  const id = Number(req.params.id);
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project) return res.status(404).send("Not found");

  const images = db.prepare("SELECT * FROM project_images WHERE project_id = ? ORDER BY sort_order ASC").all(id);
  res.render("admin-project-form", { mode: "edit", project, images });
});

app.post("/admin/projects/:id/edit", isAuthed, upload.array("images", 10), csrfProtection, (req, res) => {
  const id = Number(req.params.id);
  const { title, category, description, setCoverImageId, deleteImageIds } = req.body;

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project) return res.status(404).send("Not found");

  db.prepare(
    `UPDATE projects SET title = ?, category = ?, description = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title, category, description || "", id);

  // Delete selected images
  if (deleteImageIds) {
    const ids = Array.isArray(deleteImageIds) ? deleteImageIds : [deleteImageIds];
    const del = db.prepare("DELETE FROM project_images WHERE id = ? AND project_id = ?");
    ids.forEach(imgId => del.run(Number(imgId), id));
  }

  // Add new images
  const files = req.files || [];
  if (files.length) {
    const maxSort = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM project_images WHERE project_id = ?").get(id).m;
    const insertImg = db.prepare(`INSERT INTO project_images (project_id, image_path, sort_order) VALUES (?, ?, ?)`);

    files.forEach((f, idx) => insertImg.run(id, `/uploads/${f.filename}`, maxSort + 1 + idx));
  }

  // Set cover
  if (setCoverImageId) {
    const img = db.prepare("SELECT image_path FROM project_images WHERE id = ? AND project_id = ?").get(Number(setCoverImageId), id);
    if (img?.image_path) {
      db.prepare("UPDATE projects SET cover_image_path = ?, updated_at = datetime('now') WHERE id = ?").run(img.image_path, id);
    }
  } else {
    // Ensure cover exists
    const first = db.prepare(`SELECT image_path FROM project_images WHERE project_id = ? ORDER BY sort_order ASC LIMIT 1`).get(id);
    db.prepare("UPDATE projects SET cover_image_path = ?, updated_at = datetime('now') WHERE id = ?").run(first?.image_path || null, id);
  }

  res.redirect("/admin/projects/" + id + "/edit");
});

app.post("/admin/projects/:id/delete", isAuthed, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM project_images WHERE project_id = ?").run(id);
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  res.redirect("/admin");
});


// --------- Admin: Products ----------
app.get("/admin/products", isAuthed, (req, res) => {
  const products = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  res.render("admin-products", { products, username: req.session.username });
});

app.get("/admin/products/new", isAuthed, (req, res) => {
  res.render("admin-product-form", {
    mode: "create",
    product: { title: "", category: "Haustüren", short_desc: "", long_desc: "" },
    images: [],
    specsText: ""
  });
});

app.post("/admin/products/new",
  isAuthed,
  upload.fields([{ name: "images", maxCount: 12 }, { name: "pdf", maxCount: 1 }]),
  csrfProtection,
  (req, res) => {
    const { title, category, short_desc, long_desc, specs } = req.body || {};
    const pdfFile = (req.files?.pdf && req.files.pdf[0]) ? req.files.pdf[0] : null;

    const r = db.prepare(`INSERT INTO products (title, category, short_desc, long_desc, pdf_path, cover_image_path)
                          VALUES (?,?,?,?,?,?)`)
      .run(title, category, short_desc || "", long_desc || "",
        pdfFile ? `/uploads/${pdfFile.filename}` : null,
        null);

    const productId = r.lastInsertRowid;

    const imgs = req.files?.images || [];
    const insImg = db.prepare("INSERT INTO product_images (product_id, image_path, sort_order) VALUES (?,?,?)");
    imgs.forEach((f, idx2) => insImg.run(productId, `/uploads/${f.filename}`, idx2));

    const first = db.prepare("SELECT image_path FROM product_images WHERE product_id=? ORDER BY sort_order ASC LIMIT 1").get(productId);
    if (first?.image_path) {
      db.prepare("UPDATE products SET cover_image_path=?, updated_at=datetime('now') WHERE id=?").run(first.image_path, productId);
    }

    const lines = String(specs || "").split("\n").map(s => s.trim()).filter(Boolean);
    const insSpec = db.prepare("INSERT INTO product_specs (product_id, label, value, sort_order) VALUES (?,?,?,?)");
    lines.forEach((ln, i) => {
      const parts = ln.split(":");
      if (parts.length >= 2) {
        const label = parts.shift().trim();
        const value = parts.join(":").trim();
        if (label && value) insSpec.run(productId, label, value, i);
      }
    });

    res.redirect("/admin/products");
});

app.get("/admin/products/:id/edit", isAuthed, (req, res) => {
  const id = Number(req.params.id);
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!product) return res.status(404).send("Not found");

  const images = db.prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC").all(id);
  const specs = db.prepare("SELECT * FROM product_specs WHERE product_id = ? ORDER BY sort_order ASC").all(id);
  const specsText = specs.map(s => `${s.label}: ${s.value}`).join("\n");

  res.render("admin-product-form", { mode: "edit", product, images, specsText });
});

app.post("/admin/products/:id/edit",
  isAuthed,
  upload.fields([{ name: "images", maxCount: 12 }, { name: "pdf", maxCount: 1 }]),
  csrfProtection,
  (req, res) => {
    const id = Number(req.params.id);
    const { title, category, short_desc, long_desc, specs } = req.body || {};

    const product = db.prepare("SELECT * FROM products WHERE id=?").get(id);
    if (!product) return res.status(404).send("Not found");

    const pdfFile = (req.files?.pdf && req.files.pdf[0]) ? req.files.pdf[0] : null;
    const pdfPath = pdfFile ? `/uploads/${pdfFile.filename}` : product.pdf_path;

    db.prepare(`UPDATE products SET title=?, category=?, short_desc=?, long_desc=?, pdf_path=?, updated_at=datetime('now') WHERE id=?`)
      .run(title, category, short_desc || "", long_desc || "", pdfPath, id);

    const imgs = req.files?.images || [];
    if (imgs.length) {
      const maxSort = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM product_images WHERE product_id=?").get(id).m;
      const insImg = db.prepare("INSERT INTO product_images (product_id, image_path, sort_order) VALUES (?,?,?)");
      imgs.forEach((f, idx2) => insImg.run(id, `/uploads/${f.filename}`, maxSort + 1 + idx2));
    }

    db.prepare("DELETE FROM product_specs WHERE product_id=?").run(id);
    const lines = String(specs || "").split("\n").map(s => s.trim()).filter(Boolean);
    const insSpec = db.prepare("INSERT INTO product_specs (product_id, label, value, sort_order) VALUES (?,?,?,?)");
    lines.forEach((ln, i) => {
      const parts = ln.split(":");
      if (parts.length >= 2) {
        const label = parts.shift().trim();
        const value = parts.join(":").trim();
        if (label && value) insSpec.run(id, label, value, i);
      }
    });

    const first = db.prepare("SELECT image_path FROM product_images WHERE product_id=? ORDER BY sort_order ASC LIMIT 1").get(id);
    db.prepare("UPDATE products SET cover_image_path=?, updated_at=datetime('now') WHERE id=?").run(first?.image_path || null, id);

    res.redirect("/admin/products/" + id + "/edit");
});

app.post("/admin/products/:id/delete", isAuthed, csrfProtection, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM product_images WHERE product_id=?").run(id);
  db.prepare("DELETE FROM product_specs WHERE product_id=?").run(id);
  db.prepare("DELETE FROM products WHERE id=?").run(id);
  res.redirect("/admin/products");
});

app.post("/admin/products/:pid/images/:imgid/delete", isAuthed, csrfProtection, (req, res) => {
  const pid = Number(req.params.pid);
  const imgid = Number(req.params.imgid);
  db.prepare("DELETE FROM product_images WHERE id=? AND product_id=?").run(imgid, pid);
  const first = db.prepare("SELECT image_path FROM product_images WHERE product_id=? ORDER BY sort_order ASC LIMIT 1").get(pid);
  db.prepare("UPDATE products SET cover_image_path=?, updated_at=datetime('now') WHERE id=?").run(first?.image_path || null, pid);
  res.redirect("/admin/products/" + pid + "/edit");
});

// --------- Error handling ----------
app.use((err, req, res, next) => {
  if (err && err.code === "EBADCSRFTOKEN") {
    return res.status(403).send("Invalid CSRF token.");
  }
  console.error(err);
  res.status(500).send("Server error.");
});

// --------- Start ----------
// 0.0.0.0 e bën serverin të aksesueshëm nga telefoni në të njëjtin WiFi
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Running: http://localhost:${PORT}`);
});