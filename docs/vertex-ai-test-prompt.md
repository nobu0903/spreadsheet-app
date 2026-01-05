# Vertex AI Studio テスト用プロンプト

## Vertex AI Studioでの確認手順

1. [Vertex AI Studio](https://console.cloud.google.com/vertex-ai/studio?project=mindmirror-39d7c)にアクセス
2. 以下のプロンプトを入力
3. 「Get code」ボタンをクリック
4. 「REST」タブを選択
5. 表示されるコード内のエンドポイントURLをコピー

## テスト用プロンプト

```
これはテストメッセージです。JSON形式で{"test": "ok"}と返答してください。
```

または、より簡単なプロンプト：

```
こんにちは
```

または：

```
test
```

## 確認すべき情報

「Get code」で表示されるREST APIコードから以下を確認してください：

1. **エンドポイントURL**の完全な形式
2. **モデル名**（どのように指定されているか）
3. **リクエストボディ**の形式

### 1. エンドポイントURLの完全な形式

通常、以下の形式になっています（リージョンやメソッドは設定によります）：

```
POST https://{リージョン}-aiplatform.googleapis.com/v1/projects/{プロジェクトID}/locations/{リージョン}/publishers/google/models/{モデルID}:streamGenerateContent
```

または

```
POST https://{リージョン}-aiplatform.googleapis.com/v1/projects/{プロジェクトID}/locations/{リージョン}/publishers/google/models/{モデルID}:generateContent
```

※ `:streamGenerateContent` または `:generateContent` が末尾に付きます。

### 2. モデル名（指定箇所）

URLパスの中に埋め込まれています。

例：
```
.../models/gemini-1.5-flash-001:streamGenerateContent
```

ここでのモデル名は `gemini-1.5-flash-001` （または `pro` など）です。

### 3. リクエストボディの形式

JSON形式で、主に `contents` 配列を含みます：

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "ここにプロンプトが入ります（例: こんにちは）"
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 1,
    "topP": 0.95,
    "maxOutputTokens": 8192
  }
}
```

### テスト応答の例

テストプロンプト「これはテストメッセージです。JSON形式で{"test": "ok"}と返答してください。」への期待される応答：

```json
{
  "test": "ok"
}
```

このエンドポイントURLとリクエスト形式を現在のコードと比較してください。

## 重要な確認事項

### Vertex AI Studioの「Get code」で確認すべきポイント

1. **モデル名の形式**：
   - エイリアス（`gemini-1.5-flash`）で表示されるか
   - バージョン番号付き（`gemini-1.5-flash-001`）で表示されるか
   - → これは現在のコードが使用しているモデル名と一致しているか確認

2. **エンドポイントのメソッド**：
   - `:generateContent`（非ストリーミング）か
   - `:streamGenerateContent`（ストリーミング）か
   - → 現在のコードは `:generateContent` を使用

3. **generationConfigの設定**：
   - Vertex AI Studioのデフォルト: `temperature: 1, topP: 0.95, maxOutputTokens: 8192`
   - 現在のコード: `temperature: 0.1, maxOutputTokens: 2048`（topPなし）
   - → 用途に応じて調整可能

### Get codeの結果（実際の設定）

Vertex AI Studioの「Get code」で表示されたFirebase SDKコードから：
- **リージョン**: `"global"`
- **モデル名**: `"gemini-3-pro-preview"`
- **generationConfig**: `temperature: 1, topP: 0.95, maxOutputTokens: 65535`

### 現在のコードとの比較（修正後）

現在のコード（`backend/services/aiParseService.js`）：
- **モデル名**: `gemini-3-pro-preview`（デフォルト、Get codeの結果と一致）
- **リージョン**: `global`（デフォルト、Get codeの結果と一致）
- **エンドポイント**: `global`リージョン用のURL形式に対応
  - `global`リージョン: `https://aiplatform.googleapis.com/v1/projects/...`
  - その他リージョン: `https://{LOCATION}-aiplatform.googleapis.com/v1/projects/...`
- **generationConfig**: `temperature: 0.1, topP: 0.95, maxOutputTokens: 2048`
  - Get codeの結果と同様に`topP`パラメータを追加

### 修正内容

1. **デフォルトリージョンを`global`に変更**（Get codeの結果に合わせる）
2. **デフォルトモデル名を`gemini-3-pro-preview`に変更**（Get codeの結果に合わせる）
3. **`global`リージョン用のエンドポイントURL形式を実装**
4. **`generationConfig`に`topP`パラメータを追加**


