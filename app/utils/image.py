"""
画像前処理ユーティリティ
OpenCVを使用した画像の前処理（グレースケール、二値化、リサイズなど）
"""

import cv2
import numpy as np
from typing import Tuple


def preprocess_image(image: np.ndarray) -> np.ndarray:
    """
    画像の前処理を実行（グレースケール → 二値化 → リサイズ）
    
    Args:
        image: OpenCVで読み込んだ画像（BGR形式）
    
    Returns:
        前処理済みの画像（グレースケール、二値化済み）
    """
    # グレースケール変換
    gray = convert_to_grayscale(image)
    
    # 二値化
    binary = binarize_image(gray)
    
    # リサイズ（解像度最適化）
    resized = resize_image(binary)
    
    return resized


def convert_to_grayscale(image: np.ndarray) -> np.ndarray:
    """
    画像をグレースケールに変換
    
    Args:
        image: BGR形式の画像
    
    Returns:
        グレースケール画像
    """
    if len(image.shape) == 3:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return image


def binarize_image(image: np.ndarray) -> np.ndarray:
    """
    画像を二値化（適応的閾値処理）
    
    Args:
        image: グレースケール画像
    
    Returns:
        二値化画像
    """
    # 適応的閾値処理（ADAPTIVE_THRESH_GAUSSIAN_C）
    # 画像の局所的な明るさの違いに対応
    binary = cv2.adaptiveThreshold(
        image,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        11,  # ブロックサイズ
        2    # C値（平均から引く値）
    )
    
    return binary


def resize_image(image: np.ndarray, max_width: int = 2000, max_height: int = 2000) -> np.ndarray:
    """
    画像をリサイズ（解像度最適化）
    
    Args:
        image: 入力画像
        max_width: 最大幅
        max_height: 最大高さ
    
    Returns:
        リサイズ済み画像
    """
    height, width = image.shape[:2]
    
    # 既に適切なサイズの場合はそのまま返す
    if width <= max_width and height <= max_height:
        return image
    
    # アスペクト比を保ちながらリサイズ
    scale = min(max_width / width, max_height / height)
    new_width = int(width * scale)
    new_height = int(height * scale)
    
    resized = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
    
    return resized


def remove_noise(image: np.ndarray) -> np.ndarray:
    """
    ノイズ除去（オプション機能）
    
    Args:
        image: 入力画像
    
    Returns:
        ノイズ除去済み画像
    
    # 将来的な拡張案:
    # - モルフォロジー演算（開処理・閉処理）でノイズ除去
    # - ガウシアンフィルタで平滑化
    # - メディアンフィルタでスパイクノイズ除去
    """
    # モルフォロジー演算でノイズ除去
    kernel = np.ones((2, 2), np.uint8)
    denoised = cv2.morphologyEx(image, cv2.MORPH_CLOSE, kernel)
    
    return denoised


def enhance_contrast(image: np.ndarray) -> np.ndarray:
    """
    コントラスト調整（オプション機能）
    
    Args:
        image: 入力画像
    
    Returns:
        コントラスト調整済み画像
    
    # 将来的な拡張案:
    # - CLAHE（Contrast Limited Adaptive Histogram Equalization）で局所コントラスト調整
    # - ヒストグラム均等化で全体的なコントラスト改善
    """
    # CLAHE（適応的ヒストグラム均等化）
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(image)
    
    return enhanced


def deskew_image(image: np.ndarray) -> np.ndarray:
    """
    傾き補正（デスキュー）（オプション機能）
    
    Args:
        image: 入力画像
    
    Returns:
        傾き補正済み画像
    
    # 将来的な拡張案:
    # - Hough変換で直線検出
    # - 検出した直線の角度から傾きを計算
    # - アフィン変換で回転補正
    """
    # 簡易版：エッジ検出 → 直線検出 → 角度計算 → 回転
    # 実装は将来的な拡張として残す
    return image
