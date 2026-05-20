// Render inline SVG icons next to Section Break titles.
//
// Icons are stored as `Section Icon` documents (for_doctype, fieldname, svg_markup)
// and fetched via section_icon.api.get_icons_for(doctype). Results are cached per
// session and invalidated via the `section_icon_updated` realtime event.
(function () {
	const cache = {};
	const pending = {};
	let realtime_bound = false;

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
		frm.layout.sections.forEach(function (section) {
			if (!section || !section.df || !section.head) return;
			const svg = icons[section.df.fieldname];
			if (!svg) return;
			if (section.head.find(".section-icon-svg").length) return;
			section.head.prepend(
				'<span class="section-icon-svg" aria-hidden="true">' + svg + "</span>"
			);
		});
	}

	function refresh(frm) {
		if (!frm || !frm.doctype) return;
		bind_realtime();
		fetch_icons(frm.doctype).then(function (icons) {
			render(frm, icons);
		});
	}

	$(document).on("form-refresh", function (e, frm) {
		refresh(frm);
	});
})();
