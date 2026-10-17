import DOMPurify from "dompurify";

// Field names such as "name" or "title" must survive, so DOMPurify's own name/id check is off;
// instead name/id are kept only on form controls (which cannot clobber document properties)
const FORM_CONTROLS = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON", "FIELDSET", "OUTPUT", "OPTION", "OPTGROUP"]);

// DocuGenie form HTML is user-supplied: keep the form controls and their fields, drop scripts, handlers,
// javascript: links, nested <form> tags (their content is kept) and anything that could post elsewhere
export function sanitizeFormHtml(html: string): string {
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if ((data.attrName === "name" || data.attrName === "id") && !FORM_CONTROLS.has(node.nodeName)) data.keepAttr = false;
  });
  try {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      SANITIZE_DOM: false,
      FORBID_TAGS: ["form", "style", "script", "iframe", "object", "embed", "base", "meta", "link"],
      FORBID_ATTR: ["action", "formaction", "formmethod", "formtarget", "formenctype", "srcdoc"],
    });
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute");
  }
}
