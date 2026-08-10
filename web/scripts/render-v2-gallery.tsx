import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { ComponentGallery } from "../components/v2/gallery";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(webRoot, "../Spec/v2/component-library");

function document(markup: string, title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <link rel="stylesheet" href="../../../web/app/v2.css">
  </head>
  <body data-v2>${markup}</body>
</html>
`;
}

mkdirSync(outputRoot, { recursive: true });
writeFileSync(
  resolve(outputRoot, "gallery.html"),
  document(renderToStaticMarkup(<ComponentGallery />), "V2 component library"),
);
writeFileSync(
  resolve(outputRoot, "gallery-drawer.html"),
  document(renderToStaticMarkup(<ComponentGallery showDrawer />), "V2 drawer component"),
);

console.log(`Rendered V2 gallery to ${outputRoot}`);
