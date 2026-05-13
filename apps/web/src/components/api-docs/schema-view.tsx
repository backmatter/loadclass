import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Schema, OpenAPISpec } from "@/lib/openapi-types";
import { CopyButton } from "./copy-button";
import { exampleFromSchema, resolveSchema } from "./openapi-schema";

function refName(ref: string) {
  return ref.split("/").pop() ?? ref;
}

function schemaType(schema: Schema, spec: OpenAPISpec): string {
  if (schema.$ref) return refName(schema.$ref);
  const resolved = resolveSchema(spec, schema);

  if (resolved.const !== undefined) return JSON.stringify(resolved.const);
  if (resolved.enum?.length) return resolved.enum.map(String).join(" | ");
  if (resolved.oneOf?.length) return schemaChoiceType(resolved.oneOf, spec, "one of");
  if (resolved.anyOf?.length) return schemaChoiceType(resolved.anyOf, spec, "any of");
  if (resolved.allOf?.length) return "all of";

  const type = Array.isArray(resolved.type) ? resolved.type.join(" | ") : resolved.type;
  const format = resolved.format ? `<${resolved.format}>` : "";
  const nullable = resolved.nullable ? " | null" : "";

  if (type === "array") {
    const itemType = resolved.items ? schemaType(resolved.items, spec) : "any";
    return `${itemType}[]${nullable}`;
  }

  if (type === "object" && resolved.additionalProperties && !resolved.properties) {
    const valueType =
      typeof resolved.additionalProperties === "object"
        ? schemaType(resolved.additionalProperties, spec)
        : "any";
    return `Record<string, ${valueType}>${nullable}`;
  }

  return `${type ?? "any"}${format}${nullable}`;
}

function literalValue(schema: Schema | undefined, spec: OpenAPISpec) {
  if (!schema) return undefined;
  const resolved = resolveSchema(spec, schema);

  if (resolved.const !== undefined) return resolved.const;
  if (resolved.enum?.length === 1) return resolved.enum[0];
  return undefined;
}

function schemaChoiceLabel(schema: Schema, spec: OpenAPISpec, index: number) {
  const resolved = resolveSchema(spec, schema);
  const title = schemaTitle(schema, spec);
  const discriminator =
    literalValue(resolved.properties?.type, spec) ?? literalValue(resolved.properties?.kind, spec);
  const type = Array.isArray(resolved.type) ? resolved.type.join(" | ") : resolved.type;

  if (title) return title;
  if (discriminator !== undefined) return String(discriminator);
  if (type === "null") return "null";
  if (type && type !== "object") return schemaType(resolved, spec);
  return `option ${index + 1}`;
}

function schemaChoiceType(schemas: Schema[], spec: OpenAPISpec, fallback: string) {
  const labels = schemas.map((schema, index) => schemaChoiceLabel(schema, spec, index));
  return new Set(labels).size === labels.length ? labels.join(" | ") : fallback;
}

function hasNested(schema: Schema, spec: OpenAPISpec) {
  const resolved = resolveSchema(spec, schema);
  return Boolean(
    resolved.properties ||
    resolved.items ||
    (typeof resolved.additionalProperties === "object" && resolved.additionalProperties) ||
    resolved.oneOf?.length ||
    resolved.anyOf?.length ||
    resolved.allOf?.length,
  );
}

function schemaTitle(schema: Schema, spec: OpenAPISpec) {
  const resolved = resolveSchema(spec, schema);
  return resolved.title ?? (schema.$ref ? refName(schema.$ref) : undefined);
}

function orderedPropertyEntries(schema: Schema) {
  const entries = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);

  return entries.sort(([left], [right]) => {
    const leftRequired = required.has(left);
    const rightRequired = required.has(right);

    if (leftRequired === rightRequired) return 0;
    return leftRequired ? -1 : 1;
  });
}

