#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve("docs/wakatime-compatibility-manifest.json");
const featureMatrixPath = resolve("docs/phase-10-feature-matrix.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const featureMatrix = JSON.parse(await readFile(featureMatrixPath, "utf8"));
const routes = Array.isArray(manifest.routes) ? manifest.routes : [];
const requiredRouteCount = 87;
const validStatuses = new Set([
  "not_started",
  "backend_only",
  "client_only",
  "partial",
  "beta",
  "experimental",
  "unavailable",
  "production_ready",
  "deprecated",
]);

if (manifest.version !== 2) {
  throw new Error(`expected manifest version 2, got ${manifest.version}`);
}

if (routes.length !== requiredRouteCount) {
  throw new Error(`expected ${requiredRouteCount} routes, got ${routes.length}`);
}

const keys = new Set();
for (const route of routes) {
  for (const field of [
    "method",
    "path",
    "section",
    "status",
    "owner",
    "authorization",
    "oauth_scope",
  ]) {
    if (route[field] === undefined || route[field] === null || route[field] === "") {
      throw new Error(`${route.method ?? "?"} ${route.path ?? "?"} is missing ${field}`);
    }
  }

  if (!validStatuses.has(route.status)) {
    throw new Error(`${route.method} ${route.path} has an unknown status ${route.status}`);
  }

  const key = `${route.method} ${route.path}`;
  if (keys.has(key)) {
    throw new Error(`duplicate route: ${key}`);
  }
  keys.add(key);
}

if (featureMatrix.version !== 1 || featureMatrix.source_of_truth !== "phase-10") {
  throw new Error("phase-10 feature matrix must declare version 1 and source_of_truth=phase-10");
}

const features = Array.isArray(featureMatrix.features) ? featureMatrix.features : [];
const featureKeys = new Set();
for (const feature of features) {
  for (const field of ["key", "status", "api"]) {
    if (!feature[field]) throw new Error(`feature is missing ${field}`);
  }
  if (featureKeys.has(feature.key)) throw new Error(`duplicate feature: ${feature.key}`);
  featureKeys.add(feature.key);
  if (!validStatuses.has(feature.status)) {
    throw new Error(`feature ${feature.key} has an unknown status ${feature.status}`);
  }
}

const statuses = new Set(routes.map((route) => route.status));
const declaredCount = Object.values(manifest.summary ?? {}).reduce(
  (total, value) => total + value,
  0,
);
if (declaredCount !== routes.length) {
  throw new Error(`summary count ${declaredCount} does not match route count ${routes.length}`);
}

console.log(
  `compatibility registry OK: ${routes.length} routes, ${features.length} features, statuses=${[
    ...statuses,
  ]
    .sort()
    .join(",")}`,
);
