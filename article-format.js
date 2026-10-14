(() => {
  const allowedTags = new Set([
    "A", "B", "BLOCKQUOTE", "BR", "DIV", "EM", "FONT", "H2", "H3", "I",
    "LI", "OL", "P", "S", "SPAN", "STRONG", "U", "UL"
  ]);
  const discardedTags = new Set(["IFRAME", "OBJECT", "SCRIPT", "STYLE", "SVG", "VIDEO", "AUDIO"]);
  const allowedFonts = new Set([
    "arial", "courier new", "georgia", "manrope", "times new roman", "verdana"
  ]);

  function safeColor(value) {
    const color = value.trim();
    if (/^#[\da-f]{3,8}$/i.test(color) || /^rgba?\(\s*[\d.% ,/]+\)$/i.test(color)) return color;
    if (/^(black|white|red|green|blue|gray|grey|orange|purple|navy|teal|maroon|olive)$/i.test(color)) return color;
    return "";
  }

  function safeStyle(value) {
    const result = [];
    for (const declaration of value.split(";")) {
      const separator = declaration.indexOf(":");
      if (separator < 0) continue;
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const content = declaration.slice(separator + 1).trim();
      if (property === "color") {
        const color = safeColor(content);
        if (color) result.push(`color: ${color}`);
      } else if (property === "font-family") {
        const font = content.split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase();
        if (allowedFonts.has(font)) result.push(`font-family: "${font}"`);
      } else if (property === "font-size" && /^\d{1,2}(?:\.\d+)?(?:px|pt|em|rem)$/.test(content)) {
        const amount = Number.parseFloat(content);
        if (amount >= 8 && amount <= 72) result.push(`font-size: ${content}`);
      } else if (property === "text-align" && /^(left|right|center|justify)$/.test(content)) {
        result.push(`text-align: ${content}`);
      }
    }
    return result.join("; ");
  }

  function copyChildren(source, destination) {
    for (const node of source.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        destination.append(document.createTextNode(node.nodeValue || ""));
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = node.tagName.toUpperCase();
      if (discardedTags.has(tag)) continue;
      if (!allowedTags.has(tag)) {
        copyChildren(node, destination);
        continue;
      }

      const element = document.createElement(tag === "FONT" ? "span" : tag.toLowerCase());
      const styles = safeStyle(node.getAttribute("style") || "");
      if (styles) element.setAttribute("style", styles);
      const alignment = node.getAttribute("align");
      if (/^(left|right|center|justify)$/i.test(alignment || "")) {
        element.style.textAlign = alignment.toLowerCase();
      }
      if (tag === "FONT") {
        const legacyColor = safeColor(node.getAttribute("color") || "");
        const legacyFont = (node.getAttribute("face") || "").split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase();
        const legacySize = {
          "1": "10px", "2": "13px", "3": "16px", "4": "18px",
          "5": "24px", "6": "32px", "7": "48px"
        }[node.getAttribute("size") || ""];
        const legacyStyles = [
          legacyColor && `color: ${legacyColor}`,
          allowedFonts.has(legacyFont) && `font-family: "${legacyFont}"`,
          legacySize && `font-size: ${legacySize}`
        ].filter(Boolean);
        if (legacyStyles.length) {
          const combined = [element.getAttribute("style"), ...legacyStyles].filter(Boolean).join("; ");
          element.setAttribute("style", combined);
        }
      }
      if (tag === "A") {
        const href = node.getAttribute("href") || "";
        try {
          const url = new URL(href, window.location.href);
          if (["http:", "https:", "mailto:"].includes(url.protocol)) element.setAttribute("href", url.href);
        } catch {
          // Invalid link targets are omitted.
        }
      }
      copyChildren(node, element);
      destination.append(element);
    }
  }

  function sanitize(value) {
    const parsed = new DOMParser().parseFromString(String(value || ""), "text/html");
    const fragment = document.createDocumentFragment();
    if (!parsed.body.children.length) {
      const paragraphs = (parsed.body.textContent || "").split(/\n\s*\n/).filter((text) => text.trim());
      for (const text of paragraphs) {
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        fragment.append(paragraph);
      }
    } else {
      copyChildren(parsed.body, fragment);
    }
    const container = document.createElement("div");
    container.append(fragment);
    return container.innerHTML;
  }

  window.PulsoArticleFormat = Object.freeze({ sanitize });
})();
