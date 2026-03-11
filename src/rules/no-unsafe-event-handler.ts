import type { Rule } from "eslint";
import ts from "typescript";
import { getTemplateTypeResolver } from "../services/template-type-resolver.ts";
import type { VueParserServices } from "./types.ts";

/**
 * Disallows `any` typed expressions in event handler directives (@click, v-on:click, etc.).
 *
 * vue-tsc does not flag `any` handlers because the generated code assigns them
 * without a type constraint that would reject `any`.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow expressions with `any` type in event handler directives",
    },
    messages: {
      unsafeHandler: "Unsafe use of expression of type `any` as event handler.",
    },
    schema: [],
  },
  create(context) {
    const filePath = context.filename;
    if (!filePath.endsWith(".vue")) return {};

    const resolver = getTemplateTypeResolver(filePath);
    if (!resolver) return {};

    const parserServices = context.sourceCode.parserServices as unknown as VueParserServices;
    if (!parserServices?.defineTemplateBodyVisitor) return {};

    return parserServices.defineTemplateBodyVisitor({
      "VAttribute[directive=true]"(node: any) {
        const name = node.key?.name?.name ?? node.key?.name;
        if (name !== "on") return;

        const expression = node.value?.expression;
        if (!expression) return;

        const typeInfo = resolver!.getTypeAtSourceOffset(
          filePath,
          expression.range[0],
          expression.range[1],
        );

        if (!typeInfo) return;

        if (typeInfo.flags & ts.TypeFlags.Any) {
          context.report({
            node: expression,
            messageId: "unsafeHandler",
          });
        }
      },
    });
  },
};

export default rule;
