# .envファイル設定ガイド

## 概要

`.env`ファイルには、アプリケーションの動作に必要な環境変数を設定します。このファイルは機密情報を含むため、Gitにコミットしないでください（`.gitignore`に含まれています）。

## 必須設定項目

### 1. サーバー設定

```env
PORT=3000
NODE_ENV=development
```

- **PORT**: サーバーが起動するポート番号（デフォルト: 3000）
- **NODE_ENV**: 実行環境（`development` または `production`）

### 2. Google Cloud設定

```env
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_CREDENTIALS_PATH=backend/config/credentials.json
```

- **GOOGLE_PROJECT_ID**: Google Cloud Consoleで作成したプロジェクトID
  - 取得方法: [Google Cloud Console](https://console.cloud.google.com/) → プロジェクト選択 → プロジェクトIDをコピー
- **GOOGLE_CREDENTIALS_PATH**: 認証情報JSONファイルのパス（通常は`backend/config/credentials.json`のまま）

### 3. Google Sheets設定

```env
GOOGLE_SHEETS_ID=your-spreadsheet-id
```

- **GOOGLE_SHEETS_ID**: 書き込み先のGoogleスプレッドシートのID
  - 取得方法: GoogleスプレッドシートのURLから取得
  - 例: `https://docs.google.com/spreadsheets/d/【この部分がID】/edit`
  - 例: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`

### 4. AI設定（どちらか一方を選択）

#### オプションA: Google Vertex AIを使用する場合（推奨）

```env
AI_PROVIDER=vertex-ai
VERTEX_AI_PROJECT_ID=your-project-id
VERTEX_AI_LOCATION=global
VERTEX_AI_MODEL=gemini-2.5-flash-exp
```

- **AI_PROVIDER**: `vertex-ai` または `openai`（使用するAIプロバイダー）
- **VERTEX_AI_PROJECT_ID**: Google CloudプロジェクトID（GOOGLE_PROJECT_IDと同じ値でOK）
- **VERTEX_AI_LOCATION**: Vertex AIのリージョン（**推奨: `global`**。その他: `us-central1`, `asia-northeast1`など）
  - **注意**: Vertex AI Studioの「Get code」では`global`リージョンが使用される場合があります
- **VERTEX_AI_MODEL**: 使用するモデル名（**デフォルト: `gemini-2.5-flash-exp`** - 高速で高精度）
  - **推奨**: `gemini-2.5-flash-exp`（最速、構造化データ抽出に最適）
  - **その他のオプション**: `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash-exp`, `gemini-3-pro-preview`
  - **注意**: エイリアス名を使用してください。バージョン番号（-001など）は付けない

#### オプションB: OpenAIを使用する場合

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4
```

- **OPENAI_API_KEY**: OpenAI APIキー
  - 取得方法: [OpenAI Platform](https://platform.openai.com/api-keys) でAPIキーを生成
- **OPENAI_MODEL**: 使用するモデル名（`gpt-4`, `gpt-3.5-turbo`など）

## 設定例（完全版）

### Vertex AIを使用する場合

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Google Cloud Configuration
GOOGLE_PROJECT_ID=my-receipt-app-123456
GOOGLE_CREDENTIALS_PATH=backend/config/credentials.json

# Google Sheets Configuration
GOOGLE_SHEETS_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

# AI Configuration (Vertex AI)
AI_PROVIDER=vertex-ai
VERTEX_AI_PROJECT_ID=my-receipt-app-123456
VERTEX_AI_LOCATION=global
VERTEX_AI_MODEL=gemini-2.5-flash-exp
```

### OpenAIを使用する場合

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Google Cloud Configuration
GOOGLE_PROJECT_ID=my-receipt-app-123456
GOOGLE_CREDENTIALS_PATH=backend/config/credentials.json

# Google Sheets Configuration
GOOGLE_SHEETS_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

# AI Configuration (OpenAI)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4
```

## セットアップ手順

### 1. Google Cloudプロジェクトの準備

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成（または既存プロジェクトを選択）
3. 以下のAPIを有効化:
   - Cloud Vision API
   - Google Sheets API
   - Vertex AI API（Vertex AIを使用する場合）**重要: Vertex AI APIが有効化されていないと、AI構造化機能が動作しません**

### 2. サービスアカウントの作成

1. Google Cloud Console → IAMと管理 → サービスアカウント
2. 「サービスアカウントを作成」をクリック
3. 名前を入力（例: `receipt-app-service`）
4. 作成後、サービスアカウントを選択
5. 「キー」タブ → 「キーを追加」→「JSONを作成」
6. ダウンロードしたJSONファイルを`backend/config/credentials.json`に保存

### 3. Googleスプレッドシートの準備

1. 新しいGoogleスプレッドシートを作成
2. 最初の行に以下の列ヘッダーを設定:
   - Date, Store name, Payer, Amount (tax excluded), Amount (tax included), Tax, Payment method, Expense category, Project / client name, Notes, Receipt image URL
3. スプレッドシートのURLからIDを取得
4. サービスアカウントにスプレッドシートの編集権限を付与:
   - スプレッドシート → 共有 → サービスアカウントのメールアドレスを追加（編集権限）

### 4. .envファイルの編集

上記の設定例を参考に、実際の値を記入してください。

## 注意事項

- `.env`ファイルは絶対にGitにコミットしないでください
- APIキーや認証情報は機密情報です。他人と共有しないでください
- 本番環境では、環境変数を別の方法（例: クラウドのシークレット管理サービス）で管理することを推奨します

