"""
FastAPIアプリケーションのエントリーポイント
"""

import os
import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.api.receipt import router as receipt_router

# 環境変数を読み込み
load_dotenv()

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPIアプリケーションの初期化
app = FastAPI(
    title="Receipt OCR API",
    description="レシートOCR・構造化Webアプリ（Python/FastAPI版）",
    version="1.0.0"
)

# CORS設定（既存のフロントエンドと連携）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では適切なオリジンを指定
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# APIルーターを登録
app.include_router(receipt_router, prefix="/api", tags=["receipt"])


# 静的ファイル配信（既存のfrontend/ディレクトリを参照）
frontend_path = Path(__file__).parent.parent / "frontend"

if frontend_path.exists():
    # 静的ファイル（CSS、JS、画像など）
    app.mount("/css", StaticFiles(directory=str(frontend_path / "css")), name="css")
    app.mount("/js", StaticFiles(directory=str(frontend_path / "js")), name="js")
    
    # HTMLファイルのルーティング
    @app.get("/")
    async def read_root():
        """ルートパスでupload.htmlを返す"""
        upload_file = frontend_path / "upload.html"
        if upload_file.exists():
            return FileResponse(str(upload_file))
        return {"message": "Frontend files not found"}
    
    @app.get("/upload.html")
    async def read_upload():
        """アップロード画面"""
        return FileResponse(str(frontend_path / "upload.html"))
    
    @app.get("/preview.html")
    async def read_preview():
        """プレビュー画面"""
        return FileResponse(str(frontend_path / "preview.html"))
    
    @app.get("/batch-review.html")
    async def read_batch_review():
        """バッチ確認画面"""
        return FileResponse(str(frontend_path / "batch-review.html"))
    
    @app.get("/history.html")
    async def read_history():
        """履歴画面"""
        return FileResponse(str(frontend_path / "history.html"))


# ヘルスチェックエンドポイント
@app.get("/api/health")
async def health_check():
    """ヘルスチェック"""
    return {
        "status": "ok",
        "service": "receipt-ocr-api",
        "version": "1.0.0"
    }


# エラーハンドリング
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """グローバル例外ハンドラー"""
    logger.error(f"予期しないエラー: {exc}", exc_info=True)
    return {
        "error": {
            "message": "内部サーバーエラーが発生しました",
            "statusCode": 500
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    # ポート番号を環境変数から取得（デフォルト: 8000）
    port = int(os.getenv("PORT", 8000))
    
    logger.info(f"FastAPIサーバーを起動します: http://localhost:{port}")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True  # 開発モード（自動リロード）
    )
