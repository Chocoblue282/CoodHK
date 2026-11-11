
## Google Apps Script 圖片與資料同步

報料流程採用輕量 GAS + Google Drive 架構：瀏覽器先以 Canvas 將圖片壓縮並轉為 Base64，POST 到 Apps Script Web App；Apps Script 將圖片寫入指定 Drive 資料夾、設定可檢視權限、產生 `photo_url`，再把 `id`、`name`、`address`、`price`、`category`、`photo_url`、`status`、`created_at` 寫入 Google Sheets。GET `?action=listApproved` 只會回傳 `status = approved` 的列，前端同步後只渲染已核准資料。必要的 Sheet 欄位由 `setup()` 初始化；地圖用的 district、hours、lat、lng 等為可選欄位，可協助新報料完整定位。部署所需的 Sheet ID、Drive folder ID 及 GAS Web App URL 不寫入原始碼，改由 Script Properties 與 `VITE_GAS_ENDPOINT` 設定。
