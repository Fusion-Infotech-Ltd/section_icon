import frappe

from section_icon.api import (
	CACHE_KEY_BUNDLE,
	CACHE_KEY_VERSION,
)


def get_version() -> str:
	"""Return a short opaque token that changes whenever any Section Icon is written.

	Clients store this alongside their localStorage entries; a mismatch forces a refetch.
	"""
	v = frappe.cache().get_value(CACHE_KEY_VERSION)
	if not v:
		v = frappe.generate_hash(length=10)
		frappe.cache().set_value(CACHE_KEY_VERSION, v)
	return v


def get_all_icons() -> dict:
	"""Return {doctype: {fieldname: {svg_markup, dark_svg_markup}}} for every Section Icon."""
	cached = frappe.cache().get_value(CACHE_KEY_BUNDLE)
	if cached is not None:
		return cached

	rows = frappe.get_all(
		"Section Icon",
		fields=["for_doctype", "fieldname", "svg_markup", "dark_svg_markup"],
	)
	grouped: dict = {}
	for r in rows:
		dt = r.get("for_doctype")
		fn = r.get("fieldname")
		if not dt or not fn:
			continue
		grouped.setdefault(dt, {})[fn] = {
			"svg_markup": r.get("svg_markup") or "",
			"dark_svg_markup": r.get("dark_svg_markup") or "",
		}
	frappe.cache().set_value(CACHE_KEY_BUNDLE, grouped)
	return grouped


def boot_session(bootinfo):
	"""Attach version token and preloaded icon bundle to the Frappe boot payload."""
	if frappe.session.user == "Guest":
		return
	bootinfo.section_icon_version = get_version()
	bootinfo.section_icons = get_all_icons()
