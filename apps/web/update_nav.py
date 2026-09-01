import os
import glob

files = [
    r"C:\dev\locofoot\apps\web\src\app\(main)\events\[slug]\stats\page.tsx",
    r"C:\dev\locofoot\apps\web\src\app\(main)\events\[slug]\stats\analytics\page.tsx",
    r"C:\dev\locofoot\apps\web\src\app\(main)\events\[slug]\stats\form\page.tsx",
    r"C:\dev\locofoot\apps\web\src\app\(main)\events\[slug]\stats\players\page.tsx",
    r"C:\dev\locofoot\apps\web\src\app\(main)\events\[slug]\stats\teams\page.tsx"
]

search_str = '<Link href={`/events/${slug}/stats/form`} className="font-medium pb-2 text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap">Form</Link>'
replace_str = search_str + '\n          <Link href={`/events/${slug}/stats/advanced`} className="font-medium pb-2 text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap">Advanced</Link>'

for f in files:
    try:
        with open(f, "r", encoding="utf-8") as file:
            content = file.read()
        
        # Don't replace if already there
        if "stats/advanced" not in content:
            content = content.replace(search_str, replace_str)
            with open(f, "w", encoding="utf-8") as file:
                file.write(content)
            print(f"Updated {f}")
        else:
            print(f"Skipped {f}")
    except Exception as e:
        print(f"Failed on {f}: {e}")
