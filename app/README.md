# Python/FastAPI版レシートOCRアプリ

## 概要

既存のNode.js/Express版と並行運用できるPython/FastAPI版のレシートOCRアプリケーション。

- **OCR**: Tesseract OCR（無料・オフライン）
- **構造化**: ルールベース解析（スコアリング方式）
- **APIコスト**: 0円（Vertex AI/OpenAI不使用）
- **処理速度**: 約2秒/枚

## ディレクトリ構成

```
app/
├── main.py              # FastAPIエントリーポイント
├── api/
│   └── receipt.py       # レシート処理API
├── services/
│   ├── ocr.py           # Tesseract OCR処理
│   ├── parser.py         # ルールベース解析
│   └── sheets.py         # Google Sheets API連携
├── utils/
│   └── image.py         # 画像前処理（OpenCV）
└── static/              # 静的ファイル（オプション）
```

## セットアップ

### 1. 依存パッケージのインストール

```bash
pip install -r requirements.txt
```

### 2. Tesseract OCRのインストール

**Windows:**
- [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) をダウンロード・インストール
- 日本語データパッケージ（jpn.traineddata）をインストール

**macOS:**
```bash
brew install tesseract tesseract-lang
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-jpn
```

### 3. 環境変数の設定

`.env`ファイルに以下を追加：

```env
# Google Sheets設定（既存と同じ）
GOOGLE_CREDENTIALS_PATH=backend/config/credentials.json
GOOGLE_SHEETS_ID=your-spreadsheet-id

# FastAPIサーバー設定
PORT=8000
```

本番環境（Render等）では：
```env
GOOGLE_CREDENTIALS={"type":"service_account",...}  # JSON文字列
GOOGLE_SHEETS_ID=your-spreadsheet-id
PORT=8000
```

### 4. サーバーの起動

```bash
# 開発モード（自動リロード）
python -m app.main

# または uvicorn を直接使用
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## APIエンドポイント

既存のNode.js版と同じエンドポイントを提供：

- `POST /api/ocr/process` - 画像アップロード・OCR処理
- `POST /api/ai/structure` - OCRテキストの構造化
- `POST /api/sheets/write` - Google Sheetsへの書き込み
- `GET /api/sheets/history` - 履歴取得
- `GET /api/health` - ヘルスチェック

## 使い方

### 1. フロントエンドの設定

既存の`frontend/`ディレクトリを使用。APIエンドポイントのURLを変更：

```javascript
// frontend/js/upload.js など
const API_BASE_URL = 'http://localhost:8000/api';  // FastAPIのポート
```

### 2. レシート処理フロー

1. 画像アップロード → `POST /api/ocr/process`
2. OCRテキスト取得
3. 構造化 → `POST /api/ai/structure`
4. 確認・編集（フロントエンド）
5. Google Sheets保存 → `POST /api/sheets/write`

## 精度向上のための拡張案

各ファイルにコメントで拡張案を記載しています：

- **店名抽出**: よくある店名パターンの辞書追加
- **日付抽出**: 和暦対応、相対日付対応
- **金額抽出**: キーワード検索、位置情報の活用
- **画像前処理**: コントラスト調整、傾き補正
- **学習データ**: 人の修正ログを保存して将来的に機械学習に活用

詳細は各ファイルのコメントを参照してください。

## 注意事項

- Tesseract OCRの日本語データパッケージが必要
- 既存のNode.jsアプリとは別ポートで起動（デフォルト: 8000）
- 既存のフロントエンドは変更不要（APIエンドポイントのURLのみ変更）
- 処理時間目標: 1枚2秒前後

## トラブルシューティング

### Tesseract OCRが見つからない

```python
# app/services/ocr.py でパスを指定
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'  # Windows
```

### Google Sheets認証エラー

- `GOOGLE_CREDENTIALS`または`GOOGLE_CREDENTIALS_PATH`が正しく設定されているか確認
- サービスアカウントにスプレッドシートの編集権限が付与されているか確認

### 画像前処理エラー

- OpenCVが正しくインストールされているか確認
- 画像ファイル形式がサポートされているか確認（JPEG、PNG）
