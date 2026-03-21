# -*- coding: utf-8 -*-
"""template_DB.ods の商品コード・JANの雰囲気に近いダミー在庫CSVを生成する。"""
from __future__ import annotations

import csv
import random
from pathlib import Path

HEADER = (
    "group_code,group_name,sku_code,jan_code,name_variant,color,size,quantity,"
    "reorder_point,safety_stock,unit_price_ex_tax,is_active,group_description,sort_order"
).split(",")

# テンプレに近いプレフィックスと、バリエーション用の接尾辞
PREFIXES = ["MLS", "MCT", "MDJ", "MWC", "MSP", "MSH", "MSS", "MCD", "MAS", "MFLJ", "MCP", "MOS", "MMB", "MRP", "MTK", "MPN", "MJK", "MCT2", "MSW", "MBG"]

COLORS = [
    "レッド",
    "ネイビー",
    "ベージュ",
    "ブラック",
    "ホワイト",
    "グレー",
    "オリーブ",
    "バーガンディ",
    "マスタード",
    "スカイブルー",
    "チャコール",
    "キャメル",
    "ピンク",
    "ラベンダー",
    "ターコイズ",
    "アイボリー",
]

SIZES_ALL = ["XS", "S", "M", "L", "XL"]

CATEGORIES = [
    ("ストライプクルーニット", "コットン混の定番ニット。"),
    ("テーパードチノパンツ", "オフィスカジュアル向け。"),
    ("デニムジャケット", "12oz セルビッジ風。"),
    ("ウールチェスターコート", "ミドル丈シングル。"),
    ("スニーカーローカット", "クッションソール。"),
    ("スウェットフーディ", "裏起毛。"),
    ("リネンシャツ", "春夏向け。"),
    ("カーディガン", "Vネック。"),
    ("スポーツポロシャツ", "吸汗速乾。"),
    ("アンクルソックス3足組", "抗菌糸。"),
    ("フェイクレザージャケット", "軽量タイプ。"),
    ("コットンポロシャツ", "鹿の子編み。"),
    ("モールスキンジャケット", "ワークテイスト。"),
    ("メッセンジャーバッグ", "撥水。"),
    ("リブタートルニット", "ウール混。"),
    ("チノショートパンツ", "膝上丈。"),
    ("ダウンベスト", "700FP 風仕様。"),
    ("フレアスカート", "ミモレ丈。"),
    ("キャップ6パネル", "コットンツイル。"),
    ("トートバッグL", "キャンバス。"),
    ("ウインドブレーカー", "パッカブル。"),
    ("スキニージーンズ", "ストレッチ。"),
    ("オックスフォードBDシャツ", "形態安定。"),
    ("キルティングジャケット", "中綿。"),
    ("ハイネックセーター", "メリノ混。"),
]


def ean13_check_digit(base12: str) -> str:
    if len(base12) != 12 or not base12.isdigit():
        raise ValueError(base12)
    total = sum(int(base12[i]) * (1 if i % 2 == 0 else 3) for i in range(12))
    check = (10 - (total % 10)) % 10
    return base12 + str(check)


def main() -> None:
    random.seed(42)
    out_path = Path(__file__).resolve().parent.parent / "dummy_inventory_200.csv"

    rows: list[dict[str, str | int | float | bool]] = []
    jan_seq = 451_990_000_001  # 12桁の連番ベース（先頭が 45 のダミー）

    # 25 親商品 × 8 SKU = 200
    n_groups = 25
    skus_per_group = 8

    for g in range(n_groups):
        pfx = PREFIXES[g % len(PREFIXES)]
        num = 100 + g
        group_code = f"{pfx}-{num}"
        cat_name, cat_desc = CATEGORIES[g % len(CATEGORIES)]
        group_name = f"{cat_name}（ダミー{g + 1:02d}）"
        sort_order = g
        base_price = 1200 + g * 180 + random.randint(0, 400)

        # グループごとに色・サイズの組み合わせをずらす
        color_pool = COLORS[g : g + 6] + COLORS[: max(0, 6 - (len(COLORS) - g))]
        color_pool = color_pool[:6]
        size_pool = (
            ["S", "M", "L", "XL"] if g % 3 == 0 else ["XS", "S", "M", "L"] if g % 3 == 1 else ["S", "M"]
        )
        pairs: list[tuple[str, str]] = []
        for c in color_pool:
            for s in size_pool:
                pairs.append((c, s))
        random.shuffle(pairs)
        pairs = pairs[:skus_per_group]

        for i, (color, size) in enumerate(pairs):
            color_abbr = {
                "レッド": "RD",
                "ネイビー": "NV",
                "ベージュ": "BG",
                "ブラック": "BK",
                "ホワイト": "WH",
                "グレー": "GY",
                "オリーブ": "OL",
                "バーガンディ": "BD",
                "マスタード": "MS",
                "スカイブルー": "SB",
                "チャコール": "CH",
                "キャメル": "CM",
                "ピンク": "PK",
                "ラベンダー": "LV",
                "ターコイズ": "TQ",
                "アイボリー": "IV",
            }.get(color, f"C{i}")
            sku_code = f"{group_code}-{color_abbr}-{size}"

            base12 = str(jan_seq).zfill(12)[:12]
            if len(base12) < 12:
                base12 = base12.ljust(12, "0")
            jan = ean13_check_digit(base12)
            jan_seq += 1

            rp = 5 + (g + i) % 12
            ss = rp + 3 + (i % 5)
            qty = random.randint(0, max(ss + 15, 20))
            if random.random() < 0.12:
                qty = min(qty, rp)  # アラート混ぜる

            variant_note = "定番" if i % 2 == 0 else "シーズン限定風"
            is_active = not (g >= 22 and i >= 6)  # 末尾グループの一部を非アクティブ

            rows.append(
                {
                    "group_code": group_code,
                    "group_name": group_name,
                    "sku_code": sku_code,
                    "jan_code": jan,
                    "name_variant": variant_note,
                    "color": color,
                    "size": size,
                    "quantity": qty,
                    "reorder_point": rp,
                    "safety_stock": ss,
                    "unit_price_ex_tax": round(base_price + i * 50 + random.randint(-30, 80), 2),
                    "is_active": str(is_active).lower(),
                    "group_description": cat_desc,
                    "sort_order": sort_order,
                }
            )

    assert len(rows) == 200, len(rows)

    with open(out_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=HEADER)
        w.writeheader()
        for r in rows:
            w.writerow({k: r[k] for k in HEADER})

    print(f"Wrote {len(rows)} rows to {out_path}")


if __name__ == "__main__":
    main()
