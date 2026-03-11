import type { Rule } from "eslint";
import ts from "typescript";
import { getTemplateTypeResolver } from "../services/template-type-resolver.ts";

/**
 * Checks that v-if / v-else-if / v-show directives use strictly boolean expressions.
 *
 * Uses Volar's template virtual code and source mappings to get type info for
 * template expressions from the TypeScript type checker.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require boolean expressions in v-if, v-else-if, and v-show directives",
    },
    messages: {
      notBoolean:
        "Unexpected non-boolean type '{{type}}' in conditional directive. Expected a boolean expression.",
    },
    schema: [],
  },
  create(context) {
    const filePath = context.filename;
    if (!filePath.endsWith(".vue")) return {};

    const resolver = getTemplateTypeResolver(filePath);
    if (!resolver) return {};

    const parserServices = context.sourceCode.parserServices as any;
    if (!parserServices?.defineTemplateBodyVisitor) return {};

    function checkDirective(node: any) {
      const expression = node.value?.expression;
      if (!expression) return;

      // expression.range gives the start/end offset in the .vue source file
      const sourceOffset = expression.range[0];
      const sourceEndOffset = expression.range[1];
      const typeInfo = resolver!.getTypeAtSourceOffset(filePath, sourceOffset, sourceEndOffset);

      if (!typeInfo) return;

      const type = typeInfo.flags;

      const isBooleanLike =
        !!(type & ts.TypeFlags.Boolean) ||
        !!(type & ts.TypeFlags.BooleanLiteral);

      if (isBooleanLike) return;

      // Also allow unions that resolve to boolean (e.g., true | false)
      if (
        typeInfo.typeString === "boolean" ||
        typeInfo.typeString === "true" ||
        typeInfo.typeString === "false"
      ) {
        return;
      }

      context.report({
        node: expression,
        messageId: "notBoolean",
        data: { type: typeInfo.typeString },
      });
    }

    // Use vue-eslint-parser's defineTemplateBodyVisitor to traverse template AST
    return parserServices.defineTemplateBodyVisitor({
      "VAttribute[directive=true]"(node: any) {
        const name = node.key?.name?.name ?? node.key?.name;
        if (name === "if" || name === "else-if" || name === "show") {
          checkDirective(node);
        }
      },
    });
  },
};

export default rule;
