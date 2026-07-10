"""Sync the public JadeHigh Games catalog from Google Play."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


SOURCE_URL = "https://play.google.com/store/apps/developer?hl=en_US&id=JadeHigh+Games"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "games.json"
class GameLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.current: dict[str, object] | None = None
        self.games: list[dict[str, object]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        href = attributes.get("href") or ""
        if tag == "a" and "/store/apps/details" in href and self.current is None:
            self.current = {"href": href, "text": [], "images": []}
            return
        if self.current and tag == "img":
            image = attributes.get("src") or attributes.get("data-src")
            if image:
                self.current["images"].append(image)

    def handle_endtag(self, tag: str) -> None:
        if self.current and tag == "a":
            self.games.append(self.current)
            self.current = None

    def handle_data(self, data: str) -> None:
        if self.current and data.strip():
            self.current["text"].append(data.strip())


def fetch_catalog() -> str:
    request = Request(
        SOURCE_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urlopen(request, timeout=45) as response:
        return response.read().decode("utf-8")


def normalize_image(url: str) -> str:
    base = re.sub(r"=w\d+-h\d+(?:-[a-z]+)*$", "", url)
    return f"{base}=w832-h470-rw"


def parse_catalog(source: str) -> list[dict[str, str]]:
    parser = GameLinkParser()
    parser.feed(source)
    games: list[dict[str, str]] = []
    seen: set[str] = set()

    for item in parser.games:
        parsed = urlparse(str(item["href"]).replace("&amp;", "&"))
        package_id = parse_qs(parsed.query).get("id", [""])[0]
        text = [part for part in item["text"] if part]
        images = item["images"]
        if not package_id or package_id in seen or not text or not images:
            continue
        seen.add(package_id)
        games.append(
            {
                "name": text[0],
                "packageId": package_id,
                "url": "https://play.google.com/store/apps/details?" + urlencode({"id": package_id}),
                "image": normalize_image(str(images[0])),
            }
        )

    if len(games) < 5:
        raise RuntimeError(f"Google Play returned only {len(games)} usable games; refusing to replace the catalog")
    return games


def main() -> None:
    games = parse_catalog(fetch_catalog())
    previous = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    if previous.get("games") == games:
        print(f"Catalog unchanged ({len(games)} games)")
        return

    payload = {
        "source": SOURCE_URL,
        "syncedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "games": games,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {OUTPUT.name} with {len(games)} games")


if __name__ == "__main__":
    main()
