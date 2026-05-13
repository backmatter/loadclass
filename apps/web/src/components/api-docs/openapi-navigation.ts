import type { HttpMethod, OpenAPISpec, Operation, Schema } from "@/lib/openapi-types";

export const HTTP_METHODS: HttpMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
];

export type OperationGroup = Map<
  string,
  Array<{ method: HttpMethod; path: string; operation: Operation }>
>;

export type OperationItem = {
  tag: string;
  method: HttpMethod;
  path: string;
  operation: Operation;
};

export function groupOperationsByTag(spec: OpenAPISpec): OperationGroup {
  const groups: OperationGroup = new Map();

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      const tags = operation.tags?.length ? operation.tags : ["Other"];
      for (const tag of tags) {
        if (!groups.has(tag)) groups.set(tag, []);
        groups.get(tag)!.push({ method, path, operation });
      }
    }
  }

  const ordered: OperationGroup = new Map();
  for (const tag of spec.tags ?? []) {
    if (groups.has(tag.name)) ordered.set(tag.name, groups.get(tag.name)!);
  }
  for (const [tag, operations] of groups) {
    if (!ordered.has(tag)) ordered.set(tag, operations);
  }
  return ordered;
}

export function operationKey(method: HttpMethod, path: string): string {
  return `${method}:${path}`;
}

export function operationItems(groups: OperationGroup): OperationItem[] {
  return Array.from(groups.entries()).flatMap(([tag, operations]) =>
    operations.map((operation) => ({ tag, ...operation })),
  );
}

export function collectSchemas(spec: OpenAPISpec): Array<{ name: string; schema: Schema }> {
  const models = Object.entries(spec.components?.schemas ?? {}).map(([name, schema]) => ({
    name,
    schema,
  }));

  const seen = new Set(models.map((model) => JSON.stringify(model.schema)));

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      const label = operation.summary || `${method.toUpperCase()} ${path}`;

      for (const [contentType, media] of Object.entries(operation.requestBody?.content ?? {})) {
        if (!media.schema) continue;
        const key = JSON.stringify(media.schema);
        if (seen.has(key)) continue;
        seen.add(key);
        models.push({ name: `${label} request (${contentType})`, schema: media.schema });
      }

      for (const [status, response] of Object.entries(operation.responses ?? {})) {
        for (const [contentType, media] of Object.entries(response.content ?? {})) {
          if (!media.schema) continue;
          const key = JSON.stringify(media.schema);
          if (seen.has(key)) continue;
          seen.add(key);
          models.push({ name: `${label} ${status} (${contentType})`, schema: media.schema });
        }
      }
    }
  }

  return models;
}
