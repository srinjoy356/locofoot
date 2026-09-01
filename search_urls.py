import os
import re

search_dirs = ['apps/api/app', 'apps/web/src']
search_patterns = [r'http://localhost', r'http://127\.0\.0\.1', r'https?://[a-zA-Z0-9-]+\.supabase\.co', r'localhost:\d+']
exclude_dirs = ['.git', 'node_modules', '.venv', '.next', '__pycache__']

matches = []

for sdir in search_dirs:
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

for m in matches:
    print(m)
