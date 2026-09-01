import os
import re

search_dirs = ['apps/api/app', 'apps/web/src', 'apps/web/next.config.ts', 'apps/web/next.config.mjs']
search_patterns = [r'3000', r'8000']
exclude_dirs = ['.git', 'node_modules', '.venv', '.next', '__pycache__']

matches = []

for sdir in search_dirs:
    if os.path.isfile(sdir):
        try:
            with open(sdir, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for i, line in enumerate(lines):
                    for p in search_patterns:
                        if re.search(p, line, re.IGNORECASE):
                            matches.append(f"{sdir}:{i+1}: {line.strip()}")
        except Exception:
            pass
    elif os.path.isdir(sdir):
        for root, dirs, files in os.walk(sdir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        for i, line in enumerate(lines):
                            for p in search_patterns:
                                if re.search(p, line, re.IGNORECASE):
                                    matches.append(f"{filepath}:{i+1}: {line.strip()}")
                except Exception:
                    pass

for m in set(matches):
    print(m)
