"""Render setup, MuscleOS themes, materials, lighting, camera and equipment props."""

import math

import bpy
from mathutils import Euler, Vector

# Hex values mirror apps/mobile/src/theme/palette.ts (Pulse) and the landing's CSS tokens.
THEMES = {
    'dark': {
        'bg': '#1C1F2A',  # landing --color-surface (the card the clip sits in)
        'body': '#5A6070',  # bodyDiagramFill
        'active': '#3DD68C',  # muscleHighlight
        'equip': '#2B2F3D',
        'pad': '#353A4A',
        'metal': '#8A90A0',
        'accent': '#5694F5',  # primary
        'shadow': 0.5,
    },
    'light': {
        'bg': '#FFFFFF',
        'body': '#A9AFBE',
        'active': '#059669',
        'equip': '#3A3F50',
        'pad': '#4A4F60',
        'metal': '#9AA0B0',
        'accent': '#2563EB',
        'shadow': 0.14,
    },
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgba(h):
    h = h.lstrip('#')
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_render(size, frames, fps):
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE'
    s.render.resolution_x = size
    s.render.resolution_y = size
    s.render.resolution_percentage = 100
    s.render.fps = fps
    s.frame_start = 0
    s.frame_end = frames - 1
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGB'
    s.render.film_transparent = False
    s.view_settings.view_transform = 'Standard'
    s.view_settings.look = 'None'
    s.eevee.taa_render_samples = 32
    try:
        s.eevee.use_shadows = True
        s.eevee.use_raytracing = False
    except AttributeError:
        pass


def _nodes(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return nt


def setup_world(theme):
    t = THEMES[theme]
    w = bpy.data.worlds.new('world')
    bpy.context.scene.world = w
    nt = _nodes(w)
    out = nt.nodes.new('ShaderNodeOutputWorld')
    path = nt.nodes.new('ShaderNodeLightPath')
    cam_bg = nt.nodes.new('ShaderNodeBackground')
    cam_bg.inputs['Color'].default_value = hex_rgba(t['bg'])
    light_bg = nt.nodes.new('ShaderNodeBackground')
    light_bg.inputs['Color'].default_value = (1, 1, 1, 1)
    light_bg.inputs['Strength'].default_value = WORLD_LIGHT
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(path.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(light_bg.outputs[0], mix.inputs[1])
    nt.links.new(cam_bg.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])


def setup_lights():
    key = bpy.data.lights.new('key', 'SUN')
    key.energy = KEY_LIGHT
    key.angle = math.radians(12)
    o = bpy.data.objects.new('key', key)
    o.rotation_euler = Euler((math.radians(KEY_TILT), 0, math.radians(-28)))
    bpy.context.scene.collection.objects.link(o)
    rim = bpy.data.lights.new('rim', 'SUN')
    rim.energy = 0.35
    rim.use_shadow = False
    o = bpy.data.objects.new('rim', rim)
    o.rotation_euler = Euler((math.radians(-60), 0, math.radians(160)))
    bpy.context.scene.collection.objects.link(o)


def body_material(theme):
    """Neutral body fill with the exercise's muscles (`act` attribute) in the highlight colour,
    like the app's muscle diagram. `pulse` (0–1) scales the highlight and is keyed per frame."""
    t = THEMES[theme]
    mat = bpy.data.materials.new('body')
    nt = _nodes(mat)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.62
    bsdf.inputs['Specular IOR Level'].default_value = 0.25

    act = nt.nodes.new('ShaderNodeAttribute')
    act.attribute_name = 'act'
    sharpen = nt.nodes.new('ShaderNodeMapRange')
    nt.links.new(act.outputs['Fac'], sharpen.inputs['Value'])
    sharpen.inputs['From Min'].default_value = 0.25
    sharpen.inputs['From Max'].default_value = 0.75

    pulse = nt.nodes.new('ShaderNodeValue')
    pulse.name = 'pulse'
    pulse.outputs[0].default_value = 1.0
    amount = nt.nodes.new('ShaderNodeMath')
    amount.operation = 'MULTIPLY'
    nt.links.new(sharpen.outputs['Result'], amount.inputs[0])
    nt.links.new(pulse.outputs[0], amount.inputs[1])

    color = nt.nodes.new('ShaderNodeMix')
    color.data_type = 'RGBA'
    color.inputs['A'].default_value = hex_rgba(t['body'])
    color.inputs['B'].default_value = hex_rgba(t['active'])
    nt.links.new(amount.outputs[0], color.inputs['Factor'])
    nt.links.new(color.outputs['Result'], bsdf.inputs['Base Color'])

    # A little self-glow on active muscles so the highlight reads in shadow too.
    glow = nt.nodes.new('ShaderNodeMath')
    glow.operation = 'MULTIPLY'
    glow.inputs[1].default_value = 0.35
    nt.links.new(amount.outputs[0], glow.inputs[0])
    bsdf.inputs['Emission Color'].default_value = hex_rgba(t['active'])
    nt.links.new(glow.outputs[0], bsdf.inputs['Emission Strength'])

    nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    return mat


def flat_material(name, hex_color, roughness=0.55, metallic=0.0):
    mat = bpy.data.materials.new(name)
    nt = _nodes(mat)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = hex_rgba(hex_color)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    return mat


def floor(theme):
    """Infinite floor that renders as the background colour except where shadows fall."""
    t = THEMES[theme]
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = 'floor'
    mat = bpy.data.materials.new('floor')
    nt = _nodes(mat)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    diff = nt.nodes.new('ShaderNodeBsdfDiffuse')
    diff.inputs['Color'].default_value = (1, 1, 1, 1)
    to_rgb = nt.nodes.new('ShaderNodeShaderToRGB')
    nt.links.new(diff.outputs[0], to_rgb.inputs[0])
    bw = nt.nodes.new('ShaderNodeRGBToBW')
    nt.links.new(to_rgb.outputs['Color'], bw.inputs[0])
    rng = nt.nodes.new('ShaderNodeMapRange')
    nt.links.new(bw.outputs[0], rng.inputs['Value'])
    rng.inputs['From Min'].default_value = 0.0
    rng.inputs['From Max'].default_value = FLOOR_LIT
    rng.inputs['To Min'].default_value = 1.0 - t['shadow']
    rng.inputs['To Max'].default_value = 1.0
    rng.clamp = True
    mul = nt.nodes.new('ShaderNodeMix')
    mul.data_type = 'RGBA'
    mul.blend_type = 'MULTIPLY'
    mul.inputs['Factor'].default_value = 1.0
    mul.inputs['A'].default_value = hex_rgba(t['bg'])
    nt.links.new(rng.outputs['Result'], mul.inputs['B'])
    emit = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(mul.outputs['Result'], emit.inputs['Color'])
    nt.links.new(emit.outputs[0], out.inputs['Surface'])
    o.data.materials.append(mat)
    return o


KEY_LIGHT = 0.85
KEY_TILT = 38
WORLD_LIGHT = 0.45
# Lit (unshadowed) brightness of a white diffuse floor under the key light + world, measured
# from a floor-only render (0.718). Slightly under, so lit floor clamps to exactly the bg.
FLOOR_LIT = 0.7


def camera(target, azimuth, elevation, distance, lens=60):
    """azimuth 0 looks at the figure's front (camera on -Y); 90 is the figure's left side."""
    cam = bpy.data.cameras.new('cam')
    cam.lens = lens
    cam.clip_start = 0.1
    cam.clip_end = 100
    o = bpy.data.objects.new('cam', cam)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.scene.camera = o
    place_camera(o, target, azimuth, elevation, distance)
    return o


def place_camera(o, target, azimuth, elevation, distance):
    target = Vector(target)
    az, el = math.radians(azimuth), math.radians(elevation)
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    o.location = target + d * distance
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = (-d).to_track_quat('-Z', 'Y')


__all__ = [
    'THEMES',
    'body_material',
    'camera',
    'flat_material',
    'floor',
    'place_camera',
    'reset_scene',
    'setup_lights',
    'setup_render',
    'setup_world',
]
