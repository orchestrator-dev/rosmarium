import os
import subprocess

exclude_dirs = {'.git', 'node_modules', 'dist', 'build', '.pytest_cache', '__pycache__', '.playwright-mcp'}

# We need to rename bottom-up to avoid invalidating paths
paths_to_rename = []

for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for name in dirs + files:
        if 'cortex' in name.lower() or 'Cortex' in name:
            paths_to_rename.append(os.path.join(root, name))

paths_to_rename.sort(key=lambda x: x.count('/'), reverse=True)

for path in paths_to_rename:
    dirname = os.path.dirname(path)
    basename = os.path.basename(path)
    
    if 'cortex' in basename:
        new_basename = basename.replace('cortex', 'rosmarium')
    elif 'Cortex' in basename:
        new_basename = basename.replace('Cortex', 'Rosmarium')
    elif 'CORTEX' in basename:
        new_basename = basename.replace('CORTEX', 'ROSMARIUM')
    else:
        new_basename = basename
        
    if new_basename != basename:
        new_path = os.path.join(dirname, new_basename)
        print(f"Renaming {path} to {new_path}")
        subprocess.run(['git', 'mv', path, new_path])

