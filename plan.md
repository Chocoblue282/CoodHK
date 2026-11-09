# CoodHK 香港平價美食地圖｜實作計劃

## 產品與實作

網站以提供「全港 $40 或以下」餐廳探索為核心，前端採 Vite + TypeScript 建立單頁體驗；餐廳資料由使用者提供的試算表正規化為 `src/data/restaurants.json`，只匯入 `status=approved` 的內容。資料層包含 `lat`／`lng` 與可選的 `latOverride`／`lngOverride` 欄位；前端以 override 優先，讓人工核對過的街道座標永遠覆蓋自動解析或 fallback。

首頁由 Header、橫向篩選帶、可縮放／拖曳的 Leaflet 地圖與下方餐廳抽屜組成。底圖使用以 OpenStreetMap 資料為基礎的 CARTO 免費圖磚，Pin 由 Leaflet MarkerCluster 聚合；點擊單一 Pin 會開啟對應餐廳詳情，點擊聚合點會自動放大拆分。詳情頁以 modal sheet 呈現，底部固定 Google Maps、報料、寫食評三個單手操作按鈕。報料與食評在前端示範完整流程，圖片以 Canvas 壓縮後顯示檔案大小，提交資料以 `pending` 狀態處理，不會直接渲染上線。

## 設計方向

- **Design Movement**：現代輕復古的香港街頭餐飲導覽，加入街牌、地圖圖釘與茶餐廳色塊語彙。
- **Core Principles**：高對比易讀、單手可操作、資訊先於裝飾、以地區探索取代複雜導覽。
- **Color Philosophy**：#F48C2A 代表暖食與街頭活力；#3678BD 提供清晰的天空藍支撐；#E74C3C 只用於提醒與限時標籤；#F7F4EF 作為米白紙張底，降低長時間尋找餐廳的視覺疲勞。
- **Layout Paradigm**：以「地圖舞台＋底部抽屜」為主軸，桌面採約 60/40 的垂直節奏，手機轉為地圖優先、卡片橫滑。
- **Signature Elements**：雙色邊框與橙色定位點、帶有紙張質感的米白面板、像街區路牌的藍色篩選 Chip。
- **Interaction Philosophy**：每次點擊都會讓地圖、抽屜與詳情維持同步；篩選即時生效、不刷新；重要操作固定在拇指可達位置。
- **Animation**：地圖 Pin 以短促 pop-in 出現；卡片與 modal 用 220ms ease-out 上滑；篩選 Chip 只作顏色與微小位移回饋，避免干擾找餐。
- **Typography System**：以系統無襯線字體支援繁中，標題使用粗體大字與緊湊行高，內文維持 14–15px；數字與價格使用等寬數字感。
- **Brand Essence**：給香港人快速搵到抵食好味道的地圖；率直、熱鬧、可靠。
- **Brand Voice**：標題直接：「今日食邊區？」；CTA 具體：「搵間 $40 內嘅」。
- **Wordmark & Logo**：沿用使用者提供的 CoodHK 圖釘碗 Logo，Header 以圖標搭配 CoodHK 字樣作識別。
- **Signature Brand Color**：暖活力橙 #F48C2A。

## 專案結構

- `src/main.ts`：頁面狀態、渲染、篩選、聚合點、詳情與 modal 互動。
- `src/styles.css`：響應式版面、品牌色彩、地圖舞台及操作列。
- `src/data/restaurants.json`：由 CSV/XLSX 解析的 approved 餐廳資料，含 status、營業時間、lat/lng 與可手動覆蓋的 latOverride/lngOverride。
- `src/data/LOCATION_OVERRIDES.md`：人工修正座標的維護說明與資料格式。
- `public/assets/coodhk-logo.png`：使用者提供的品牌 Logo。
- `public/manus-routes.json`：首頁路由宣告。
