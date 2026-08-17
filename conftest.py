"""Ensures the repository root is importable so `import mmd_generator`
resolves during test collection regardless of how pytest is invoked."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
