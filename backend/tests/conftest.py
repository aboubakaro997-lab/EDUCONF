import sys
import os
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Stabilise la config pendant les tests, indépendamment des variables shell locales.
os.environ["DEBUG"] = "false"
os.environ.setdefault("ENVIRONMENT", "development")
