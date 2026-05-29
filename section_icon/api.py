import frappe

CACHE_KEY_VERSION = "section_icon::version"
CACHE_KEY_BUNDLE = "section_icon::bundle"
CACHE_KEY_DOCTYPE_PREFIX = "section_icon::doctype::"


def _doctype_cache_key(doctype: str) -> str:
	return CACHE_KEY_DOCTYPE_PREFIX + doctype


@frappe.whitelist()
def get_icons_for(doctype: str) -> list[dict]:
	"""Return list of {fieldname, svg_markup, dark_svg_markup} for the given DocType.

	Available to any authenticated user; required to render section icons on forms.
	Backed by frappe.cache() (Redis); invalidated on Section Icon write.
	"""
	if not doctype:
		return []

	if frappe.session.user == "Guest":
		frappe.throw(frappe._("Not permitted"), frappe.PermissionError)

	key = _doctype_cache_key(doctype)
	rows = frappe.cache().get_value(key)
	if rows is None:
		rows = frappe.get_all(
			"Section Icon",
			filters={"for_doctype": doctype},
			fields=["fieldname", "svg_markup", "dark_svg_markup"],
		)
		frappe.cache().set_value(key, rows)
	return rows


@frappe.whitelist()
def get_section_breaks_for(doctype: str, ft: str = None) -> list[dict]:
	if not doctype:
		return []

	if frappe.session.user == "Guest":
		frappe.throw(frappe._("Not permitted"), frappe.PermissionError)

	if not frappe.db.exists("DocType", doctype):
		return []

	EXCLUDED_FOR_FIELD = {"Section Break", "Column Break", "Tab Break", "HTML"}

	if ft == "Field":
		keep = lambda dt: dt not in EXCLUDED_FOR_FIELD
	else:
		keep = lambda dt: dt == ft

	meta = frappe.get_meta(doctype)
	return [
		{"fieldname": df.fieldname, "label": (df.label or df.fieldname).strip()}
		for df in meta.fields
		if df.fieldname and keep(df.fieldtype)
	]
