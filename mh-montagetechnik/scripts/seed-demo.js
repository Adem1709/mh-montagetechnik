require("dotenv").config();
const db = require("../data/db");
const bcrypt = require("bcryptjs");

function ensureAdmin() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count === 0) {
    const hash = bcrypt.hashSync("admin123", 12);
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run("admin", hash);
    console.log("Admin created: admin/admin123");
  }
}

function seedProjects() {
  const pc = db.prepare("SELECT COUNT(*) AS c FROM projects").get().c;
  if (pc > 0) return;

  const insert = db.prepare(`INSERT INTO projects (title, category, description, cover_image_path) VALUES (?, ?, ?, ?)`);
  const imgs = db.prepare(`INSERT INTO project_images (project_id, image_path, sort_order) VALUES (?, ?, ?)`);

  const p1 = insert.run("Fenster Austausch – Altbau", "Fenster", "PVC Fenster, saubere Abdichtung, Heidelberg.", "/public/img/g1.jpg").lastInsertRowid;
  imgs.run(p1, "/public/img/g1.jpg", 0);
  imgs.run(p1, "/public/img/g2.jpg", 1);

  const p2 = insert.run("Haustür Montage – Sicherheit", "Türen", "Neue Haustür mit Mehrfachverriegelung.", "/public/img/g2.jpg").lastInsertRowid;
  imgs.run(p2, "/public/img/g2.jpg", 0);

  const p3 = insert.run("Rollladen Nachrüstung", "Rollläden", "Motorisierung möglich, Sandhausen.", "/public/img/g3.jpg").lastInsertRowid;
  imgs.run(p3, "/public/img/g3.jpg", 0);

  console.log("Seed projects inserted.");
}

ensureAdmin();
seedProjects();

function seedProducts() {
  const c = db.prepare("SELECT COUNT(*) AS c FROM products").get().c;
  if (c > 0) return;

  const ins = db.prepare(`INSERT INTO products (title, category, short_desc, long_desc, pdf_path, cover_image_path) VALUES (?,?,?,?,?,?)`);
  const spec = db.prepare(`INSERT INTO product_specs (product_id, label, value, sort_order) VALUES (?,?,?,?)`);
  const img = db.prepare(`INSERT INTO product_images (product_id, image_path, sort_order) VALUES (?,?,?)`);

  const p1 = ins.run(
    "Heroal D 92 UD",
    "Haustüren",
    "Premium Haustür-System mit starker Wärmedämmung & Sicherheit.",
    "Produktion: Niti Windows. Montage: MH Montagetechnik. Hochwertige Haustüren – modern, sicher und langlebig.",
    "/public/docs/katalog-tueren.pdf",
    "/public/img/g4.jpg"
  ).lastInsertRowid;

  spec.run(p1, "Bautiefe", "92/92 mm", 0);
  spec.run(p1, "Luftdurchlässigkeit", "Klasse 4", 1);
  spec.run(p1, "Schlagregendichtheit", "Klasse 9A", 2);
  spec.run(p1, "Einbruchhemmung", "bis RC3", 3);
  img.run(p1, "/public/img/g4.jpg", 0);

  const p2 = ins.run(
    "Heroal D 72",
    "Haustüren",
    "Robustes Türsystem – flexibel (Fixed / Reversible).",
    "Produktion: Niti Windows. Montage: MH Montagetechnik. Zuverlässige Qualität für viele Designs.",
    "/public/docs/katalog-tueren.pdf",
    "/public/img/g5.jpg"
  ).lastInsertRowid;

  spec.run(p2, "Paneel", "Fixed / reversible Füllungsbefestigung", 0);
  spec.run(p2, "Einbruchhemmung", "bis RC3", 1);
  img.run(p2, "/public/img/g5.jpg", 0);

  console.log("Seed products inserted.");
}

seedProducts();
