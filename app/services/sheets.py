"""
Google Sheets API連携サービス
月別シートへのデータ書き込み
"""

import os
import json
import re
from datetime import datetime
from typing import Dict, Optional, List
import logging

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

# シート存在確認のキャッシュ（メモリ内）
_sheet_existence_cache = set()


def get_sheets_service():
    """
    Google Sheets APIサービスを取得
    
    Returns:
        Google Sheets APIサービスオブジェクト
    """
    # 環境変数から認証情報を取得
    credentials = None
    
    if os.getenv('GOOGLE_CREDENTIALS'):
        # JSON文字列として設定されている場合（本番環境）
        try:
            creds_dict = json.loads(os.getenv('GOOGLE_CREDENTIALS'))
            credentials = service_account.Credentials.from_service_account_info(
                creds_dict,
                scopes=['https://www.googleapis.com/auth/spreadsheets']
            )
            logger.info('認証情報を環境変数から取得しました')
        except json.JSONDecodeError as e:
            raise ValueError(f'GOOGLE_CREDENTIALSのJSON解析に失敗しました: {e}')
    elif os.getenv('GOOGLE_CREDENTIALS_PATH'):
        # ファイルパスが指定されている場合（開発環境）
        creds_path = os.getenv('GOOGLE_CREDENTIALS_PATH')
        if not os.path.exists(creds_path):
            raise FileNotFoundError(f'認証情報ファイルが見つかりません: {creds_path}')
        credentials = service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        logger.info(f'認証情報をファイルから取得しました: {creds_path}')
    else:
        # デフォルトパスを試す
        default_path = 'backend/config/credentials.json'
        if os.path.exists(default_path):
            credentials = service_account.Credentials.from_service_account_file(
                default_path,
                scopes=['https://www.googleapis.com/auth/spreadsheets']
            )
            logger.info(f'認証情報をデフォルトパスから取得しました: {default_path}')
        else:
            raise ValueError(
                'GOOGLE_CREDENTIALSまたはGOOGLE_CREDENTIALS_PATH環境変数を設定してください'
            )
    
    service = build('sheets', 'v4', credentials=credentials)
    return service


def get_sheet_name_from_date(date_string: Optional[str] = None) -> str:
    """
    日付からシート名を生成（YYYY_MM形式）
    
    Args:
        date_string: 日付文字列（YYYY-MM-DD形式）、Noneの場合は現在の日付
    
    Returns:
        シート名（例: "2025_01"）
    """
    if date_string:
        try:
            date_obj = datetime.strptime(date_string, '%Y-%m-%d')
        except ValueError:
            date_obj = datetime.now()
    else:
        date_obj = datetime.now()
    
    return f"{date_obj.year}_{date_obj.month:02d}"


def ensure_sheet_exists(sheet_name: str, spreadsheet_id: str) -> None:
    """
    シートが存在するか確認し、存在しない場合は作成
    
    Args:
        sheet_name: シート名
        spreadsheet_id: スプレッドシートID
    """
    cache_key = f"{spreadsheet_id}_{sheet_name}"
    
    # キャッシュをチェック
    if cache_key in _sheet_existence_cache:
        return
    
    service = get_sheets_service()
    
    try:
        # スプレッドシートのメタデータを取得
        spreadsheet = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        existing_sheets = spreadsheet.get('sheets', [])
        
        # シートが存在するかチェック
        sheet_exists = any(
            sheet['properties']['title'] == sheet_name
            for sheet in existing_sheets
        )
        
        if not sheet_exists:
            logger.info(f'新しいシートを作成します: {sheet_name}')
            
            # シートを作成
            request_body = {
                'requests': [{
                    'addSheet': {
                        'properties': {
                            'title': sheet_name
                        }
                    }
                }]
            }
            service.spreadsheets().batchUpdate(
                spreadsheetId=spreadsheet_id,
                body=request_body
            ).execute()
            
            # ヘッダー行を追加
            headers = [
                'Date',
                'Store name',
                'Payer',
                'Amount (tax excluded)',
                'Amount (tax included)',
                'Tax',
                'Payment method',
                'Expense category',
                'Project / client name',
                'Notes',
                'Receipt image URL'
            ]
            
            service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=f'{sheet_name}!A1:K1',
                valueInputOption='RAW',
                body={'values': [headers]}
            ).execute()
            
            logger.info(f'シート {sheet_name} を作成し、ヘッダーを追加しました')
        
        # キャッシュに追加
        _sheet_existence_cache.add(cache_key)
    
    except HttpError as e:
        logger.error(f'シート存在確認エラー: {e}')
        raise


