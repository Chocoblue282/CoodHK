# CoodHK GAS + Google Drive 後端

## Google Sheet 欄位

`setup()` 會自動建立以下必要欄位：

```text
id | name | address | price | category | photo_url | status | created_at
```

網站地圖若要完整呈現新報料，建議同時保留選用欄位：

```text
district | dining | hours | hours_detail | lat | lng | mapX | mapY | reviewed_at | reviewed_by
```

`status` 由報料 API 強制寫入 `pending`。前端 GET API 只會取得 `status = approved` 的列。

## Script Properties

在 Apps Script Project Settings > Script properties 設定：

- `SHEET_ID`: 試算表 URL 中的 ID
- `SHEET_NAME`: 例如 `Restaurants`
- `DRIVE_FOLDER_ID`: 儲存報料圖片的 Drive 資料夾 ID
- `ADMIN_TOKEN`: 請自行產生一段長而隨機的秘密字串，不要放入前端網站或 Git
- `ADMIN_EMAIL`: 可選；新報料通知電郵地址

## 部署步驟

1. 將 `Code.gs` 貼到 Apps Script 專案。
2. 設定上述 Script Properties。
3. 執行一次 `setup()` 並完成 Google 授權。首次使用通知功能時，亦需授權 MailApp。
4. Deploy > Manage deployments，將 Web App 更新至新版本：
   - Execute as: Me
   - Who has access: Anyone
5. 保留同一個 `/exec` URL；前端會使用：

```text
GET ?action=listApproved    讀取已核准餐廳
POST                        接收 Base64 壓縮圖片、上傳 Drive、寫入 pending 報料
```

## 審核後台

部署新版本後，使用以下網址開啟審核頁面：

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=admin&token=你的_ADMIN_TOKEN
```

頁面會列出所有 `pending` 報料，並提供「批准上線」及「拒絕」按鈕。批准後會將 Sheet 的 `status` 原子地改為 `approved`，並呼叫 `SpreadsheetApp.flush()` 確保寫入完成；網站的前端會在啟動時讀取，之後每 30 秒輪詢一次，並在瀏覽器重新回到前景時立即重新讀取。下一次同步即可顯示該餐廳；拒絕則改為 `rejected`，保持隱藏。

審核頁使用 `ADMIN_TOKEN` 保護。請不要把完整審核網址公開分享；若懷疑 token 洩漏，請在 Script Properties 更換 token 後重新部署／使用新網址。

## 審核通知

若設定 `ADMIN_EMAIL`，每次有新報料寫入 Sheet 後，GAS 會寄出一封待審核通知。通知失敗不會撤銷已成功寫入的報料。

圖片公開 URL 由 Drive file ID 產生並存入 `photo_url`。不建議將圖片二進位內容直接寫入 Sheet。
