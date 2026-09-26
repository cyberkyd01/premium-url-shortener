/**
 * Builds an OpenAPI 3.1 document (and a serializable playground catalog) from the typed endpoint catalog in api-docs.ts.
 * Dependency-free apart from the catalog so it can be used from route handlers, server components and scripts.
 */
import { API_SECTIONS, PERMISSION_KEYS, type ApiEndpoint, type ApiParam, type HttpMethod } from "./api-docs";

export type JsonSchema = Record<string, unknown>;

export interface OpenApiOperation {
  operationId: string; summary: string; description?: string; tags: string[];
  security?: Record<string, string[]>[]; servers?: { url: string }[];
  parameters?: Record<string, unknown>[]; requestBody?: Record<string, unknown>; responses: Record<string, unknown>;
  "x-permission"?: string; "x-admin-only"?: boolean;
}

export interface OpenApiDocument {
  openapi: "3.1.0";
  info: { title: string; version: string; description: string; contact?: { url: string } };
  servers: { url: string; description?: string }[];
  tags: { name: string; description?: string }[];
  paths: Record<string, Partial<Record<Lowercase<HttpMethod>, OpenApiOperation>>>;
  components: { securitySchemes: Record<string, unknown>; schemas: Record<string, JsonSchema>; responses: Record<string, unknown> };
  security: Record<string, string[]>[];
}

/** A single (possibly split) parameter of the catalog, normalised for schema generation. */
export interface NormalizedParam { name: string; type: string; required: boolean; description: string }

/**
 * The catalog groups related fields as one row ("page / limit", "name, email, password"). Split them into one entry per field
 * so a form or schema can address each field individually.
 */
export function splitParams(params?: ApiParam[]): NormalizedParam[] {
  const out: NormalizedParam[] = [];
  for (const p of params ?? []) {
    const names = p.name.split(/\s*[\/,]\s*/).map((n) => n.trim()).filter(Boolean);
    for (const name of names) out.push({ name, type: p.type, required: !!p.required && names.length === 1, description: p.description });
  }
  return out;
}

const SIMPLE: Record<string, JsonSchema> = {
  string: { type: "string" }, number: { type: "number" }, integer: { type: "integer" }, boolean: { type: "boolean" },
  array: { type: "array", items: {} }, object: { type: "object", additionalProperties: true }, mixed: {},
  "string[]": { type: "array", items: { type: "string" } },
};

/** Maps the catalog's loose type strings (e.g. "array|object", "string[]", "mixed") to a JSON schema. */
export function schemaForType(type: string): JsonSchema {
  const t = type.trim().toLowerCase();
  if (SIMPLE[t]) return { ...SIMPLE[t] };
  if (t.includes("|")) {
    const variants = t.split("|").map((v) => schemaForType(v));
    return { oneOf: variants };
  }
  return {};
}

/** Infers a JSON schema from an example value (used to document response envelopes). */
export function inferSchema(value: unknown): JsonSchema {
  if (value === null || value === undefined) return { type: ["string", "null"] };
  if (Array.isArray(value)) return { type: "array", items: value.length ? inferSchema(value[0]) : {} };
  switch (typeof value) {
    case "string": return { type: "string" };
    case "number": return { type: Number.isInteger(value) ? "integer" : "number" };
    case "boolean": return { type: "boolean" };
    case "object": {
      const properties: Record<string, JsonSchema> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) properties[k] = inferSchema(v);
      return { type: "object", properties };
    }
    default: return {};
  }
}

/** ":id" → "{id}" and returns the list of path parameter names. */
export function openApiPath(path: string): { path: string; params: string[] } {
  const params: string[] = [];
  const converted = path.replace(/:([A-Za-z_]+)/g, (_m, name: string) => { params.push(name); return `{${name}}`; });
  return { path: converted, params };
}

function camel(s: string) {
  return s.replace(/[^A-Za-z0-9]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : "")).replace(/^[A-Z]/, (c) => c.toLowerCase());
}

