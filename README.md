# Section Icon

A Frappe app that adds SVG icons to Section Break fields in your forms

Icons are stored in a dedicated **Section Icon** doctype and rendered inline next to section titles at runtime via a lightweight client script.

# Images

**Light Theme**
<img width="480" height="270" alt="image" src="https://github.com/user-attachments/assets/003a8a98-bd59-44ea-97ba-460ed8bf9b7b" />

**Dark Theme**
<img width="480" height="270" alt="image" src="https://github.com/user-attachments/assets/092af0c3-24aa-4556-8230-ef83fe716404" />

---

## How it works

1. You create a **Section Icon** record linking a DocType, a Section Break fieldname, and an SVG icon.
2. A bundled JS script listens for `form-refresh` events, fetches the icons for the current DocType (cached per session), and prepends each SVG inline next to the matching section title.
3. Cache is invalidated automatically via a Frappe realtime event whenever an icon is saved or deleted.

No Custom Fields are added to any DocType. No monkey-patching of core forms.

---

## Requirements

- Frappe Framework **v15** or **v16**
- Python 3.10+

---

## Installation

```bash
# From your bench directory
bench get-app https://github.com/raisulislam0/section_icon.git
bench --site your-site install-app section_icon
bench --site your-site migrate
bench --site your-site clear-cache
bench build --app section_icon
```

---

## Usage

### 1. Create a Section Icon record

Go to **Section Icon List → New** and fill in:

| Field | Description |
|---|---|
| **DocType** | The target DocType (e.g. `Employee`) |
| **Section Break Fieldname** | Select the section break fieldname (e.g. `passport_details_section`) |
| **SVG File** | Upload an `.svg` file — markup is extracted automatically |
| **SVG Markup** | Or paste raw SVG markup directly |

Either **SVG File** or **SVG Markup** must be provided. If you upload a file, the markup field is populated automatically on save.

### 2. Open the form

Open any document of the target DocType. The icon appears immediately to the left of the section title.


**Example SVG markup:**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="18" rx="2"/>
  <path d="M3 9h18"/>
  <path d="M9 21V9"/>
</svg>
```

---

## Uninstallation

```bash
bench --site your-site uninstall-app section_icon
bench remove-app section_icon
```

---

## License

MIT — see [LICENSE](LICENSE) for details.
