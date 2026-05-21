// Author: Raisul Islam (raisul.aust1@gmail.com)

// Render inline SVG icons next to Section Break titles.
//
// Icons are stored as `Section Icon` documents (for_doctype, fieldname, svg_markup)
// and fetched via section_icon.api.get_icons_for(doctype). Results are cached per
// session and invalidated via the `section_icon_updated` realtime event.
//
// SVG fills/strokes are adapted for light/dark desk themes (black↔white, greys inverted).
(function () {
	const cache = {};
	const pending = {};
	let realtime_bound = false;
	let theme_observer_bound = false;

	const NAMED_COLORS = {
		black: [0, 0, 0],
		white: [255, 255, 255],
		gray: [128, 128, 128],
		grey: [128, 128, 128],
		silver: [192, 192, 192],
		dimgrey: [105, 105, 105],
		dimgray: [105, 105, 105],
		darkgray: [169, 169, 169],
		darkgrey: [169, 169, 169],
		lightgray: [211, 211, 211],
		lightgrey: [211, 211, 211],
	};

	function get_theme() {
		return document.documentElement.getAttribute("data-theme") === "dark"
			? "dark"
			: "light";
	}

	function parse_color(value) {
		if (!value) return null;
		const raw = String(value).trim().toLowerCase();
		if (!raw || raw === "none" || raw === "transparent" || raw.startsWith("url(")) {
			return null;
		}
		if (raw === "currentcolor") return null;

		if (NAMED_COLORS[raw]) {
			const [r, g, b] = NAMED_COLORS[raw];
			return { r, g, b };
		}

		let match = raw.match(/^#([0-9a-f]{3,8})$/i);
		if (match) {
			let hex = match[1];
			if (hex.length === 3) {
				hex = hex
					.split("")
					.map((c) => c + c)
					.join("");
			}
			if (hex.length === 6) {
				return {
					r: parseInt(hex.slice(0, 2), 16),
					g: parseInt(hex.slice(2, 4), 16),
					b: parseInt(hex.slice(4, 6), 16),
				};
			}
		}

		match = raw.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
		if (match) {
			return {
				r: Math.min(255, Math.round(Number(match[1]))),
				g: Math.min(255, Math.round(Number(match[2]))),
				b: Math.min(255, Math.round(Number(match[3]))),
			};
		}

		return null;
	}

	function is_grayscale(rgb) {
		return Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b) < 30;
	}

	function luminance(rgb) {
		return (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) / 255;
	}

	function to_hex(rgb) {
		const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
		const h = (n) => clamp(n).toString(16).padStart(2, "0");
		return "#" + h(rgb.r) + h(rgb.g) + h(rgb.b);
	}

	function adapt_color(value, is_dark) {
		const rgb = parse_color(value);
		if (!rgb || !is_grayscale(rgb)) return null;

		const lum = luminance(rgb);

		if (is_dark) {
			if (lum <= 0.12) return "#ffffff";
			if (lum < 0.55) {
				const v = Math.round((1 - lum) * 255);
				return to_hex({ r: v, g: v, b: v });
			}
		} else {
			if (lum >= 0.88) return "#000000";
			if (lum > 0.45) {
				const v = Math.round((1 - lum) * 255);
				return to_hex({ r: v, g: v, b: v });
			}
		}

		return null;
	}

	function adapt_style(style, is_dark) {
		return style.replace(
			/(fill|stroke)\s*:\s*([^;]+)/gi,
			function (_match, prop, color) {
				const adapted = adapt_color(color.trim(), is_dark);
				return adapted ? prop + ": " + adapted : prop + ": " + color;
			}
		);
	}

	function adapt_svg_element(node, is_dark) {
		if (!node || node.nodeType !== 1) return;

		const tag = (node.tagName || "").toLowerCase();
		if (tag === "style" || tag === "defs") return;

		["fill", "stroke"].forEach(function (attr) {
			const val = node.getAttribute(attr);
			if (!val) return;
			const adapted = adapt_color(val, is_dark);
			if (adapted) node.setAttribute(attr, adapted);
		});

		const style = node.getAttribute("style");
		if (style) {
			const adapted_style = adapt_style(style, is_dark);
			if (adapted_style !== style) node.setAttribute("style", adapted_style);
		}

		Array.from(node.children || []).forEach(function (child) {
			adapt_svg_element(child, is_dark);
		});
	}

	function adapt_svg_markup(svg_markup, theme) {
		if (!svg_markup) return "";
		const is_dark = theme === "dark";
		const wrapper = document.createElement("div");
		wrapper.innerHTML = svg_markup.trim();
		const svg = wrapper.querySelector("svg");
		if (!svg) return svg_markup;
		adapt_svg_element(svg, is_dark);
		return svg.outerHTML;
	}

	function apply_theme_to_icons() {
		const theme = get_theme();
		$(".section-icon-svg").each(function () {
			const $el = $(this);
			const original = $el.data("original-svg");
			if (!original) return;
			$el.html(adapt_svg_markup(original, theme));
		});
	}

	function bind_theme_observer() {
		if (theme_observer_bound) return;
		const root = document.documentElement;
		const observer = new MutationObserver(function (mutations) {
			for (const m of mutations) {
				if (m.attributeName === "data-theme") {
					apply_theme_to_icons();
					break;
				}
			}
		});
		observer.observe(root, {
			attributes: true,
			attributeFilter: ["data-theme"],
		});
		theme_observer_bound = true;
	}

	function bind_realtime() {
		if (realtime_bound) return;
		if (!window.frappe || !frappe.realtime || !frappe.realtime.on) return;
		frappe.realtime.on("section_icon_updated", function (data) {
			if (data && data.for_doctype) delete cache[data.for_doctype];
		});
		realtime_bound = true;
	}

	function fetch_icons(doctype) {
		if (cache[doctype]) return Promise.resolve(cache[doctype]);
		if (pending[doctype]) return pending[doctype];

		pending[doctype] = frappe
			.xcall("section_icon.api.get_icons_for", { doctype: doctype })
			.then(function (rows) {
				const map = {};
				(rows || []).forEach(function (r) {
					if (r && r.fieldname) map[r.fieldname] = r.svg_markup || "";
				});
				cache[doctype] = map;
				delete pending[doctype];
				return map;
			})
			.catch(function () {
				delete pending[doctype];
				return {};
			});
		return pending[doctype];
	}

	function render(frm, icons) {
		if (!frm || !frm.layout || !frm.layout.sections) return;
		const theme = get_theme();
		frm.layout.sections.forEach(function (section) {
			if (!section || !section.df || !section.head) return;
			const svg = icons[section.df.fieldname];
			if (!svg) return;

			const $existing = section.head.find(".section-icon-svg");
			if ($existing.length) {
				$existing.data("original-svg", svg);
				$existing.html(adapt_svg_markup(svg, theme));
				return;
			}

			const $icon = $(
				'<span class="section-icon-svg" aria-hidden="true"></span>'
			);
			$icon.data("original-svg", svg);
			$icon.html(adapt_svg_markup(svg, theme));
			section.head.prepend($icon);
		});
	}

	function refresh(frm) {
		if (!frm || !frm.doctype) return;
		bind_realtime();
		bind_theme_observer();
		fetch_icons(frm.doctype).then(function (icons) {
			render(frm, icons);
		});
	}

	$(document).on("form-refresh", function (e, frm) {
		refresh(frm);
	});
})();
