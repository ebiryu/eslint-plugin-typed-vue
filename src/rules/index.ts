import strictBooleanExpressions from "./strict-boolean-expressions.ts";
import noUnsafeTemplateExpression from "./no-unsafe-template-expression.ts";
import noUnsafeEventHandler from "./no-unsafe-event-handler.ts";

export const rules: Record<string, any> = {
  "strict-boolean-expressions": strictBooleanExpressions,
  "no-unsafe-template-expression": noUnsafeTemplateExpression,
  "no-unsafe-event-handler": noUnsafeEventHandler,
};