function operationId(e: ApiEndpoint, seen: Set<string>) {
  let id = camel(e.title) || camel(`${e.method} ${e.path}`);
  if (e.method === "GET" && e.path.endsWith("/shorten")) id = "quickShortenGet";
  let unique = id, i = 2;
  while (seen.has(unique)) unique = `${id}${i++}`;
  seen.add(unique);
  return unique;
}

function pathParamDescription(name: string, e: ApiEndpoint) {
  if (name === "id" && e.path.startsWith("/api/v1/links")) return "Link id or alias.";
  if (name === "id") return "Resource id.";
  if (name === "blockId") return "Bio block id.";
  return `${name} path parameter.`;
}

function requestBodySchema(e: ApiEndpoint): JsonSchema {
  const params = splitParams(e.params);
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const p of params) {
    properties[p.name] = { ...schemaForType(p.type), description: p.description };
    if (p.required) required.push(p.name);
  }
  const schema: JsonSchema = { type: "object", properties, additionalProperties: true };
  if (required.length) schema.required = required;
  return schema;
}

function buildOperation(e: ApiEndpoint, section: { id: string; title: string }, apiBase: string, seen: Set<string>): OpenApiOperation {
  const { params: pathParams } = openApiPath(e.path);
  const parameters: Record<string, unknown>[] = pathParams.map((name) => ({ name, in: "path", required: true, description: pathParamDescription(name, e), schema: { type: "string" } }));
  for (const q of splitParams(e.query)) {
    parameters.push({ name: q.name, in: "query", required: q.required, description: q.description, schema: schemaForType(q.type) });
  }
  const isV1 = e.path.startsWith("/api/v1/");
  const op: OpenApiOperation = {
    operationId: operationId(e, seen), summary: e.title, description: e.description, tags: [section.title],
    parameters: parameters.length ? parameters : undefined,
    responses: {
      "200": {
        description: "Success envelope (`error: 0`).",
        content: { "application/json": { schema: inferSchema(e.example.response), example: e.example.response } },
      },
      "400": { $ref: "#/components/responses/ValidationError" },
      "401": { $ref: "#/components/responses/Unauthorized" },
      "403": { $ref: "#/components/responses/Forbidden" },
      "404": { $ref: "#/components/responses/NotFound" },
      "429": { $ref: "#/components/responses/RateLimited" },
    },
  };
  if (e.permission) op["x-permission"] = e.permission;
  if (e.admin) op["x-admin-only"] = true;
  if (e.auth === "public") op.security = [];
  else if (e.auth === "session-or-anonymous") op.security = [{ bearerAuth: [] }, { apiKeyQuery: [] }, {}];
  else if (e.auth === "cron") op.security = [{ cronSecret: [] }];
  if (!isV1) op.servers = [{ url: apiBase }];
  if (e.params?.length || e.example.body !== undefined) {
    op.requestBody = {
      required: (e.params ?? []).some((p) => p.required),
      content: { "application/json": { schema: requestBodySchema(e), ...(e.example.body !== undefined ? { example: e.example.body } : {}) } },
    };
  }
  return op;
}

function errorResponse(description: string, message: string) {
  return { description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { error: 1, message } } } };
}

/**
 * Builds the OpenAPI document. `appBase` is the site origin (e.g. https://sho.rt); the default server is `${appBase}/api/v1`
 * and non-v1 endpoints (`/api/shorten`, `/api/unshorten`) carry an operation-level server override.
 */