function SchemaTitleBar({
  schema,
  spec,
  title,
}: {
  schema: Schema;
  spec: OpenAPISpec;
  title?: string;
}) {
  const resolved = resolveSchema(spec, schema);
  const displayTitle = title ?? schemaTitle(schema, spec) ?? "schema";
  const exampleJson = JSON.stringify(exampleFromSchema(schema, spec), null, 2);

  return (
    <div className="grid grid-cols-1 items-baseline gap-2 sm:grid-cols-[minmax(9rem,1fr)_minmax(8rem,auto)] sm:gap-x-4">
      <div className="min-w-0">
        <span className="font-mono text-xs font-medium text-foreground">{displayTitle}</span>
        {resolved.description && (
          <p className="mt-0.5 text-xs/relaxed text-muted-foreground">{resolved.description}</p>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-start gap-2 sm:justify-end">
        <code className="min-w-0 break-words text-left font-mono text-xs text-muted-foreground sm:text-right">
          {schemaType(resolved, spec)}
        </code>
        <CopyButton value={exampleJson} label="Example" />
      </div>
    </div>
  );
}

function SchemaHeader({
  name,
  schema,
  spec,
  required,
  open,
  expandable,
  onToggle,
}: {
  name?: string;
  schema: Schema;
  spec: OpenAPISpec;
  required?: boolean;
  open: boolean;
  expandable: boolean;
  onToggle: () => void;
}) {
  const resolved = resolveSchema(spec, schema);
  const title = name ?? schemaTitle(schema, spec);

  return (
    <div
      className={expandable ? "cursor-pointer select-none py-2" : "py-2"}
      onClick={expandable ? onToggle : undefined}
    >
      <div className="grid grid-cols-1 items-baseline gap-y-1 sm:grid-cols-[minmax(9rem,1fr)_minmax(8rem,auto)] sm:gap-x-4">
        <div className="flex min-w-0 items-center gap-1.5">
          {expandable && (
            <ChevronRightIcon
              className={`size-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
            />
          )}
          {!expandable && <span className="w-3 shrink-0" />}
          {title && (
            <span className="min-w-0 truncate font-mono text-xs text-foreground">{title}</span>
          )}
          {required && (
            <span className="font-mono text-[10px] uppercase text-destructive">required</span>
          )}
        </div>
        <code className="min-w-0 break-words pl-4 font-mono text-xs text-muted-foreground sm:justify-self-end sm:pl-0 sm:text-right">
          {schemaType(schema, spec)}
        </code>
        {resolved.default !== undefined && (
          <span className="pl-4 font-mono text-[10px] text-muted-foreground/70 sm:col-span-2">
            default {JSON.stringify(resolved.default)}
          </span>
        )}
      </div>
      {resolved.description && (
        <p className="mt-0.5 pl-4 text-xs/relaxed text-muted-foreground">{resolved.description}</p>
      )}
    </div>
  );
}

function CompositionRows({
  kind,
  schemas,
  spec,
  depth,
}: {
  kind: "oneOf" | "anyOf" | "allOf";
  schemas?: Schema[];
  spec: OpenAPISpec;
  depth: number;
}) {
  if (!schemas?.length) return null;

  return (
    <div>
      {schemas.map((variant, index) => (
        <SchemaRow
          key={`${kind}-${index}`}
          name={schemaChoiceLabel(variant, spec, index)}
          schema={variant}
          spec={spec}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function SchemaRow({
  name,
  schema,
  spec,
  required,
  depth,
  hideHeader = false,
}: {
  name?: string;
  schema: Schema;
  spec: OpenAPISpec;
  required?: boolean;
  depth: number;
  hideHeader?: boolean;
}) {
  const [open, setOpen] = useState(depth < 2);
  const resolved = resolveSchema(spec, schema);
  const expandable = !hideHeader && hasNested(schema, spec) && depth < 6;
  const contentOpen = hideHeader || open;
  const childDepth = hideHeader ? depth : depth + 1;

  return (
    <div className={depth > 0 ? "border-l border-border/50 pl-3" : ""}>
      {!hideHeader && (
        <SchemaHeader
          name={name}
          schema={schema}
          spec={spec}
          required={required}
          open={open}
          expandable={expandable}
          onToggle={() => setOpen((value) => !value)}
        />
      )}

      {contentOpen && hasNested(schema, spec) && (
        <div className="pb-1">
          {resolved.properties && (
            <div>
              {orderedPropertyEntries(resolved).map(([propertyName, propertySchema]) => (
                <SchemaRow
                  key={propertyName}
                  name={propertyName}
                  schema={propertySchema}
                  spec={spec}
                  required={resolved.required?.includes(propertyName)}
                  depth={childDepth}
                />
              ))}
            </div>
          )}

          {resolved.items && (
            <SchemaRow name="items" schema={resolved.items} spec={spec} depth={childDepth} />
          )}

          {typeof resolved.additionalProperties === "object" && (
            <SchemaRow
              name="additional properties"
              schema={resolved.additionalProperties}
              spec={spec}
              depth={childDepth}
            />
          )}

          <CompositionRows kind="oneOf" schemas={resolved.oneOf} spec={spec} depth={depth} />
          <CompositionRows kind="anyOf" schemas={resolved.anyOf} spec={spec} depth={depth} />
          <CompositionRows kind="allOf" schemas={resolved.allOf} spec={spec} depth={depth} />
        </div>
      )}
    </div>
  );
}

export function SchemaView({
  spec,
  schema,
  title,
}: {
  spec: OpenAPISpec;
  schema: Schema;
  title?: string;
}) {
  const resolved = resolveSchema(spec, schema);
  const isEmpty =
    !hasNested(schema, spec) && !resolved.description && !resolved.type && !schema.$ref;
  const nested = hasNested(schema, spec);
  const hasTitleBar = Boolean(title) || nested;

  return (
    <div className="min-w-0 rounded-md border bg-card px-3 py-2">
      {hasTitleBar && (
        <>
          <SchemaTitleBar schema={schema} spec={spec} title={title} />
          <Separator className="my-2" />
        </>
      )}
      {isEmpty ? (
        <p className="text-xs text-muted-foreground">Any JSON value.</p>
      ) : (
        <SchemaRow schema={schema} spec={spec} depth={0} hideHeader={nested} />
      )}
    </div>
  );
}
