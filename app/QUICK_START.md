# クイックスタートガイド

## 現在の状況

✅ **完了した項目：**
- Python依存パッケージのインストール完了
- OpenCV 4.13.0.90（NumPy 2.x対応）インストール完了
- FastAPIアプリケーションのインポート成功
- フロントエンドのAPIエンドポイントをポート8000に変更

## 次のステップ

### 1. FastAPIサーバーの起動

新しいターミナル（PowerShell）を開いて、以下を実行：

```powershell
cd C:\Users\Owner\Programming\Code\Javascript\spreadSheetApp
python -m app.main
```

または：

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

サーバーが起動すると、以下のメッセージが表示されます：
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 2. ブラウザでアクセス

**重要：** `http://localhost:8000` でアクセスしてください（ポート3000ではありません）

### 3. Tesseract OCRのインストール（まだの場合）

400エラーが発生する場合は、Tesseract OCRがインストールされていない可能性があります。

**Windows環境：**
1. [Tesseract OCR for Windows](https://github.com/UB-Mannheim/tesseract/wiki) からインストーラーをダウンロード
2. インストール時に「Additional language data」で日本語（Japanese）を選択
3. インストール後、以下で確認：
   ```bash
   tesseract --version
   ```

詳細は `app/TESSERACT_INSTALL.md` を参照してください。

### 4. 動作確認

1. `http://localhost:8000` にアクセス
2. `/api/health` エンドポイントでヘルスチェック：
   - ブラウザで `http://localhost:8000/api/health` を開く
   - `{"status":"ok",...}` が表示されればOK
3. レシート画像のアップロード機能をテスト

## トラブルシューティング

### 400エラー（Bad Request）

- Tesseract OCRがインストールされていない可能性
- 日本語データパッケージ（jpn.traineddata）が不足している可能性
- 画像ファイル形式がサポートされていない可能性

### 404エラー（Not Found）

- FastAPIサーバーが起動していない可能性
- ポート8000でアクセスしているか確認
- ブラウザのコンソールでエラーメッセージを確認

### CORSエラー

- FastAPIサーバーのCORS設定を確認（`app/main.py`）
- ブラウザのコンソールでエラーメッセージを確認
