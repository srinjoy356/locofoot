import re

file_path = 'apps/web/src/app/(main)/admin/events/[eventId]/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

func_old = """                  <li key={r.id} className="text-sm font-medium flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                    <span>
                      {r.user?.display_name || r.user?.username || 'Unknown'} 
                      <span className="text-slate-400 text-xs ml-1">({r.user?.unique_code || 'No Code'})</span>
                    </span>
                    <span className="text-xs text-red-500">{typeof r.user === 'object' && !Array.isArray(r.user) ? 'OBJ' : Array.isArray(r.user) ? 'ARR' : 'OTHER'}</span>
                  </li>"""
func_new = """                  <li key={r.id} className="text-sm font-medium flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                    <span>
                      {((Array.isArray(r.user) ? r.user[0] : r.user)?.display_name) || ((Array.isArray(r.user) ? r.user[0] : r.user)?.username) || 'Unknown User'} 
                      <span className="text-slate-400 text-xs ml-1">({(Array.isArray(r.user) ? r.user[0] : r.user)?.unique_code || 'No Code'})</span>
                    </span>
                  </li>"""
content = content.replace(func_old, func_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
