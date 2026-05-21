import frappe


@frappe.whitelist()
def get_icons_for(doctype: str) -> list[dict]:
	"""Return list of {fieldname, svg_markup} for the given DocType.

	Available to any authenticated user; required to render section icons on forms.
	"""
	if not doctype:
		return []

	if frappe.session.user == "Guest":
		frappe.throw(frappe._("Not permitted"), frappe.PermissionError)

	return frappe.get_all(
		"Section Icon",
		filters={"for_doctype": doctype},
		fields=["fieldname", "svg_markup"],
	)


@frappe.whitelist()
def get_section_breaks_for(doctype: str) -> list[dict]:
	"""Return Section Break fields for a DocType as {fieldname, label} for the form dropdown."""
	if not doctype:
		return []

	if frappe.session.user == "Guest":
		frappe.throw(frappe._("Not permitted"), frappe.PermissionError)

	if not frappe.db.exists("DocType", doctype):
		return []

	meta = frappe.get_meta(doctype)
	return [
		{
			"fieldname": df.fieldname,
			"label": (df.label or df.fieldname).strip(),
		}
		for df in meta.fields
		if df.fieldtype == "Section Break" and df.fieldname
	]
