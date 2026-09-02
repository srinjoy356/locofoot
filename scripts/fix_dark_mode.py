import os
import re

# Mapping of light mode classes to their dark mode variants
# Using a regex replacement approach that carefully avoids adding duplicate dark: variants
CLASS_MAPPINGS = {
    # Backgrounds
    r'(?<!dark:)bg-white(?!\s*dark:bg-[^\s]+)': r'bg-white dark:bg-zinc-900',
    r'(?<!dark:)bg-(?:gray|slate)-50(?!\s*dark:bg-[^\s]+)': r'bg-slate-50 dark:bg-zinc-900/50',
    r'(?<!dark:)bg-(?:gray|slate)-100(?!\s*dark:bg-[^\s]+)': r'bg-slate-100 dark:bg-zinc-800',
    r'(?<!dark:)bg-amber-50(?!\s*dark:bg-[^\s]+)': r'bg-amber-50 dark:bg-amber-950/30',
    r'(?<!dark:)bg-blue-50(?!\s*dark:bg-[^\s]+)': r'bg-blue-50 dark:bg-blue-950/20',
    r'(?<!dark:)bg-red-50(?!\s*dark:bg-[^\s]+)': r'bg-red-50 dark:bg-red-950/20',
    r'(?<!dark:)bg-emerald-50(?!\s*dark:bg-[^\s]+)': r'bg-emerald-50 dark:bg-emerald-950/20',

    # Text Colors
    r'(?<!dark:)text-(?:gray|slate)-900(?!\s*dark:text-[^\s]+)': r'text-slate-900 dark:text-zinc-100',
    r'(?<!dark:)text-(?:gray|slate)-800(?!\s*dark:text-[^\s]+)': r'text-slate-800 dark:text-zinc-200',
    r'(?<!dark:)text-(?:gray|slate)-700(?!\s*dark:text-[^\s]+)': r'text-slate-700 dark:text-zinc-300',
    r'(?<!dark:)text-(?:gray|slate)-600(?!\s*dark:text-[^\s]+)': r'text-slate-600 dark:text-zinc-400',
    r'(?<!dark:)text-(?:gray|slate)-500(?!\s*dark:text-[^\s]+)': r'text-slate-500 dark:text-zinc-400',
    r'(?<!dark:)text-amber-900(?!\s*dark:text-[^\s]+)': r'text-amber-900 dark:text-amber-500',
    r'(?<!dark:)text-amber-800(?!\s*dark:text-[^\s]+)': r'text-amber-800 dark:text-amber-500',
    r'(?<!dark:)text-amber-700(?!\s*dark:text-[^\s]+)': r'text-amber-700 dark:text-amber-400',
    r'(?<!dark:)text-blue-900(?!\s*dark:text-[^\s]+)': r'text-blue-900 dark:text-blue-400',
    r'(?<!dark:)text-blue-800(?!\s*dark:text-[^\s]+)': r'text-blue-800 dark:text-blue-400',
    r'(?<!dark:)text-blue-700(?!\s*dark:text-[^\s]+)': r'text-blue-700 dark:text-blue-400',

    # Borders
    r'(?<!dark:)border-(?:gray|slate)-200(?!\s*dark:border-[^\s]+)': r'border-slate-200 dark:border-zinc-800',
    r'(?<!dark:)border-(?:gray|slate)-300(?!\s*dark:border-[^\s]+)': r'border-slate-300 dark:border-zinc-700',
    r'(?<!dark:)border-amber-200(?!\s*dark:border-[^\s]+)': r'border-amber-200 dark:border-amber-900/50',
    r'(?<!dark:)border-blue-200(?!\s*dark:border-[^\s]+)': r'border-blue-200 dark:border-blue-900/50',
    r'(?<!dark:)border-blue-300(?!\s*dark:border-[^\s]+)': r'border-blue-300 dark:border-zinc-800',
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        original_content = f.read()

    new_content = original_content
    for pattern, replacement in CLASS_MAPPINGS.items():
        # Use regex substitution
        new_content = re.sub(pattern, replacement, new_content)

    if new_content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

def main():
    target_dir = os.path.join(os.getcwd(), 'apps', 'web', 'src')
    modified_count = 0
    for root, dirs, files in os.walk(target_dir):
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                filepath = os.path.join(root, file)
                if process_file(filepath):
                    print(f"Modified: {filepath}")
                    modified_count += 1
    
    print(f"\nTotal files modified: {modified_count}")

if __name__ == "__main__":
    main()
