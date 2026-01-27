"""
レシート処理API
OCR処理、構造化、Google Sheets書き込みのエンドポイント
"""

import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.ocr import extract_text
from app.services.parser import parse_receipt_text
from app.services.sheets import write_receipt, get_history

logger = logging.getLogger(__name__)

router = APIRouter()


class StructureRequest(BaseModel):
    """構造化リクエスト"""
    ocrText: str


class ReceiptData(BaseModel):
    """レシートデータ"""
    date: Optional[str] = None
    storeName: Optional[str] = None
    payer: Optional[str] = None
    amountExclTax: Optional[float] = None
    amountInclTax: Optional[float] = None
    tax: Optional[float] = None
    paymentMethod: Optional[str] = None
    expenseCategory: Optional[str] = None
    projectName: Optional[str] = None
    notes: Optional[str] = None
    receiptImageUrl: Optional[str] = None
    spreadsheetId: Optional[str] = None


@router.post("/ocr/process")
async def process_receipt_image(image: UploadFile = File(...)):
    """
    レシート画像をOCR処理してテキストを抽出
    
    Args:
        image: アップロードされた画像ファイル
    
    Returns:
        {
            "text": "抽出されたOCRテキスト",
            "confidence": 0.95
        }
    """
    try:
        # ファイルサイズチェック（10MB制限）
        contents = await image.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="画像ファイルサイズは10MB以下にしてください")
        
        # 画像形式チェック
        if not image.content_type or not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="画像ファイルをアップロードしてください")
        
        # OCR処理
        result = extract_text(contents)
        
        logger.info(f"OCR処理完了: {len(result['text'])}文字抽出")
        
        return result
    
    except ValueError as e:
        logger.error(f"OCR処理エラー: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"予期しないエラー: {e}")
        raise HTTPException(status_code=500, detail=f"OCR処理に失敗しました: {str(e)}")


@router.post("/ai/structure")
async def structure_receipt_data(request: StructureRequest):
    """
    OCRテキストを構造化データに変換（ルールベース解析）
    
    Args:
        request: OCRテキストを含むリクエスト
    
    Returns:
        構造化されたレシートデータ
    """
    try:
        if not request.ocrText or not request.ocrText.strip():
            raise HTTPException(status_code=400, detail="OCRテキストが空です")
        
        # ルールベース解析
        structured_data = parse_receipt_text(request.ocrText)
        
        logger.info(f"構造化完了: 店名={structured_data.get('storeName')}, 金額={structured_data.get('amountInclTax')}")
        
        return structured_data
    
    except ValueError as e:
        logger.error(f"構造化エラー: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"予期しないエラー: {e}")
        raise HTTPException(status_code=500, detail=f"構造化処理に失敗しました: {str(e)}")


@router.post("/sheets/write")
async def write_to_sheets(receipt_data: ReceiptData):
    """
    構造化されたレシートデータをGoogle Sheetsに書き込み
    
    Args:
        receipt_data: レシートデータ
    
    Returns:
        {
            "success": True,
            "rowNumber": 5,
            "sheetName": "2025_01"
        }
    """
    try:
        # 必須フィールドのチェック
        if not receipt_data.date:
            raise HTTPException(status_code=400, detail="日付は必須です")
        if not receipt_data.storeName:
            raise HTTPException(status_code=400, detail="店名は必須です")
        if receipt_data.amountInclTax is None:
            raise HTTPException(status_code=400, detail="税込金額は必須です")
        
        # spreadsheetIdを抽出（リクエストから削除）
        spreadsheet_id = receipt_data.spreadsheetId
        receipt_dict = receipt_data.dict(exclude={'spreadsheetId'})
        
        # Google Sheetsに書き込み
        result = write_receipt(receipt_dict, spreadsheet_id)
        
        logger.info(f"Google Sheets書き込み完了: シート={result['sheetName']}, 行={result['rowNumber']}")
        
        return result
    
    except ValueError as e:
        logger.error(f"Google Sheets書き込みエラー: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"予期しないエラー: {e}")
        raise HTTPException(status_code=500, detail=f"Google Sheetsへの書き込みに失敗しました: {str(e)}")


@router.get("/sheets/history")
async def get_receipt_history(month: Optional[str] = None, limit: int = 50):
    """
    レシート履歴を取得
    
    Args:
        month: 月（YYYY-MM形式、例: "2025-01"）
        limit: 取得件数の上限（デフォルト: 50、最大: 1000）
    
    Returns:
        {
            "receipts": [...],
            "total": 10
        }
    """
    try:
        # limitの検証
        if limit < 1 or limit > 1000:
            limit = 50
        
        # 履歴を取得
        receipts = get_history(month=month, limit=limit)
        
        logger.info(f"履歴取得完了: {len(receipts)}件")
        
        return {
            "receipts": receipts,
            "total": len(receipts)
        }
    
    except Exception as e:
        logger.error(f"履歴取得エラー: {e}")
        raise HTTPException(status_code=500, detail=f"履歴の取得に失敗しました: {str(e)}")
