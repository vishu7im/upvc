export function normalizeSvgForPreview(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    let nextAttrs = attrs;

    if (!/\bviewBox=/i.test(nextAttrs)) {
      const width = parseNumericAttr(nextAttrs, "width");
      const height = parseNumericAttr(nextAttrs, "height");
      if (width && height) nextAttrs += ` viewBox="0 0 ${width} ${height}"`;
    }

    if (!/\bpreserveAspectRatio=/i.test(nextAttrs)) {
      nextAttrs += ' preserveAspectRatio="xMidYMid meet"';
    }
    if (!/\bfocusable=/i.test(nextAttrs)) nextAttrs += ' focusable="false"';
    if (!/\baria-hidden=/i.test(nextAttrs)) nextAttrs += ' aria-hidden="true"';

    return `<svg${nextAttrs}>`;
  });
}

function parseNumericAttr(attrs: string, attr: string): number | null {
  const match = attrs.match(new RegExp(`\\b${attr}=["']?([0-9.]+)`, "i"));
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
