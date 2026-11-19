// Render ```mermaid code blocks on the GitHub Pages site. GitHub.com renders them natively.
// Loaded with `defer` after mermaid.min.js (see _includes/head_custom.html). Kept in its own
// file because Just the Docs compresses inline HTML, which would break `//` comments in an
// inline <script>.
document.addEventListener("DOMContentLoaded", async function () {
  // If the script failed to load (CDN down, integrity mismatch), leave the code blocks as they are.
  if (!window.mermaid) return;

  // Kramdown + Rouge wrap fenced ```mermaid blocks in div.language-mermaid;
  // fall back to a bare code.language-mermaid in case the wrapper changes.
  var hosts = [];
  document.querySelectorAll("div.language-mermaid, pre > code.language-mermaid").forEach(function (el) {
    var host = el.matches("div.language-mermaid") ? el : el.closest("pre");
    if (host && hosts.indexOf(host) === -1) hosts.push(host);
  });
  if (hosts.length === 0) return;

  window.mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "strict",
    suppressErrorRendering: true,
    flowchart: { wrappingWidth: 320 }
  });

  for (var i = 0; i < hosts.length; i++) {
    var host = hosts[i];
    try {
      var result = await window.mermaid.render("frame-docs-diagram-" + i, host.textContent.trim());
      var div = document.createElement("div");
      div.className = "mermaid";
      div.innerHTML = result.svg;
      host.replaceWith(div);
    } catch (e) {
      // Keep the readable source if a diagram fails to render.
      console.warn("Mermaid: leaving diagram source visible", e);
    }
  }
});
