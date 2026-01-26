# Tesseract OCR インストール手順（Windows）

## 1. Tesseract OCRのダウンロードとインストール

1. [Tesseract OCR for Windows](https://github.com/UB-Mannheim/tesseract/wiki) にアクセス
2. 最新版のインストーラーをダウンロード（例: `tesseract-ocr-w64-setup-5.x.x.exe`）
3. インストーラーを実行
4. インストール先をメモ（デフォルト: `C:\Program Files\Tesseract-OCR`）

## 2. 日本語データパッケージの確認

インストール時に「Additional language data」で日本語（Japanese）を選択してください。

または、インストール後に以下を確認：
- `C:\Program Files\Tesseract-OCR\tessdata\jpn.traineddata` が存在するか確認

存在しない場合は、[tessdata/jpn.traineddata](https://github.com/tesseract-ocr/tessdata/blob/main/jpn.traineddata) をダウンロードして配置してください。

## 3. 環境変数の設定（オプション）

Tesseract OCRがPATHに追加されていない場合、`app/services/ocr.py`でパスを指定する必要があります。

```python
# app/services/ocr.py の先頭に追加
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

## 4. インストール確認

コマンドプロンプトまたはPowerShellで以下を実行：

```bash
tesseract --version
```

バージョン情報が表示されればOKです。
