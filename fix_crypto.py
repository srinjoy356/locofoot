import os

helper = """
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
"""

files = [
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/recorder/page.tsx',
    'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/referee/page.tsx',
    'apps/web/src/app/(admin)/admin/events/[eventId]/scheduling-live/page.tsx'
]

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if "const generateUUID" not in content:
        # Insert the helper right after the imports
        import_end = content.rfind("import ")
        if import_end != -1:
            next_line_start = content.find("\\n", import_end)
            if next_line_start != -1:
                content = content[:next_line_start+1] + helper + content[next_line_start+1:]
        
    # Replace crypto.randomUUID()
    content = content.replace("crypto.randomUUID()", "generateUUID()")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
