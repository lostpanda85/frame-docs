// "On this page" list for long pages, built from the page's h2 headings.
// The pages themselves stay plain Markdown (no {:toc} markers), so they read
// cleanly on GitHub.com too. Inserted just before the first h2.
document.addEventListener("DOMContentLoaded", function () {
  var main = document.querySelector("#main-content main");
  if (!main) return;

  var headings = Array.prototype.filter.call(main.querySelectorAll("h2[id]"), function (h) {
    return !h.closest(".page-toc");
  });
  if (headings.length < 4) return;

  var nav = document.createElement("nav");
  nav.className = "page-toc";
  nav.setAttribute("aria-label", "On this page");

  var label = document.createElement("p");
  label.className = "page-toc-title text-delta";
  label.textContent = "On this page";
  nav.appendChild(label);

  var list = document.createElement("ul");
  headings.forEach(function (h) {
    // Drop the theme's hover anchor link before reading the heading text.
    var copy = h.cloneNode(true);
    copy.querySelectorAll(".anchor-heading").forEach(function (a) { a.remove(); });

    var link = document.createElement("a");
    link.href = "#" + encodeURIComponent(h.id);
    link.textContent = copy.textContent.trim();

    var item = document.createElement("li");
    item.appendChild(link);
    list.appendChild(item);
  });
  nav.appendChild(list);

  headings[0].parentNode.insertBefore(nav, headings[0]);
});
