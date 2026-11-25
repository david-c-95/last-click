import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOUNDS_DIR = ROOT / "sounds"

sounds = {}

for category in ["win", "lose", "lose_spec"]:

    folder = SOUNDS_DIR / category
    folder.mkdir(parents=True, exist_ok=True)

    sounds[category] = sorted(
        file.relative_to(ROOT).as_posix()
        for file in folder.iterdir()
        if file.is_file() and file.suffix.lower() == ".mp3"
    )

    print(f"{category.upper()}: {len(sounds[category])} sounds found")

with open(ROOT / "sounds.json", "w", encoding="utf-8") as file:

    json.dump(sounds, file, indent=4, ensure_ascii=False)

print("sounds.json generated successfully!")