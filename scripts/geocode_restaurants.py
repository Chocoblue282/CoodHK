"""Resolve restaurant street locations and preserve manual lat/lng overrides.

The input data remains human-editable: numeric latOverride/lngOverride always win.
Automatic lookups use Photon (OpenStreetMap data) at street/building level; unresolved
records retain their existing coordinates and are marked district-fallback.
"""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "src/data/restaurants.json"
CACHE = Path(__file__).with_name("photon-cache.json")

DISTRICT_EN = {
    "屯門": "Tuen Mun", "元朗": "Yuen Long", "天水圍": "Tin Shui Wai", "荃灣": "Tsuen Wan",
    "葵涌": "Kwai Chung", "葵芳": "Kwai Fong", "深水埗": "Sham Shui Po", "旺角": "Mong Kok",
    "九龍": "Kowloon Bay", "觀塘": "Kwun Tong", "沙田": "Sha Tin", "大埔": "Tai Po", "灣仔": "Wan Chai",
    "香港": "Hong Kong",
}

# Hong Kong Government street romanisation used by OpenStreetMap/Photon.
STREETS = {
    "豐安街": "Fung On Street", "德政圍": "Tak Ching Street", "鄉事會路": "Heung Sze Wui Road",
    "田景路": "Tin King Road", "屯貴路": "Tuen Kwai Road", "湖秀街": "Wu Sau Street",
    "富健花園": "Fu Kin Estate", "鳴琴路": "Ming Kin Road", "青麟路": "Ching Lun Road",
    "湖翠路": "Wu Chui Road", "青松觀路": "Tsing Chung Koon Road", "啟發徑": "Kai Fat Path",
    "教育路": "Education Road", "鳳翔路": "Fung Cheung Road", "裕景坊": "Yue King Square",
    "阜財街": "Fu Choi Street", "錦田公路": "Kam Tin Road", "大棠路": "Tai Tong Road",
    "鳳攸南街": "Fung Yau South Street", "媽橫路": "Ma Hang Road", "天華路": "Tin Wah Road",
    "三陂坊": "Sam Pei Square", "曹公坊": "Tso Kung Square", "西樓角路": "Sai Lau Kok Road",
    "川龍街": "Chuen Lung Street", "石圍角邨": "Shek Wai Kok Estate", "沙咀道": "Sha Tsui Road",
    "眾安街": "Chung On Street", "海盛路": "Hoi Shing Road", "大窩口道": "Tai Wo Hau Road",
    "屏麗徑": "Ping Lai Path", "青山公路": "Castle Peak Road", "禾塘咀街": "Wo Tong Tsui Street",
    "信芳街": "Shing Fong Street", "葵富路": "Kwai Fu Road", "興芳路": "Hing Fong Road",
    "圍乪街": "Wai Kong Street", "担杆山路": "Tam Kon Shan Road", "幸祥街": "Hang Cheong Street",
    "元州街": "Un Chau Street", "欽州街": "Yen Chow Street", "汝州街": "Yu Chau Street",
    "北河街": "Pei Ho Street", "醫局街": "Yee Kuk Street", "通菜街": "Tung Choi Street",
    "白布街": "Pak Po Street", "宏開道": "Wang Hoi Road", "成業街": "Shing Yip Street",
    "開源道": "Hoi Yuen Road", "瑞寧街": "Shui Ning Street", "駿業街": "Tsun Yip Street",
    "翠屏道": "Tsui Ping Road", "物華街": "Mut Wah Street", "德田街": "Tak Tin Street",
    "車公廟路": "Che Kung Miu Road", "積德里": "Chik Tak Lane", "沙角街": "Sha Kok Street",
    "黃竹洋街": "Wong Chuk Yeung Street", "恆錦街": "Hang Kam Street", "西沙路": "Sai Sha Road",
    "大明里": "Tai Ming Lane", "馬會道": "Jockey Club Road", "灣仔道": "Wan Chai Road",
    "東日街市": "Tung Chung Market", "聯合道": "Junction Road", "橫頭磡東道": "Wang Tau Hom East Road",
    "偉智里": "Wai Chi Lane", "偉智街": "Wai Chi Street", "棉登徑": "Minden Avenue",
    "黃埔花園": "Whampoa Garden", "馬頭角道": "Ma Tau Kok Road", "翠屏邨": "Tsui Ping Estate",
}


def street_query(address: str, district: str) -> str | None:
    for chinese, english in STREETS.items():
        if chinese not in address:
            continue
        match = re.search(re.escape(chinese) + r"\s*([0-9]+)", address)
        number = match.group(1) if match else ""
        return f"{english}{(' ' + number) if number else ''}, {DISTRICT_EN.get(district, 'Hong Kong')}, Hong Kong"
    return None


def lookup(query: str, cache: dict[str, object]) -> tuple[float, float] | None:
    if query in cache:
        result = cache[query]
        return tuple(result) if result else None
    url = "https://photon.komoot.io/api/?" + urllib.parse.urlencode({"q": query, "limit": 1})
    request = urllib.request.Request(url, headers={"User-Agent": "CoodHK-food-map/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
        feature = payload.get("features", [None])[0]
        coordinates = feature.get("geometry", {}).get("coordinates") if feature else None
        result = [float(coordinates[1]), float(coordinates[0])] if coordinates else None
    except Exception:
        result = None
    cache[query] = result
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    time.sleep(0.25)
    return tuple(result) if result else None


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    automatic = 0
    unresolved = 0
    for restaurant in data:
        override = isinstance(restaurant.get("latOverride"), (int, float)) and isinstance(restaurant.get("lngOverride"), (int, float))
        if override:
            restaurant["lat"] = restaurant["latOverride"]
            restaurant["lng"] = restaurant["lngOverride"]
            restaurant["source"] = "manual-override"
            continue
        query = street_query(restaurant["address"], restaurant["district"])
        coordinates = lookup(query, cache) if query else None
        if coordinates:
            restaurant["lat"], restaurant["lng"] = coordinates
            restaurant["source"] = "photon-street"
            automatic += 1
        else:
            restaurant["source"] = "district-fallback"
            unresolved += 1
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"automatic={automatic} unresolved={unresolved} manual={len(data) - automatic - unresolved}")


if __name__ == "__main__":
    main()
