# Render デプロイ手順

このドキュメントでは、Spreadsheet AppをRenderにデプロイする手順を説明します。

## 前提条件

- Renderアカウント（[https://render.com](https://render.com)）
- GitHubリポジトリにコードがプッシュされていること
- Google Cloudプロジェクトとサービスアカウントが準備されていること

## デプロイ手順

### 1. Renderで新しいWebサービスを作成

1. [Render Dashboard](https://dashboard.render.com/)にログイン
2. 「New +」→「Web Service」を選択
3. GitHubリポジトリを接続
4. リポジトリ `nobu0903/spreadsheet-app` を選択

### 2. ビルド設定

- **Name**: `spreadsheet-app`（任意）
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free または Starter（必要に応じて）

### 3. 環境変数の設定

Renderのダッシュボードで以下の環境変数を設定します：

#### 必須環境変数

```
NODE_ENV=production
PORT=10000
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_SHEETS_ID=your-spreadsheet-id
AI_PROVIDER=vertex-ai
VERTEX_AI_PROJECT_ID=your-project-id
VERTEX_AI_LOCATION=global
VERTEX_AI_MODEL=gemini-3-pro-preview
```

#### 認証情報の設定（重要・必須）

**⚠️ 重要**: `GOOGLE_CREDENTIALS`環境変数は**必須**です。設定しないとアプリケーションが起動しません。

`GOOGLE_CREDENTIALS`環境変数には、サービスアカウントのJSONファイルの内容を**JSON文字列として**設定します。

**設定方法：**

1. ローカルの`credentials.json`ファイルを開く
2. ファイルの内容全体をコピー（改行を含む）
3. Renderの環境変数設定画面で：
   - **Key**: `GOOGLE_CREDENTIALS`
   - **Value**: コピーしたJSON文字列をそのまま貼り付け

**注意**: 
- JSON文字列をそのまま貼り付けるため、改行文字（`\n`）が含まれていても問題ありません
- 環境変数の値は複数行に対応しています
- 設定後、再デプロイが必要です

**例：**
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}
```

**注意**: JSON文字列をそのまま貼り付けるため、改行文字（`\n`）が含まれていても問題ありません。

### 4. デプロイの実行

1. 「Create Web Service」をクリック
2. Renderが自動的にビルドとデプロイを開始します
3. デプロイが完了すると、URLが表示されます（例: `https://spreadsheet-app.onrender.com`）

### 5. 動作確認

1. デプロイされたURLにアクセス
2. `/api/health`エンドポイントでヘルスチェック:
   ```
   https://your-app.onrender.com/api/health
   ```
3. レシート画像のアップロード機能をテスト

## トラブルシューティング

### 認証エラーが発生する場合

- `GOOGLE_CREDENTIALS`環境変数が正しく設定されているか確認
- JSON文字列が有効な形式か確認（改行が含まれていてもOK）
- サービスアカウントに必要な権限が付与されているか確認：
  - Cloud Vision API User
  - Google Sheets API User
  - Vertex AI User

### ビルドエラーが発生する場合

- `package.json`の`engines`で指定されたNode.jsバージョンがRenderでサポートされているか確認
- `package-lock.json`がリポジトリに含まれているか確認

### 環境変数が読み込まれない場合

- Renderのダッシュボードで環境変数が正しく設定されているか確認
- 環境変数名のタイポがないか確認
- デプロイ後に環境変数を追加した場合は、再デプロイが必要です

## セキュリティに関する注意事項

- `GOOGLE_CREDENTIALS`は機密情報です。Renderの環境変数として安全に管理されています
- 環境変数はRenderのダッシュボードでのみ設定・変更可能です
- ログに認証情報が出力されないよう注意してください

## 参考リンク

- [Render Documentation](https://render.com/docs)
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Environment Variables in Render](https://render.com/docs/environment-variables)

