import importlib.util
import sys
import types
import unittest
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "section_icon"
    / "section_icon"
    / "doctype"
    / "section_icon"
    / "section_icon.py"
)


class DummyDocument:
    pass


class DummyFrappeModule(types.ModuleType):
    class DoesNotExistError(Exception):
        pass

    def __init__(self):
        super().__init__("frappe")

    @staticmethod
    def _(message):
        return message

    @staticmethod
    def throw(message):
        raise RuntimeError(message)

    @staticmethod
    def get_doc(*args, **kwargs):
        raise AssertionError("get_doc should not be called for pasted SVG markup")

    @staticmethod
    def get_meta(*args, **kwargs):
        raise AssertionError("get_meta should not be called for pasted SVG markup")


class SectionIconValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        frappe_module = DummyFrappeModule()
        document_module = types.ModuleType("frappe.model.document")
        document_module.Document = DummyDocument

        sys.modules["frappe"] = frappe_module
        sys.modules["frappe.model"] = types.ModuleType("frappe.model")
        sys.modules["frappe.model.document"] = document_module

        spec = importlib.util.spec_from_file_location("section_icon_test_module", MODULE_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        cls.SectionIcon = module.SectionIcon

    def test_validate_accepts_pasted_svg_when_using_same_icon(self):
        icon = self.SectionIcon()
        icon.svg_file = None
        icon.svg_markup = '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
        icon.use_same_icon_in_dark_mode = True
        icon.dark_svg_file = None
        icon.dark_svg_markup = ""
        icon.for_doctype = None
        icon.fieldname = None

        icon.validate()

        self.assertEqual(icon.svg_markup, '<svg xmlns="http://www.w3.org/2000/svg"></svg>')


if __name__ == "__main__":
    unittest.main()
