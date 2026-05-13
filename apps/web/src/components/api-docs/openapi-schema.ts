import type { OpenAPISpec, Parameter, Schema } from "@/lib/openapi-types";

export function resolveRef(spec: OpenAPISpec, ref: string): Schema {
  const parts = ref.replace(/^#\//, "").split("/");
  let result: unknown = spec;
  for (const part of parts) {
    result = (result as Record<string, unknown>)?.[decodeURIComponent(part)];
  }
  return (result as Schema) ?? {};
}

export function resolveSchema(spec: OpenAPISpec, schema: Schema): Schema {
  return schema.$ref ? resolveRef(spec, schema.$ref) : schema;
}

function expandParameter(param: Parameter, spec: OpenAPISpec): Parameter[] {
  if (!param.schema?.$ref) return [param];

  const resolved = resolveSchema(spec, param.schema);
  const allOfProperties =
    resolved.allOf?.flatMap((part) => {
      const schema = resolveSchema(spec, part);
      return Object.entries(schema.properties ?? {}).map(([name, propertySchema]) => ({
        name,
        schema,
        propertySchema,
      }));
    }) ?? [];
  const directProperties = Object.entries(resolved.properties ?? {}).map(([name, propertySchema]) => ({
    name,
    schema: resolved,
    propertySchema,
  }));
  const properties = [...allOfProperties, ...directProperties];

  if (properties.length === 0) return [param];

  return properties.map(({ name, schema, propertySchema }) => ({
    ...param,
    name,
    required: schema.required?.includes(name) && propertySchema.default === undefined,
    description: propertySchema.description,
    schema: propertySchema,
  }));
}

export function expandParameters(params: Parameter[], spec: OpenAPISpec): Parameter[] {
  return params.flatMap((param) => expandParameter(param, spec));
}

export function exampleFromSchema(
  schema: Schema | undefined,
  spec: OpenAPISpec,
  options: { empty?: unknown } = {},
  seen = new Set<string>(),
): unknown {
  if (!schema) return options.empty ?? null;

  if (schema.$ref) {
    if (seen.has(schema.$ref)) return options.empty ?? null;
    seen.add(schema.$ref);
    return exampleFromSchema(resolveRef(spec, schema.$ref), spec, options, seen);
  }

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.oneOf?.[0]) return exampleFromSchema(schema.oneOf[0], spec, options, seen);
  if (schema.anyOf?.[0]) return exampleFromSchema(schema.anyOf[0], spec, options, seen);
  if (schema.allOf?.length) {
    const ownExample: unknown = exampleFromSchema(
      { ...schema, allOf: undefined },
      spec,
      options,
      new Set(seen),
    );
    return Object.assign(
      {},
      ...schema.allOf
        .map((part) => exampleFromSchema(part, spec, options, new Set(seen)))
        .filter((value): value is Record<string, unknown> =>
          Boolean(value && typeof value === "object" && !Array.isArray(value)),
        ),
      ownExample && typeof ownExample === "object" && !Array.isArray(ownExample) ? ownExample : {},
    );
  }

  const type = Array.isArray(schema.type) ? schema.type.find((value) => value !== "null") : schema.type;

  if (type === "array") return [exampleFromSchema(schema.items, spec, options, seen)];
  if (type === "object" || schema.properties) {
    return Object.fromEntries(
      Object.entries(schema.properties ?? {}).map(([key, propertySchema]) => [
        key,
        exampleFromSchema(propertySchema, spec, options, new Set(seen)),
      ]),
    );
  }
  if (type === "number" || type === "integer") return 0;
  if (type === "boolean") return true;
  if (type === "null") return null;
  return "string";
}
