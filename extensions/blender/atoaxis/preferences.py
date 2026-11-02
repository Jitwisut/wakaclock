import bpy
from bpy.props import StringProperty


class ATOAXIS_Preferences(bpy.types.AddonPreferences):
    bl_idname = __package__

    cli_path: StringProperty(
        name="AtoAxis CLI path",
        description="Optional path to the wakaclock CLI. Leave blank to use PATH",
        default="",
        subtype="FILE_PATH",
    )

    def draw(self, _context):
        layout = self.layout
        layout.prop(self, "cli_path")
        layout.label(text="Configure your AtoAxis API key with the wakaclock CLI before tracking.")
        layout.label(text="Don't have a key? Join Early Access at https://www.atoaxis.com/join")


_CLASSES = (ATOAXIS_Preferences,)


def register():
    for cls in _CLASSES:
        bpy.utils.register_class(cls)


def unregister():
    for cls in reversed(_CLASSES):
        bpy.utils.unregister_class(cls)
