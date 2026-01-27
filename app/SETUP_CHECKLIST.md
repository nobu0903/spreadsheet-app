# セットアップチェックリスト

## ✅ 完了した項目

- [x] Python 3.13.1の確認
- [x] 依存パッケージのインストール（一部互換性問題あり）

## 🔧 次に必要な作業

### 1. NumPyの互換性問題を解決（重要）

OpenCV 4.8.1.78はNumPy 2.xと互換性がありません。NumPyを1.xにダウングレードしてください：

```bash
pip install "numpy<2"
```

または、requirements.txtに追加：

```
numpy<2
```

### 2. Tesseract OCRのインストール

**Windows環境の場合：**

1. [Tesseract OCR for Windows](https://github.com/UB-Mannheim/tesseract/wiki) からインストーラーをダウンロード
2. インストール時に「Additional language data」で日本語（Japanese）を選択
3. インストール後、以下で確認：
   ```bash
   tesseract --version
   ```

詳細は `app/TESSERACT_INSTALL.md` を参照してください。

### 3. 環境変数の設定確認

`.env`ファイルに以下が設定されているか確認：

```env
# Google Sheets設定（既存と同じ）
GOOGLE_CREDENTIALS_PATH=backend/config/credentials.json
# または本番環境の場合：
# GOOGLE_CREDENTIALS={"type":"service_account",...}

GOOGLE_SHEETS_ID=your-spreadsheet-id

# FastAPIサーバー設定
PORT=8000

# Tesseract OCRのパス（PATHに追加されていない場合）
# TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

### 4. サーバーの起動テスト

NumPyの問題を解決後、以下でサーバーを起動：

```bash
# 開発モード（自動リロード）
python -m app.main

# または uvicorn を直接使用
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. 動作確認

1. ブラウザで `http://localhost:8000` にアクセス
2. `/api/health` エンドポイントでヘルスチェック：
   ```bash
   curl http://localhost:8000/api/health
   ```
3. レシート画像のアップロード機能をテスト

## 📝 トラブルシューティング

### NumPy互換性エラー

```
AttributeError: _ARRAY_API not found
```

→ NumPyを1.xにダウングレード：
```bash
pip install "numpy<2"
```

### Tesseract OCRが見つからない

→ `app/services/ocr.py`で自動的にデフォルトパスを検索しますが、見つからない場合は環境変数`TESSERACT_CMD`を設定してください。

### Google Sheets認証エラー

→ `GOOGLE_CREDENTIALS`または`GOOGLE_CREDENTIALS_PATH`が正しく設定されているか確認してください。
