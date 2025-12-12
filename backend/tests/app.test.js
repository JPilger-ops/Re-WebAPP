import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createRequire } from "module";
import app from "../src/server.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

// Align APP_VERSION used by the version endpoint with package.json for deterministic tests
process.env.APP_VERSION = pkg.version;

test("GET /api/version liefert Version aus package.json", async () => {
  const res = await request(app).get("/api/version").expect(200);
  assert.equal(res.body.version, pkg.version);
  assert.ok("build" in res.body);
});

test("Root-Route liefert HTML-Frontend", async () => {
  const res = await request(app).get("/").expect(200);
  assert.match(res.headers["content-type"] || "", /html/);
  assert.match(res.text, /<!doctype html/i);
});

test("Geschützte Route ohne Token → 401 ohne WWW-Authenticate", async () => {
  const res = await request(app).get("/api/testdb").expect(401);
  assert.equal(res.body?.message, "Nicht eingeloggt.");
  assert.ok(!res.headers["www-authenticate"]);
});
