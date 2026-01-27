"""
OCR処理サービス
Tesseract OCRを使用した日本語テキスト抽出
"""

import cv2
import numpy as np
import pytesseract
import os
from typing import Dict, Optional
import logging

from app.utils.image import preprocess_image

logger = logging.getLogger(__name__)

# Tesseract OCRのパス設定（Windows環境でPATHに追加されていない場合）
# 環境変数TESSERACT_CMDが設定されている場合はそれを使用
tesseract_path = None
if os.getenv('TESSERACT_CMD'):
    tesseract_path = os.getenv('TESSERACT_CMD')
    pytesseract.pytesseract.tesseract_cmd = tesseract_path
elif os.name == 'nt':  # Windows
    # デフォルトのインストールパスを試す
    default_paths = [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    ]
    for path in default_paths:
        if os.path.exists(path):
            tesseract_path = path
            pytesseract.pytesseract.tesseract_cmd = path
            logger.info(f'Tesseract OCRのパスを設定しました: {path}')
            break

# TESSDATA_PREFIXの設定（日本語データファイルの場所を指定）
if not os.getenv('TESSDATA_PREFIX') and tesseract_path:
    # Tesseractのインストールパスからtessdataフォルダのパスを推測
    tessdata_dir = os.path.join(os.path.dirname(tesseract_path), 'tessdata')
    if os.path.exists(tessdata_dir):
        os.environ['TESSDATA_PREFIX'] = tessdata_dir
        logger.info(f'TESSDATA_PREFIXを設定しました: {tessdata_dir}')
    else:
        logger.warning(f'tessdataフォルダが見つかりません: {tessdata_dir}')
else:
    if tesseract_path:
        logger.info(f'TESSDATA_PREFIXは既に設定されています: {os.getenv("TESSDATA_PREFIX")}')


def extract_text(image_bytes: bytes) -> Dict[str, any]:
    """
    画像からテキストを抽出（OCR処理）
    
    Args:
        image_bytes: 画像ファイルのバイトデータ
    
    Returns:
        {
            "text": "抽出されたテキスト",
            "confidence": 0.95  # 信頼度（0-1）
        }
    """
    try:
        # バイトデータをOpenCV形式に変換
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise ValueError("画像の読み込みに失敗しました")
        
        # 画像前処理
        processed_image = preprocess_image(image)
        
        # Tesseract OCR実行（日本語モード）
        # lang='jpn' で日本語を指定
        # config='--psm 6' で単一の均一なテキストブロックとして認識
        custom_config = r'--oem 3 --psm 6 -l jpn'
        text = pytesseract.image_to_string(processed_image, config=custom_config)
        
        # 信頼度の取得（可能な場合）
        # Tesseractの詳細情報から信頼度を計算
        try:
            data = pytesseract.image_to_data(processed_image, config=custom_config, output_type=pytesseract.Output.DICT)
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) / 100.0 if confidences else 0.5
        except Exception as e:
            logger.warning(f"信頼度の取得に失敗: {e}")
            avg_confidence = 0.5
        
        # テキストの整形（改行・空白の整理）
        cleaned_text = clean_text(text)
        
        logger.info(f"OCR処理完了: {len(cleaned_text)}文字抽出, 信頼度: {avg_confidence:.2f}")
        
        return {
            "text": cleaned_text,
            "confidence": round(avg_confidence, 2)
        }
    
    except Exception as e:
        logger.error(f"OCR処理エラー: {e}")
        raise ValueError(f"OCR処理に失敗しました: {str(e)}")


def clean_text(text: str) -> str:
    """
    抽出されたテキストを整形
    
    Args:
        text: 抽出されたテキスト
    
    Returns:
        整形済みテキスト
    """
    if not text:
        return ""
    
    # 改行を統一
    lines = text.split('\n')
    
    # 空行を削除
    lines = [line.strip() for line in lines if line.strip()]
    
    # 連続する空白を1つに
    cleaned_lines = []
    for line in lines:
        cleaned_line = ' '.join(line.split())
        if cleaned_line:
            cleaned_lines.append(cleaned_line)
    
    return '\n'.join(cleaned_lines)


def extract_text_with_boxes(image_bytes: bytes) -> Dict:
    """
    テキストと位置情報を抽出（将来的な拡張用）
    
    Args:
        image_bytes: 画像ファイルのバイトデータ
    
    Returns:
        テキストとバウンディングボックスの情報
    
    # 将来的な拡張案:
    # - 各テキストの位置情報（バウンディングボックス）を取得
    # - レシートのレイアウト解析に活用
    # - 店名が上部にある、金額が下部にあるなどの位置情報を利用
    """
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        processed_image = preprocess_image(image)
        
        # 詳細情報を取得
        data = pytesseract.image_to_data(
            processed_image,
            config=r'--oem 3 --psm 6 -l jpn',
            output_type=pytesseract.Output.DICT
        )
        
        # テキストと位置情報を組み合わせ
        boxes = []
        for i in range(len(data['text'])):
            if int(data['conf'][i]) > 0:
                boxes.append({
                    'text': data['text'][i],
                    'left': data['left'][i],
                    'top': data['top'][i],
                    'width': data['width'][i],
                    'height': data['height'][i],
                    'confidence': int(data['conf'][i]) / 100.0
                })
        
        return {
            "text": clean_text(' '.join([box['text'] for box in boxes])),
            "boxes": boxes
        }
    
    except Exception as e:
        logger.error(f"位置情報付きOCR処理エラー: {e}")
        raise ValueError(f"OCR処理に失敗しました: {str(e)}")
