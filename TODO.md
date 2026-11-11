
- [x] **GAS + Google Drive 圖片同步後端**：新增 `gas/Code.gs`，使用 `photo_base64` 將前端 Canvas 壓縮圖片上傳至指定 Drive 資料夾，建立公開 `photo_url`，並以 `status = pending` 寫入 Google Sheets。
- [x] **Google Sheets approved API**：新增 `doGet?action=listApproved`，只回傳 `status = approved` 的資料；前端同步後只渲染 approved 餐廳及 `photo_url` 圖片。
- [x] **報料表單 GAS 提交流程**：前端已把壓縮圖片轉 Base64，使用 GAS endpoint POST；未設定 endpoint 時保留 localStorage fallback，並清楚提示尚未正式上傳。
- [ ] **Google 帳戶部署設定**：需在 Apps Script 設定 `SHEET_ID`、`SHEET_NAME`、`DRIVE_FOLDER_ID`，執行 `setup()` 授權，再部署 Web App 並把 `/exec` URL 設為 `VITE_GAS_ENDPOINT`。
