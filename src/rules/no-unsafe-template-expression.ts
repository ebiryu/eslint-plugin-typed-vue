import type { Rule } from "eslint";
import ts from "typescript";
import { getTemplateTypeResolver, resolveVuePath } from "../services/template-type-resolver.ts";
import type { VueParserServices } from "./types.ts";

/**
 * Disallows `any` typed expressions in template interpolations ({{ }})
 * and v-bind directive values (:prop="expr").
 *
 * vue-tsc does not flag `any` in these positions because the generated code
 * simply accesses the expression without a type constraint.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow expressions with `any` type in template interpolations and v-bind",
    },
    messages: {
      unsafeInterpolation: "Unsafe use of expression of type `any` in template interpolation.",
      unsafeBinding: "Unsafe use of expression of type `any` in v-bind directive.",
    },
    schema: [],
  },
  create(context) {
    const filePath = resolveVuePath(context.filename);
    if (!filePath.endsWith(".vue")) return {};

    const resolver = getTemplateTypeResolver(filePath);
    if (!resolver) return {};

    const parserServices = context.sourceCode.parserServices as unknown as VueParserServices;
    if (!parserServices?.defineTemplateBodyVisitor) return {};

    function isAnyType(flags: number): boolean {
      return !!(flags & ts.TypeFlags.Any);
    }

    function checkExpression(node: any, messageId: string) {
      if (!node.range) return;

      const typeInfo = resolver!.getTypeAtSourceOffset(filePath, node.range[0], node.range[1]);

      if (!typeInfo) return;

      if (isAnyType(typeInfo.flags)) {
        context.report({ node, messageId });
      }
    }

    return parserServices.defineTemplateBodyVisitor({
      // {{ expr }}
      VExpressionContainer(node: any) {
        // Skip directive values — handled by VAttribute visitor below
        if (node.parent?.type === "VAttribute") return;

        const expression = node.expression;
        if (!expression) return;

        checkExpression(expression, "unsafeInterpolation");
      },

      // :prop="expr" / v-bind:prop="expr"
      "VAttribute[directive=true]"(node: any) {
        const name = node.key?.name?.name ?? node.key?.name;
        if (name !== "bind") return;

        const expression = node.value?.expression;
        if (!expression) return;

        checkExpression(expression, "unsafeBinding");
      },
    });
  },
};

export default rule;
