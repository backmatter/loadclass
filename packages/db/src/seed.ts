import { db } from "./index.ts";
import { categories } from "./schema.ts";

const CATEGORIES = [
  { slug: "articles", label: "Articles", description: "Journal, conference, and preprint templates", displayOrder: 1 },
  { slug: "theses", label: "Theses", description: "PhD dissertations, master's and bachelor's theses", displayOrder: 2 },
  { slug: "presentations", label: "Presentations", description: "Beamer slides and presentation themes", displayOrder: 3 },
  { slug: "cvs", label: "CVs & Résumés", description: "Academic CVs and job application résumés", displayOrder: 4 },
  { slug: "books", label: "Books", description: "Textbooks, monographs, and long-form documents", displayOrder: 5 },
  { slug: "reports", label: "Reports", description: "Technical reports, lab reports, and project write-ups", displayOrder: 6 },
  { slug: "posters", label: "Posters", description: "Academic and conference poster templates", displayOrder: 7 },
  { slug: "assignments", label: "Assignments & Exams", description: "Homework sets, problem sheets, and exam papers", displayOrder: 8 },
  { slug: "letters", label: "Letters", description: "Formal and business letter templates", displayOrder: 9 },
  { slug: "bibliographies", label: "Bibliographies", description: "Bibliography styles for BibTeX, BibLaTeX, and natbib", displayOrder: 10 },
  { slug: "cheatsheets", label: "Cheat Sheets", description: "Reference cards and formula sheets", displayOrder: 11 },
];

await db.insert(categories).values(CATEGORIES).onConflictDoNothing();
console.log("Seeded categories");
process.exit(0);
