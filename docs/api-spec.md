# API仕様書

## 概要

Receipt Processing AppのAPIエンドポイント仕様

## ベースURL

```
http://localhost:3000/api
```

## エンドポイント

### 1. OCR処理

#### POST /ocr/process

レシート画像をOCR処理してテキストを抽出

**リクエスト**
- Content-Type: `multipart/form-data`
- Body:
  - `image`: 画像ファイル（JPEG/PNG）

**レスポンス**
```json
{
  "text": "抽出されたOCRテキスト",
  "confidence": 0.95
}
```

**エラー**
- `400`: 無効な画像形式
- `500`: OCR処理エラー

---

### 2. AI構造化

#### POST /ai/structure

OCRテキストを構造化データに変換

**リクエスト**
```json
{
  "ocrText": "抽出されたOCRテキスト"
}
```

**レスポンス**
```json
{
  "date": "2025-01-15",
  "storeName": "店舗名",
  "payer": "従業員名",
  "amountExclTax": 1000,
  "amountInclTax": 1100,
  "tax": 100,
  "paymentMethod": "cash",
  "expenseCategory": "交通費",
  "projectName": "プロジェクト名",
  "notes": "備考"
}
```

**エラー**
- `400`: 無効なリクエスト
- `500`: AI処理エラー

---

### 3. Google Sheets書き込み

#### POST /sheets/write

構造化されたレシートデータをGoogle Sheetsに書き込み

**リクエスト**
```json
{
  "date": "2025-01-15",
  "storeName": "店舗名",
  "payer": "従業員名",
  "amountExclTax": 1000,
  "amountInclTax": 1100,
  "tax": 100,
  "paymentMethod": "cash",
  "expenseCategory": "交通費",
  "projectName": "プロジェクト名",
  "notes": "備考",
  "receiptImageUrl": "https://example.com/image.jpg"
}
```

**レスポンス**
```json
{
  "success": true,
  "rowNumber": 5,
  "sheetName": "2025_01"
}
```

**エラー**
- `400`: 無効なデータ
- `500`: Sheets APIエラー

---

### 4. ヘルスチェック

#### GET /health

サーバーの稼働状況を確認

**レスポンス**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```


