# 餐廳座標維護

每筆餐廳資料可直接填寫 `latOverride` 與 `lngOverride`。只要兩個欄位都是有效數字，前端會優先使用它們，覆蓋自動解析或既有 `lat`／`lng`；任一欄留空才會回退到資料內的 `lat`／`lng`。

座標格式使用 WGS84 十進制，例如屯門湖翠路 2 號美樂花園可寫成：

```json
{
  "latOverride": 22.3743067,
  "lngOverride": 113.9607311
}
```

修改 `src/data/restaurants.json` 後重新建置即可生效。`source` 使用 `manual-override`、`geocoded` 或 `district-fallback` 反映目前定位來源，方便後台檢查仍需人工覆蓋的資料。
