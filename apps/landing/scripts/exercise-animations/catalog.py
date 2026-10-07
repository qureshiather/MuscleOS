"""Every animated exercise. Importing this module registers all of them in registry.SPECS.

exercises.py holds the first set (the built-in template exercises); each catalog_* module adds a
movement family built from the same shared body, equipment and positions.
"""

import exercises  # noqa: F401
from registry import SPECS  # noqa: F401
import catalog_legs  # noqa: E402,F401
import catalog_press  # noqa: E402,F401
import catalog_pull  # noqa: E402,F401
import catalog_arms  # noqa: E402,F401
import catalog_glutes  # noqa: E402,F401
import catalog_core  # noqa: E402,F401
import catalog_upper  # noqa: E402,F401
import catalog_power  # noqa: E402,F401