export function buildOpenApi(appBase: string, siteName = "Premium URL Shortener", version = "1.0.0"): OpenApiDocument {
  const base = appBase.replace(/\/$/, "");
  const seen = new Set<string>();
  const paths: OpenApiDocument["paths"] = {};
  const tags: OpenApiDocument["tags"] = [];
  for (const section of API_SECTIONS) {
    tags.push({ name: section.title, description: section.description });
    for (const e of section.endpoints) {
      const { path } = openApiPath(e.path);
      const key = path.startsWith("/api/v1/") ? path.slice("/api/v1".length) : path.replace(/^\/api/, "");
      const method = e.method.toLowerCase() as Lowercase<HttpMethod>;
      paths[key] = paths[key] ?? {};
      paths[key][method] = buildOperation(e, section, `${base}/api`, seen);
    }
  }
  return {
    openapi: "3.1.0",
    info: {
      title: `${siteName} API`, version,
      description: [
        `REST API for ${siteName}: short links, campaigns, channels, pixels, domains, QR codes, bio pages, files and admin resources.`,
        "", "Every `/api/v1` request needs an API key sent as `Authorization: Bearer YOUR_API_KEY` (`?key=` works for GET requests).",
        "Successful responses return `{ \"error\": 0, ... }`; failures return `{ \"error\": 1, \"message\": \"...\" }` with a matching HTTP status.",
        "List endpoints accept `?page=` and `?limit=` (max 100) and return `{ data: [...], pagination: { page, limit, total, pages } }`.",
        "", `Key permissions: ${PERMISSION_KEYS.map((p) => `\`${p}\``).join(", ")}. \`*\` grants everything; \`links.*\` grants every link permission.`,
      ].join("\n"),
      contact: { url: `${base}/developers` },
    },
    servers: [{ url: `${base}/api/v1`, description: "Developer API v1" }],
    tags,
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API key", description: "API key created under Dashboard → Settings → API." },
        apiKeyQuery: { type: "apiKey", in: "query", name: "key", description: "Fallback for GET requests." },
        cronSecret: { type: "http", scheme: "bearer", description: "`CRON_SECRET` for scheduled jobs." },
      },
      schemas: {
        Error: { type: "object", required: ["error", "message"], properties: { error: { type: "integer", const: 1 }, message: { type: "string" } } },
        Pagination: { type: "object", properties: { page: { type: "integer" }, limit: { type: "integer" }, total: { type: "integer" }, pages: { type: "integer" } } },
        Envelope: { type: "object", required: ["error"], properties: { error: { type: "integer", const: 0 }, data: {}, message: { type: "string" }, pagination: { $ref: "#/components/schemas/Pagination" } } },
      },
      responses: {
        ValidationError: errorResponse("Validation error – the message explains what to fix.", "The url field is required"),
        Unauthorized: errorResponse("Missing or invalid API key.", "Invalid API key"),
        Forbidden: errorResponse("Permission denied – key lacks the permission, admin only, or inactive account.", "Permission denied"),
        NotFound: errorResponse("Resource not found.", "Not found"),
        RateLimited: errorResponse("Rate limit exceeded – wait for the next minute window.", "Rate limit exceeded"),
      },
    },
    security: [{ bearerAuth: [] }],
  };
}

// ---------------------------------------------------------------- playground catalog

export interface PlaygroundEndpoint {
  id: string; method: HttpMethod; path: string; title: string; description?: string;
  sectionId: string; sectionTitle: string; auth: "key" | "session-or-anonymous" | "public" | "cron"; permission?: string; admin: boolean;
  pathParams: string[]; query: NormalizedParam[]; body: NormalizedParam[];
  exampleBody?: unknown; exampleQuery?: Record<string, string>;
}

/** Plain-data view of the catalog for client components (no functions, no shared object references). */
export function playgroundCatalog(): PlaygroundEndpoint[] {
  const out: PlaygroundEndpoint[] = [];
  for (const section of API_SECTIONS) {
    for (const e of section.endpoints) {
      const { params } = openApiPath(e.path);
      out.push({
        id: `${e.method} ${e.path}`, method: e.method, path: e.path, title: e.title, description: e.description,
        sectionId: section.id, sectionTitle: section.title, auth: e.auth ?? "key", permission: e.permission, admin: !!e.admin,
        pathParams: params, query: splitParams(e.query), body: splitParams(e.params),
        exampleBody: e.example.body === undefined ? undefined : JSON.parse(JSON.stringify(e.example.body)) as unknown,
        exampleQuery: e.example.query ? { ...e.example.query } : undefined,
      });
    }
  }
  return out;
}
