# 餐廳座標維護

每筆餐廳資料可直接填寫 `latOverride` 與 `lngOverride`。只要兩個欄位都是有效數字，前端會優先使用它們，覆蓋自動解析或既有 `lat`／`lng`；任一欄留空才會回退到資料內的 `lat`／`lng`。地圖讀取座標時不會對手動座標加入 jitter、隨機偏移或其他猜測。

座標格式使用 WGS84 十進制，例如屯門湖翠路 2 號美樂花園可寫成：

```json
{
  "latOverride": 22.3743067,
  "lngOverride": 113.9607311
}
```

修改 `src/data/restaurants.json` 後重新建置即可生效。`source` 使用 `manual-override`、`photon-street` 或 `district-fallback` 反映目前定位來源，方便後台檢查仍需人工覆蓋的資料。

重新匯入 CSV 後，可從專案根目錄執行 `python3 scripts/geocode_restaurants.py`。腳本會按香港街道英文名稱查詢 Photon／OpenStreetMap 街道級座標；若資料已有數字型 override，會保留人工座標並跳過自動覆蓋。
