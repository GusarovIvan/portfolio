#!/usr/bin/env python3
"""Scan photos/ and update each project JSON with a photos list + manifest.json."""

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECTS_DIR = os.path.join(ROOT, "data", "projects")
PHOTOS_DIR = os.path.join(ROOT, "photos")
MANIFEST_PATH = os.path.join(ROOT, "data", "manifest.json")

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def natural_key(name: str):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", name)]


def scan_photos(photo_folder: str, photo_prefix: str = "") -> list[str]:
    folder_path = os.path.join(PHOTOS_DIR, photo_folder)
    if not os.path.isdir(folder_path):
        return []

    files = []
    for name in os.listdir(folder_path):
        ext = os.path.splitext(name)[1].lower()
        if ext not in IMAGE_EXT:
            continue
        stem = os.path.splitext(name)[0]
        if photo_prefix:
            prefix_lower = photo_prefix.lower()
            stem_lower = stem.lower()
            if not (stem_lower == prefix_lower or stem_lower.startswith(prefix_lower + " ") or stem_lower.startswith(prefix_lower + "(")):
                continue
        files.append(name)

    files.sort(key=natural_key)
    return [f"photos/{photo_folder}/{name}" for name in files]


def main():
    manifest = []

    for filename in sorted(os.listdir(PROJECTS_DIR)):
        if not filename.endswith(".json"):
            continue

        path = os.path.join(PROJECTS_DIR, filename)
        with open(path, encoding="utf-8") as f:
            project = json.load(f)

        photos = scan_photos(project.get("photoFolder", ""), project.get("photoPrefix", ""))
        project["photos"] = photos

        if photos:
            project["cover"] = photos[0]
        else:
            project.pop("cover", None)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(project, f, ensure_ascii=False, indent=2)
            f.write("\n")

        manifest.append(
            {
                "id": project["id"],
                "category": project["category"],
                "title": project["title"],
                "date": project.get("date", ""),
                "shortDescription": project.get("shortDescription", ""),
                "cover": project.get("cover", ""),
            }
        )

    manifest.sort(key=lambda item: item.get("date", ""), reverse=True)

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Updated {len(manifest)} projects -> {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
