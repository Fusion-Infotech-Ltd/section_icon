// Author: Raisul Islam (raisul.aust1@gmail.com)

// Populate Section Break fieldname with an autocomplete dropdown (not Dynamic Link).
frappe.ui.form.on("Section Icon", {
	onload(frm) {
		refresh_section_break_options(frm);
	},

	for_doctype(frm) {
		if (frm.doc.fieldname) {
			frm.set_value("fieldname", "");
		}
		if (frm.doc.field_type) {
			frm.set_value("field_type", "");
		}
	},

	field_type(frm) {
		if (frm.doc.fieldname) {
			frm.set_value("fieldname", "");
		}
		refresh_section_break_options(frm);
	},

	refresh(frm) {
		refresh_section_break_options(frm);
	},
});

function refresh_section_break_options(frm) {
	if (!frm.doc.field_type || !frm.doc.for_doctype) return;
	const control = frm.fields_dict.fieldname;

	if (!frm.doc.for_doctype) {
		frm.set_df_property("fieldname", "options", []);
		frm.set_df_property("fieldname", "read_only", 1);
		frm.set_df_property(
			"fieldname",
			"description",
			__("Select a DocType first to load available Section Breaks.")
		);
		control?.set_data?.([]);
		return;
	}

	frm.set_df_property("fieldname", "read_only", 0);
	frm.set_df_property(
		"fieldname",
		"description",
		__("Pick a Section Break from the target DocType form layout.")
	);

	frappe
		.xcall("section_icon.api.get_section_breaks_for", {
			doctype: frm.doc.for_doctype,
				ft: frm.doc.field_type,
		})
		.then(function (rows) {
			const options = (rows || []).map(function (row) {
				return {
					value: row.fieldname,
					label: row.label || row.fieldname,
					description: row.fieldname,
				};
			});

			frm.set_df_property("fieldname", "options", options);
			control?.set_data?.(options);

			if (frm.doc.fieldname) {
				const valid = options.some(function (o) {
					return o.value === frm.doc.fieldname;
				});
				if (!valid) {
					frm.set_value("fieldname", "");
				}
			}

			if (!options.length) {
				frappe.show_alert(
					{
						message: __("No Section Break fields found on {0}.", [
							frm.doc.for_doctype,
						]),
						indicator: "orange",
					},
					5
				);
			}
		});
}
