# Author: Raisul Islam (raisul.aust1@gmail.com)

import re

import frappe
from frappe.model.document import Document

from section_icon.api import (
	CACHE_KEY_BUNDLE,
	CACHE_KEY_VERSION,
	_doctype_cache_key,
)


class SectionIcon(Document):
	def validate(self):
		if not self.svg_file and not self.svg_markup:
			frappe.throw(
				frappe._("Provide either an SVG file or paste SVG markup directly.")
			)
		
		if not self.use_same_icon_in_dark_mode:
			self._load_svg_from_file(dark=True)
			self._load_svg_from_file()

		else: 
			self._load_svg_from_file()
		
		if not self.svg_markup:
			frappe.throw(
				frappe._("Provide either an SVG file or paste SVG markup directly.")
			)

		if "<svg" not in self.svg_markup.strip().lower():
			frappe.throw(
				frappe._("The SVG markup does not appear to contain a valid <svg> element.")
			)

		if self.for_doctype and self.fieldname:
			meta = frappe.get_meta(self.for_doctype)
			df = meta.get_field(self.fieldname)
			if not df:
				frappe.throw(
					frappe._("Field {0} does not exist on DocType {1}.").format(
						frappe.bold(self.fieldname), frappe.bold(self.for_doctype)
					)
				)
		
		if self.use_same_icon_in_dark_mode:
			self.dark_svg_markup = ""
			self.dark_svg_file = None


	def _load_svg_from_file(self, dark=False):
		"""Read the uploaded SVG file and populate svg_markup."""

		if dark:
			if not self.dark_svg_file:
				return
			if not self.dark_svg_file.lower().endswith(".svg") and "<svg" not in (self.dark_svg_markup or "").lower():
				frappe.throw(frappe._("Uploaded dark mode file must be an .svg file."))
		else:
			if not self.svg_file:
				return
			if not self.svg_file.lower().endswith(".svg") and "<svg" not in (self.svg_markup or "").lower():
				frappe.throw(frappe._("Uploaded file must be an .svg file."))

		try:
			content = ""
			file_doc = ""
			if dark and self.dark_svg_file:
				file_doc = frappe.get_doc("File", {"file_url": self.dark_svg_file})
			elif not dark and self.svg_file:
				file_doc = frappe.get_doc("File", {"file_url": self.svg_file})
			if file_doc:
				content = file_doc.get_content() if file_doc else ""

		except frappe.DoesNotExistError:
			content = self.dark_svg_markup if dark else self.svg_markup
			# frappe.throw(frappe._("Uploaded file record not found. Please re-upload."))

		if isinstance(content, bytes):
			content = content.decode("utf-8")

		match = re.search(r"<svg[\s>]", content, re.IGNORECASE)
		if not match:
			frappe.throw(frappe._("No <svg> element found in the uploaded file."))

		if dark:
			self.dark_svg_markup = content[match.start():].strip()
		else:
			self.svg_markup = content[match.start():].strip()

	def _invalidate_caches(self):
		"""Drop server-side caches so the next read repopulates and clients refetch."""
		cache = frappe.cache()
		if self.for_doctype:
			cache.delete_value(_doctype_cache_key(self.for_doctype))
		cache.delete_value(CACHE_KEY_BUNDLE)
		cache.delete_value(CACHE_KEY_VERSION)

	def on_update(self):
		self._invalidate_caches()
		frappe.publish_realtime(
			"section_icon_updated", {"for_doctype": self.for_doctype}, after_commit=True
		)

	def on_trash(self):
		self._invalidate_caches()
		frappe.publish_realtime(
			"section_icon_updated", {"for_doctype": self.for_doctype}, after_commit=True
		)