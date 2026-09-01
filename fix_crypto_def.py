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
        
    if "const generateUUID = () =>" not in content:
        # Find the first export or component definition and inject right before it
        import_end = content.find("export default function")
        if import_end != -1:
            content = content[:import_end] + helper + "\n" + content[import_end:]
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
