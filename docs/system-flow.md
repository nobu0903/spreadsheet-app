# システムフロー

## 全体フロー

```
[ユーザー] → [アップロード画面] → [OCR処理] → [AI構造化] → [確認・編集画面] → [Google Sheets書き込み] → [完了]
```

## 詳細フロー

### 1. レシートアップロード

```
ユーザー
  ↓
upload.html (フロントエンド)
  ↓
画像ファイル選択
  ↓
POST /api/ocr/process (バックエンド)
  ↓
visionService.extractText() (Google Vision API)
  ↓
OCRテキスト返却
```

### 2. AI構造化

```
OCRテキスト
  ↓
POST /api/ai/structure (バックエンド)
  ↓
aiParseService.parseReceiptText() (Vertex AI / OpenAI)
  ↓
構造化データ返却
```

### 3. データ確認・編集

```
構造化データ
  ↓
preview.html (フロントエンド)
  ↓
ユーザー確認・編集
  ↓
編集済みデータ
```

### 4. Google Sheets書き込み

```
編集済みデータ
  ↓
POST /api/sheets/write (バックエンド)
  ↓
sheetService.writeReceipt() (Google Sheets API)
  ↓
月別シート（例: 2025_01）に1行追加
  ↓
完了通知
```

### 5. 履歴表示

```
ユーザー
  ↓
history.html (フロントエンド)
  ↓
GET /api/sheets/history (バックエンド)
  ↓
sheetService.getHistory() (Google Sheets API)
  ↓
履歴データ表示
```

## データ構造

### Google Sheets列構成

| 列名 | 説明 | 例 |
|------|------|-----|
| Date | 日付 | 2025-01-15 |
| Store name | 店舗名 | コンビニエンスストア |
| Payer | 支払者 | 山田太郎 |
| Amount (tax excluded) | 金額（税抜） | 1000 |
| Amount (tax included) | 金額（税込） | 1100 |
| Tax | 消費税 | 100 |
| Payment method | 支払方法 | cash |
| Expense category | 経費カテゴリ | 交通費 |
| Project / client name | プロジェクト/クライアント名 | プロジェクトA |
| Notes | 備考 | 出張時の交通費 |
| Receipt image URL | レシート画像URL | https://... |

### 月別シート命名規則

- 形式: `YYYY_MM`
- 例: `2025_01`, `2025_02`

## エラーハンドリング

各ステップでエラーが発生した場合：

1. エラーログを記録
2. ユーザーにエラーメッセージを表示
3. 前のステップに戻るか、処理を中断

## セキュリティ

- ログイン認証（実装予定）
- API認証（Google API認証情報）
- CORS設定