def write_receipt(receipt_data: Dict, spreadsheet_id: Optional[str] = None) -> Dict:
    """
    レシートデータをGoogle Sheetsに書き込み
    
    Args:
        receipt_data: レシートデータ（date, storeName, amountInclTax等）
        spreadsheet_id: スプレッドシートID（Noneの場合は環境変数から取得）
    
    Returns:
        {
            "success": True,
            "rowNumber": 5,
            "sheetName": "2025_01"
        }
    """
    if not spreadsheet_id:
        spreadsheet_id = os.getenv('GOOGLE_SHEETS_ID')
    
    if not spreadsheet_id:
        raise ValueError(
            'GOOGLE_SHEETS_ID環境変数を設定するか、spreadsheet_idを指定してください'
        )
    
    service = get_sheets_service()
    sheet_name = get_sheet_name_from_date(receipt_data.get('date'))
    
    # シートが存在することを確認
    ensure_sheet_exists(sheet_name, spreadsheet_id)
    
    # 行データを準備（既存のNode.js版と同じ順序）
    row_data = [
        receipt_data.get('date', ''),
        receipt_data.get('storeName', ''),
        receipt_data.get('payer', ''),
        receipt_data.get('amountExclTax') if receipt_data.get('amountExclTax') is not None else '',
        receipt_data.get('amountInclTax') if receipt_data.get('amountInclTax') is not None else '',
        receipt_data.get('tax') if receipt_data.get('tax') is not None else '',
        receipt_data.get('paymentMethod', ''),
        receipt_data.get('expenseCategory', ''),
        receipt_data.get('projectName', ''),
        receipt_data.get('notes', ''),
        receipt_data.get('receiptImageUrl', '')
    ]
    
    # 行を追加
    try:
        result = service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range=f'{sheet_name}!A:K',
            valueInputOption='RAW',
            insertDataOption='INSERT_ROWS',
            body={'values': [row_data]}
        ).execute()
        
        # 更新された範囲から行番号を取得
        updated_range = result.get('updates', {}).get('updatedRange', '')
        row_number = 0
        if updated_range:
            match = re.search(r'A(\d+)', updated_range)
            if match:
                row_number = int(match.group(1))
        
        logger.info(f'レシートデータをシート {sheet_name} の {row_number} 行目に書き込みました')
        
        return {
            "success": True,
            "rowNumber": row_number,
            "sheetName": sheet_name
        }
    
    except HttpError as e:
        logger.error(f'Google Sheets書き込みエラー: {e}')
        raise ValueError(f'Google Sheetsへの書き込みに失敗しました: {e}')


def get_history(month: Optional[str] = None, limit: int = 50, spreadsheet_id: Optional[str] = None) -> List[Dict]:
    """
    レシート履歴を取得
    
    Args:
        month: 月（YYYY-MM形式、例: "2025-01"）、Noneの場合は現在の月
        limit: 取得件数の上限
        spreadsheet_id: スプレッドシートID（Noneの場合は環境変数から取得）
    
    Returns:
        レシートデータのリスト
    """
    if not spreadsheet_id:
        spreadsheet_id = os.getenv('GOOGLE_SHEETS_ID')
    
    if not spreadsheet_id:
        raise ValueError('GOOGLE_SHEETS_ID環境変数を設定してください')
    
    service = get_sheets_service()
    
    # シート名を決定
    if month:
        sheet_name = month.replace('-', '_')
    else:
        sheet_name = get_sheet_name_from_date()
    
    try:
        # データを読み取り（ヘッダー行をスキップ）
        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f'{sheet_name}!A2:K1000'  # 最大1000行まで
        ).execute()
        
        rows = result.get('values', [])
        
        # レシートオブジェクトに変換
        receipts = []
        for row in rows[:limit]:
            if not row or not row[0]:  # 空行をスキップ
                continue
            
            receipt = {
                'date': row[0] if len(row) > 0 else '',
                'storeName': row[1] if len(row) > 1 else '',
                'payer': row[2] if len(row) > 2 else '',
                'amountExclTax': float(row[3]) if len(row) > 3 and row[3] else None,
                'amountInclTax': float(row[4]) if len(row) > 4 and row[4] else None,
                'tax': float(row[5]) if len(row) > 5 and row[5] else None,
                'paymentMethod': row[6] if len(row) > 6 else '',
                'expenseCategory': row[7] if len(row) > 7 else '',
                'projectName': row[8] if len(row) > 8 else '',
                'notes': row[9] if len(row) > 9 else '',
                'receiptImageUrl': row[10] if len(row) > 10 else ''
            }
            receipts.append(receipt)
        
        logger.info(f'シート {sheet_name} から {len(receipts)} 件のレシートを取得しました')
        return receipts
    
    except HttpError as e:
        if 'Unable to parse range' in str(e):
            logger.info(f'シート {sheet_name} が見つからないか、空です')
            return []
        raise
