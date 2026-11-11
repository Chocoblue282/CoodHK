# CoodHK GAS + Google Drive 後端

## Google Sheet 欄位

`setup()` 會自動建立以下必要欄位：

```text
id | name | address | price | category | photo_url | status | created_at
```

網站地圖若要完整呈現新報料，建議同時保留選用欄位：

```text
district | dining | hours | hours_detail | lat | lng | mapX | mapY
```

`status` 由 API 強制寫入 `pending`。前端 GET API 只會取得 `status = approved` 的列。

## 部署步驟

1. 建立 Google Sheet 及 Google Drive 資料夾。
2. 建立 Apps Script 專案，貼上 `Code.gs`。
3. Project Settings > Script properties 設定：
   - `SHEET_ID`: 試算表 URL 中的 ID
   - `SHEET_NAME`: 例如 `Restaurants`
   - `DRIVE_FOLDER_ID`: Drive 資料夾 ID
4. 執行一次 `setup()` 並完成 Google 授權。
5. Deploy > New deployment > Web app：
   - Execute as: Me
   - Who has access: Anyone
6. 將 Web App `/exec` URL 設定為前端環境變數：

```bash
VITE_GAS_ENDPOINT=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

前端會使用：

- `GET ?action=listApproved`: 讀取已核准餐廳
- `POST`: 接收 Base64 壓縮圖片、上傳 Drive、寫入 pending 報料

圖片公開 URL 由 Drive file ID 產生，存入 `photo_url`。不建議將圖片二進位內容直接寫入 Sheet。
