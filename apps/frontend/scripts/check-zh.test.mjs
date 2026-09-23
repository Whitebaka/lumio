import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadTsModule, flattenDictionary } from "./i18n-loader.mjs";

const file = (name) => fileURLToPath(new URL(`../src/lib/i18n/${name}.ts`, import.meta.url));
const { en } = loadTsModule(file("en"));
const { zh } = loadTsModule(file("zh"));
const { resolveLocale } = loadTsModule(file("locale"));
const { formatDate, formatNumber, toBcp47 } = loadTsModule(file("format"));

test("Chinese regional browser tags resolve to Simplified Chinese; a saved choice wins", () => {
  for (const tag of ["zh", "zh-CN", "zh-SG", "zh-Hans", "zh-Hans-CN", "ZH-cn"])
    assert.equal(resolveLocale(null, [tag, "en"]), "zh");
  assert.equal(resolveLocale("en", ["zh-CN"]), "en");
  assert.equal(resolveLocale("zh", ["en-US"]), "zh");
  assert.equal(resolveLocale(null, ["ja", "zh-CN", "en"]), "zh");
  assert.equal(resolveLocale("invalid", ["de-DE"]), "de");
  assert.equal(resolveLocale(null, []), "en");
});

test("guest-facing sections are translated completely, including future upstream keys", () => {
  for (const section of ["common", "gallery", "login", "annotation", "customerTag", "upload", "slowConn", "printShop", "orderPage"]) {
    const source = flattenDictionary(en[section]);
    const translated = flattenDictionary(zh[section]);
    assert.deepEqual([...translated.keys()].sort(), [...source.keys()].sort(), section);
    for (const [key, value] of translated) {
      if (/[A-Za-z]/.test(source.get(key).replace(/\{\w+\}/g, "")))
        assert.match(value, /[\u3400-\u9fff]/, `${section}.${key} must be Chinese`);
    }
  }
});

test("Chinese translations preserve every interpolation placeholder", () => {
  const source = flattenDictionary(en);
  const translated = flattenDictionary(zh);
  const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  assert.deepEqual([...translated.keys()].sort(), [...source.keys()].sort());
  for (const [key, value] of translated)
    assert.deepEqual(vars(value), vars(source.get(key)), key);
});

test("untranslated studio content falls back to English without mutating it", () => {
  assert.equal(zh.studio, en.studio);
  assert.equal(en.gallery.finalize, "Finish selection");
  assert.equal(zh.gallery.finalize, "提交选片");
});

test("Chinese date and number formatting uses zh-CN", () => {
  assert.equal(toBcp47("zh"), "zh-CN");
  const date = new Date("2026-09-23T12:00:00Z");
  assert.equal(formatDate("zh", date), new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date));
  assert.equal(formatNumber("zh", 12345.6), new Intl.NumberFormat("zh-CN").format(12345.6));
});
