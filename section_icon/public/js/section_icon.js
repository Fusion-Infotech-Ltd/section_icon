// Author: Raisul Islam (raisul.aust1@gmail.com)
// Fully native Frappe Framework field dictionary integration.
(function () {
    const cache = {};
    const pending = {};
    let realtime_bound = false;
    let theme_observer_bound = false;
    let boot_hydrated = false;

    const STORAGE_PREFIX = "section_icon:v1:";
    const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

    function get_boot_version() {
        return (window.frappe && frappe.boot && frappe.boot.section_icon_version) || "";
    }

    function hydrate_from_boot() {
        if (boot_hydrated) return;
        boot_hydrated = true;
        const preload = window.frappe && frappe.boot && frappe.boot.section_icons;
        if (!preload || typeof preload !== "object") return;
        Object.keys(preload).forEach(function (doctype) {
            if (!cache[doctype]) cache[doctype] = preload[doctype] || {};
        });
    }

    function read_local(doctype) {
        try {
            const raw = localStorage.getItem(STORAGE_PREFIX + doctype);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.version !== get_boot_version()) return null;
            if (!parsed.ts || Date.now() - parsed.ts > STORAGE_TTL_MS) return null;
            return parsed.icons || null;
        } catch (e) {
            return null;
        }
    }

    function write_local(doctype, icons) {
        try {
            localStorage.setItem(STORAGE_PREFIX + doctype, JSON.stringify({
                icons: icons,
                version: get_boot_version(),
                ts: Date.now(),
            }));
        } catch (e) {
            // quota or unavailable — silently skip
        }
    }

    function clear_local(doctype) {
        try {
            if (doctype) {
                localStorage.removeItem(STORAGE_PREFIX + doctype);
                return;
            }
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.indexOf(STORAGE_PREFIX) === 0) localStorage.removeItem(key);
            }
        } catch (e) {
            // ignore
        }
    }

    const NAMED_COLORS = {
        black: [0, 0, 0], white: [255, 255, 255], gray: [128, 128, 128],
        grey: [128, 128, 128], silver: [192, 192, 192], dimgrey: [105, 105, 105],
        dimgray: [105, 105, 105], darkgray: [169, 169, 169], darkgrey: [169, 169, 169],
        lightgray: [211, 211, 211], lightgrey: [211, 211, 211],
    };
    
    function get_theme() {
        return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    }

    function parse_color(value) {
        if (!value) return null;
        const raw = String(value).trim().toLowerCase();
        if (!raw || raw === "none" || raw === "transparent" || raw.startsWith("url(")) return null;
        if (raw === "currentcolor") return null;

        if (NAMED_COLORS[raw]) {
            const [r, g, b] = NAMED_COLORS[raw];
            return { r, g, b };
        }

        let match = raw.match(/^#([0-9a-f]{3,8})$/i);
        if (match) {
            let hex = match[1];
            if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
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

    function pick_svg(entry, theme) {
        if (!entry) return "";
        const light = entry.svg_markup || "";
        const dark = entry.dark_svg_markup || "";
        if (theme === "dark") {
            if (dark) return dark;
            return adapt_svg_markup(light, theme);
        }
        return light;
    }

    function apply_theme_to_icons() {
        const theme = get_theme();
        $(".custom-form-icon-svg").each(function () {
            const $el = $(this);
            const entry = $el.data("svg-entry");
            if (!entry) return;
            $el.html(pick_svg(entry, theme));
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
            if (data && data.for_doctype) {
                delete cache[data.for_doctype];
                clear_local(data.for_doctype);
            } else {
                Object.keys(cache).forEach(function (k) { delete cache[k]; });
                clear_local(null);
            }
        });
        realtime_bound = true;
    }

    function fetch_icons(doctype) {
        hydrate_from_boot();
        if (cache[doctype]) return Promise.resolve(cache[doctype]);
        if (pending[doctype]) return pending[doctype];

        const stored = read_local(doctype);
        if (stored) {
            cache[doctype] = stored;
            return Promise.resolve(stored);
        }

        pending[doctype] = frappe
            .xcall("section_icon.api.get_icons_for", { doctype: doctype })
            .then(function (rows) {
                const map = {};
                (rows || []).forEach(function (r) {
                    if (r && r.fieldname) map[r.fieldname] = {
                        svg_markup: r.svg_markup || "",
                        dark_svg_markup: r.dark_svg_markup || ""
                    };
                });
                cache[doctype] = map;
                write_local(doctype, map);
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
		if (!frm || !frm.fields_dict || !frm.wrapper) return;
		const theme = get_theme();
		const $form_wrapper = $(frm.wrapper);

		// Build fieldname → col.wrapper map by walking frm.layout.sections
		const column_dom_map = {};
		if (frm.layout && Array.isArray(frm.layout.sections)) {        
			frm.layout.sections.forEach(function (section) {             
				if (!section || !Array.isArray(section.columns)) return;
				section.columns.forEach(function (col) {
					if (col && col.df && col.df.fieldtype === "Column Break" && col.df.fieldname) {
						if (col.wrapper && col.wrapper.length) {
							column_dom_map[col.df.fieldname] = col.wrapper; 
						}
					}
				});
			});
		}

		Object.keys(icons).forEach(function (fieldname) {
			const entry = icons[fieldname];
			if (!entry) return;
			if (column_dom_map.hasOwnProperty(fieldname)) {             
				const $col_wrapper = column_dom_map[fieldname];        
				const $target = $col_wrapper.find(".column-label");  

				if (!$target || !$target.length) return;

				const $existing = $target.find(".custom-form-icon-svg");
				if ($existing.length) {
					$existing.data("svg-entry", entry);
					$existing.html(pick_svg(entry, theme));
					return;
				}
				const $icon = $(`<span class="custom-form-icon-svg column-icon-svg" aria-hidden="true"></span>`);
				$icon.data("svg-entry", entry);
				$icon.html(pick_svg(entry, theme));
				$target.prepend($icon);
				return;
			}

			// section logic — untouched below this line
			const field = frm.fields_dict[fieldname];
			if (!field) return;

			let $target = null;
			let contextClass = "";

			let $wrapper = field.$wrapper || $form_wrapper.find(`[data-fieldname="${fieldname}"]`);
			if (!$wrapper || !$wrapper.length) return;

			if (field.df && field.df.fieldtype === "Section Break") {
				$target = $wrapper.find(".section-head");
				if (!$target.length) $target = $wrapper.find(".form-section-heading");
				contextClass = "section-icon-svg";
			} else {
				if (field.label_area) {
					$target = $(field.label_area);
				} else if (field.$label) {
					$target = field.$label;
				} else {
					$target = $wrapper.find(".control-label");
				}
				contextClass = "field-icon-svg";
			}

			if (!$target || !$target.length) return;

			const $existing = $target.find(".custom-form-icon-svg");
			if ($existing.length) {
				$existing.data("svg-entry", entry);
				$existing.html(pick_svg(entry, theme));
				return;
			}

			const $icon = $(`<span class="custom-form-icon-svg ${contextClass}" aria-hidden="true"></span>`);
			$icon.data("svg-entry", entry);
			$icon.html(pick_svg(entry, theme));
			$target.prepend($icon);
		});
	}
    function refresh(frm) {
        if (!frm || !frm.doctype) return;
        bind_realtime();
        bind_theme_observer();

        fetch_icons(frm.doctype).then(function (icons) {
            // A synchronous cache hit (L1/L2/L4) resolves inside the same microtask as
            // the form-refresh handler, before Frappe finishes attaching column-label /
            // control-label / label_area DOM. Defer to the next macrotask so those nodes
            // exist by the time render() looks for them.
            const run = function () {
                if (frm.layout && frm.layout.sections) {
                    render(frm, icons);
                } else {
                    setTimeout(function () { render(frm, icons); }, 100);
                }
            };
            setTimeout(run, 0);
        });
    }
    $(document).on("form-refresh", function (e, frm) {
        refresh(frm);
    });
})();