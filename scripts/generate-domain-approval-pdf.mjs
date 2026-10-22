#!/usr/bin/env node
/**
 * Generate a polished docs/REDDIT_DOMAIN_APPROVAL.pdf from markdown source.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const VENV = join(ROOT, '.pdf-venv');
const PY = join(VENV, 'bin', 'python');
const MD = join(ROOT, 'docs/REDDIT_DOMAIN_APPROVAL.md');
const PDF = join(ROOT, 'docs/REDDIT_DOMAIN_APPROVAL.pdf');

if (!existsSync(PY)) {
  execSync(`python3 -m venv "${VENV}" && "${join(VENV, 'bin/pip')}" install fpdf2`, {
    stdio: 'inherit',
    cwd: ROOT,
  });
}

const pyScript = `
from fpdf import FPDF
from fpdf.enums import XPos, YPos
from pathlib import Path
import re

md_path = Path(${JSON.stringify(MD)})
pdf_path = Path(${JSON.stringify(PDF)})
raw = md_path.read_text()
raw = (
    raw.replace("\\u2014", "-")
    .replace("\\u2013", "-")
    .replace("\\u2019", "'")
    .replace("\\u2018", "'")
)

def clean(text: str) -> str:
    text = re.sub(r"\\[([^\\]]+)\\]\\([^\\)]+\\)", r"\\1", text)
    return text.replace("**", "").replace("\`", "").strip()

class LetterPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.set_margins(22, 22, 22)
        self.set_auto_page_break(auto=True, margin=20)

    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"redditcfb.com  |  pickem-game  |  page {self.page_no()}", align="C")

pdf = LetterPDF()
pdf.add_page()
w = pdf.w - pdf.l_margin - pdf.r_margin

pdf.set_font("Helvetica", "B", 20)
pdf.set_text_color(30, 30, 30)
pdf.multi_cell(w, 10, "Pick 'Em", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Helvetica", "", 12)
pdf.set_text_color(80, 80, 80)
pdf.multi_cell(w, 7, "HTTP Domain Approval Request", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(6)

meta_lines = []
body_lines = []
in_meta = True

for line in raw.splitlines():
    s = line.rstrip()
    if s.startswith("# "):
        continue
    if s.startswith("---"):
        in_meta = False
        continue
    if s.startswith("## "):
        in_meta = False
        body_lines.append(("h2", clean(s[3:])))
        continue
    if not s:
        body_lines.append(("space", ""))
        continue
    if in_meta and s.startswith("**"):
        meta_lines.append(clean(s))
    elif s.startswith("**") and s.endswith("**") and s.count("**") == 2:
        body_lines.append(("domain", clean(s)))
    elif s.startswith("- "):
        body_lines.append(("bullet", clean(s[2:])))
    else:
        body_lines.append(("p", clean(s)))

pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(60, 60, 60)
for meta in meta_lines:
    pdf.cell(w, 6, meta, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(4)

def write_paragraph(text: str):
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(w, 6.5, text)
    pdf.ln(2)

def write_section(title: str):
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(30, 30, 30)
    pdf.multi_cell(w, 8, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1)

def write_domain(name: str):
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(217, 57, 0)
    pdf.multi_cell(w, 6, name, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

def write_bullet(text: str):
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(40, 40, 40)
    x = pdf.get_x()
    pdf.cell(5, 6.5, "-")
    pdf.set_x(x + 5)
    pdf.multi_cell(w - 5, 6.5, text)
    pdf.ln(1)

for kind, text in body_lines:
    if kind == "h2":
        write_section(text)
    elif kind == "domain":
        write_domain(text)
    elif kind == "p":
        write_paragraph(text)
    elif kind == "bullet":
        write_bullet(text)
    elif kind == "space":
        pdf.ln(2)

pdf.output(str(pdf_path))
print(f"Wrote {pdf_path} ({pdf_path.stat().st_size} bytes)")
`;

const tmpPy = join(ROOT, 'scripts/.generate-domain-pdf.py');
writeFileSync(tmpPy, pyScript);
const result = spawnSync(PY, [tmpPy], { encoding: 'utf8', cwd: ROOT });
if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}
console.log(result.stdout.trim());
