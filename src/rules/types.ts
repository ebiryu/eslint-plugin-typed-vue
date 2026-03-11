import type { Rule } from "eslint";

/**
 * Subset of vue-eslint-parser's ParserServices used by custom rules.
 * vue-eslint-parser does not export this type, so we define it here.
 */
export interface VueParserServices {
  defineTemplateBodyVisitor(
    templateBodyVisitor: { [key: string]: (...args: any) => void },
    scriptVisitor?: { [key: string]: (...args: any) => void },
    options?: { templateBodyTriggerSelector: "Program" | "Program:exit" },
  ): Rule.RuleListener;
}
