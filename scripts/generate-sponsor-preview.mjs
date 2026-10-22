#!/usr/bin/env node
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'sponsor-preview.html');
const outPath = path.join(__dirname, '..', 'docs', 'sponsor-preview.png');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log(`Wrote ${outPath}`);
