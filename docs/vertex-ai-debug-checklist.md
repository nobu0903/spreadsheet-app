# Vertex AI 404エラー デバッグチェックリスト

## 現在の状況
- すべてのモデルが404エラーを返す
- Vertex AI APIは有効化済み
- サービスアカウントに権限あり
- プロジェクトIDは正しい

## 確認すべき項目

### 1. Vertex AI Studioでの確認
Vertex AI Studioで実際に使用しているモデル名とエンドポイントを確認してください。

1. [Vertex AI Studio](https://console.cloud.google.com/vertex-ai/studio?project=mindmirror-39d7c)にアクセス
2. 「Get code」ボタンをクリック
3. REST APIタブを確認
4. 表示されるコード内のエンドポイントURLとモデル名を確認

### 2. 実際に動作するエンドポイントの確認

Vertex AI Studioの「Get code」で表示されるREST APIコードを確認し、以下の情報を取得してください：
- エンドポイントURLの完全な形式
- 使用されているモデル名（エイリアスか、バージョン指定か）
- リクエストボディの形式

### 3. プロジェクトで利用可能なモデルの確認

以下のコマンドで、実際に利用可能なモデルを確認できます：

```bash
gcloud ai models list --region=us-central1 --project=mindmirror-39d7c
```

### 4. リージョンの確認

現在のコードでは`us-central1`を使用していますが、他のリージョン（例：`asia-northeast1`）で試してみてください。

### 5. エンドポイントパスの確認

現在使用しているエンドポイント：
```
https://us-central1-aiplatform.googleapis.com/v1/projects/mindmirror-39d7c/locations/us-central1/publishers/google/models/gemini-1.5-flash:generateContent
```

Vertex AI Studioの「Get code」で表示されるエンドポイントと比較してください。

## 次のステップ

1. Vertex AI Studioで「Get code」を確認
2. 表示されるREST APIコードをコピー
3. そのコードのエンドポイントURLとモデル名を確認
4. 現在のコードと比較して、違いを特定


