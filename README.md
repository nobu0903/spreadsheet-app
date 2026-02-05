# Receipt Processing App

企業内レシート処理Webアプリケーション - レシート画像をOCRで読み取り、AIで構造化し、Google Sheetsに書き込むアプリケーション

## 📋 プロジェクト概要

このアプリケーションは、会計スタッフの手作業を削減するための企業内ツールです。

### 主な機能

- レシート画像（JPEG/PNG）のアップロード
- Google Vision APIによるOCRテキスト抽出
- AI（LLM）による構造化データ変換
- ユーザー確認・編集画面
- Google Sheetsへの1レシート=1行の書き込み
- 処理履歴の表示

## 🏗️ プロジェクト構造

```
project-root/
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── upload.js
│   │   ├── preview.js
│   ├── upload.html
│   ├── preview.html
│   │   └── (removed) history.js
│   └── (removed) history.html
├── backend/
│   ├── controllers/
│   │   ├── ocrController.js
│   │   ├── aiController.js
│   │   └── sheetController.js
│   ├── services/
│   │   ├── visionService.js
│   │   ├── aiParseService.js
│   │   └── sheetService.js
│   ├── routes/
│   │   ├── ocrRoutes.js
│   │   ├── aiRoutes.js
│   │   └── sheetRoutes.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── errorHandler.js
│   ├── config/
│   │   ├── credentials.json
│   │   └── config.example.json
│   ├── app.js
│   └── server.js
├── docs/
│   ├── api-spec.md
│   └── system-flow.md
├── .env
├── package.json
└── README.md
```

## 🚀 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env`ファイルを編集し、必要な設定値を入力してください。

### 3. Google API認証情報の設定

1. Google Cloud Consoleでプロジェクトを作成
2. Vision APIとSheets APIを有効化
3. サービスアカウントを作成し、認証情報JSONをダウンロード
4. `backend/config/credentials.json`に保存

### 4. サーバーの起動

```bash
npm start
```

開発モード（自動リロード）:

```bash
npm run dev
```

### 5. ブラウザでアクセス

```
http://localhost:3000
```

## 📝 開発状況

現在、プロジェクトスケルトンが作成されています。以下の機能は実装待ちです：

- [ ] Google Vision API統合
- [ ] AI構造化サービス実装
- [ ] Google Sheets API統合
- [ ] ログイン機能
- [ ] フロントエンドとバックエンドの連携

## 🔧 技術スタック

- **バックエンド**: Node.js + Express
- **フロントエンド**: HTML/CSS/JavaScript
- **OCR**: Google Vision API
- **AI**: Google Vertex AI または OpenAI GPT
- **データ保存**: Google Sheets

## 📚 ドキュメント

詳細な仕様については、`docs/`フォルダ内のドキュメントを参照してください。

- `api-spec.md`: API仕様書
- `system-flow.md`: システムフロー図
- `env-setup.md`: 環境変数設定ガイド
- `render-deployment.md`: Renderデプロイ手順

## 🚢 デプロイ

### Renderへのデプロイ

このアプリケーションはRenderにデプロイ可能です。詳細な手順は[`docs/render-deployment.md`](docs/render-deployment.md)を参照してください。

**主なポイント：**
- 認証情報は環境変数`GOOGLE_CREDENTIALS`（JSON文字列）として設定
- ローカル開発では`GOOGLE_CREDENTIALS_PATH`（ファイルパス）を使用
- `render.yaml`でデプロイ設定を定義

## 👥 ユーザー

- 企業内会計スタッフ（1-2名）
- PCブラウザ（Chrome推奨）での利用

## 📄 ライセンス

ISC


