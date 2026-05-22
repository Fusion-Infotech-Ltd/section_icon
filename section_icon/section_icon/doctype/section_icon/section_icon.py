# Author: Raisul Islam (raisul.aust1@gmail.com)

import re

import frappe
from frappe.model.document import Document


class SectionIcon(Document):
	def validate(self):
		
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
			if df.fieldtype != "Section Break":
				frappe.throw(
					frappe._("Field {0} on {1} is of type {2}, not Section Break.").format(
						frappe.bold(self.fieldname),
						frappe.bold(self.for_doctype),
						frappe.bold(df.fieldtype),
					)
				)

	def _load_svg_from_file(self, dark=False):
		"""Read the uploaded SVG file and populate svg_markup."""
		if not self.svg_file.lower().endswith(".svg"):
			frappe.throw(frappe._("Uploaded file must be an .svg file."))

		try:
			if dark:
				file_doc = frappe.get_doc("File", {"file_url": self.dark_svg_file})
			else:
				file_doc = frappe.get_doc("File", {"file_url": self.svg_file})
			content = file_doc.get_content()
		except frappe.DoesNotExistError:
			frappe.throw(frappe._("Uploaded file record not found. Please re-upload."))

		if isinstance(content, bytes):
			content = content.decode("utf-8")

		match = re.search(r"<svg[\s>]", content, re.IGNORECASE)
		if not match:
			frappe.throw(frappe._("No <svg> element found in the uploaded file."))

		if dark:
			self.dark_svg_markup = content[match.start():].strip()
		else:
			self.svg_markup = content[match.start():].strip()

	def on_update(self):
		frappe.publish_realtime(
			"section_icon_updated", {"for_doctype": self.for_doctype}, after_commit=True
		)

	def on_trash(self):
		frappe.publish_realtime(
			"section_icon_updated", {"for_doctype": self.for_doctype}, after_commit=True
		)