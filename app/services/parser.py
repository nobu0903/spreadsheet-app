"""
レシート構造化ロジック
スコアリング方式によるルールベース解析
"""

import re
from typing import Dict, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def parse_receipt_text(ocr_text: str) -> Dict[str, any]:
    """
    OCRテキストを構造化データに変換
    
    Args:
        ocr_text: OCRで抽出されたテキスト
    
    Returns:
        構造化されたレシートデータ
    """
    if not ocr_text or not ocr_text.strip():
        raise ValueError("OCRテキストが空です")
    
    lines = ocr_text.split('\n')
    lines = [line.strip() for line in lines if line.strip()]
    
    # 各フィールドを抽出
    store_name = extract_store_name(lines)
    date = extract_date(ocr_text)
    total_amount = extract_total_amount(lines)
    tax_amount = extract_tax_amount(lines)
    
    # 税抜き金額を計算（税額が取得できた場合）
    amount_excl_tax = None
    if total_amount and tax_amount:
        amount_excl_tax = total_amount - tax_amount
    elif total_amount:
        # 税額が取得できない場合は、税込金額から10%を引いて概算
        amount_excl_tax = int(total_amount / 1.1)
    
    return {
        "date": date,
        "storeName": store_name,
        "payer": "",  # デフォルト値（将来的に抽出ロジックを追加可能）
        "amountExclTax": amount_excl_tax,
        "amountInclTax": total_amount,
        "tax": tax_amount,
        "paymentMethod": "cash",  # デフォルト値（将来的に抽出ロジックを追加可能）
        "expenseCategory": "",  # デフォルト値
        "projectName": "",  # デフォルト値
        "notes": "",  # デフォルト値
        "receiptImageUrl": ""  # デフォルト値
    }


def extract_store_name(lines: List[str]) -> str:
    """
    店名を抽出（スコアリング方式）
    
    スコアリングルール:
    - 上から5行以内: +2点
    - 文字数が多い: +文字数×0.1点
    - 数字が多い: -数字数×1.5点
    - 電話番号・郵便番号パターン: -5点
    - よくある除外ワード（合計、小計、税込、税）: -5点
    
    Args:
        lines: テキストの行リスト
    
    Returns:
        店名（最もスコアが高い行）
    """
    if not lines:
        return ""
    
    best_line = ""
    best_score = float('-inf')
    
    for i, line in enumerate(lines[:10]):  # 上から10行までチェック
        score = 0
        
        # 上から5行以内: +2点
        if i < 5:
            score += 2
        
        # 文字数が多い: +文字数×0.1点
        score += len(line) * 0.1
        
        # 数字が多い: -数字数×1.5点
        digit_count = len(re.findall(r'\d', line))
        score -= digit_count * 1.5
        
        # 電話番号・郵便番号パターン: -5点
        if re.search(r'\d{2,4}-\d{2,4}-\d{4}', line):
            score -= 5
        if '〒' in line:
            score -= 5
        
        # よくある除外ワード: -5点
        exclude_keywords = ['合計', '小計', '税込', '税', '消費税', '総額', 'お預かり', 'お返し']
        if any(keyword in line for keyword in exclude_keywords):
            score -= 5
        
        # 金額パターン（円、¥など）: -3点
        if re.search(r'[¥円]\s*\d+', line) or re.search(r'\d+\s*円', line):
            score -= 3
        
        # 日付パターン: -2点
        if re.search(r'\d{4}[-年/]\d{1,2}[-月/]\d{1,2}', line):
            score -= 2
        
        if score > best_score:
            best_score = score
            best_line = line
    
    logger.info(f"店名抽出: '{best_line}' (スコア: {best_score:.2f})")
    return best_line


def extract_date(text: str) -> Optional[str]:
    """
    日付を抽出
    
    対応形式:
    - 20xx年mm月dd日
    - 20xx-mm-dd
    - 20xx/mm/dd
    
    Args:
        text: OCRテキスト全体
    
    Returns:
        日付文字列（YYYY-MM-DD形式）、見つからない場合はNone
    """
    # パターン1: 20xx年mm月dd日
    pattern1 = r'(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日'
    match = re.search(pattern1, text)
    if match:
        year, month, day = match.groups()
        try:
            date_str = f"{year}-{int(month):02d}-{int(day):02d}"
            # 日付の妥当性チェック
            datetime.strptime(date_str, '%Y-%m-%d')
            logger.info(f"日付抽出（和暦形式）: {date_str}")
            return date_str
        except ValueError:
            pass
    
    # パターン2: 20xx-mm-dd または 20xx/mm/dd
    pattern2 = r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})'
    match = re.search(pattern2, text)
    if match:
        year, month, day = match.groups()
        try:
            date_str = f"{year}-{int(month):02d}-{int(day):02d}"
            datetime.strptime(date_str, '%Y-%m-%d')
            logger.info(f"日付抽出（ISO形式）: {date_str}")
            return date_str
        except ValueError:
            pass
    
    # パターン3: 和暦対応（将来的な拡張）
    # 令和、平成などの和暦を西暦に変換
    # 実装は将来的な拡張として残す
    
    logger.warning("日付が見つかりませんでした")
    return None


def _extract_amounts_from_line(line: str) -> List[int]:
    """
    1行から「金額っぽい数値」をすべて抽出するヘルパー。
    ¥1,234 / 1,234円 / 1234 のようなパターンに対応。
    """
    amounts: List[int] = []

    # パターン1: ¥1,234 / 1,234円 / 1234円
    pattern1 = r'[¥￥]?\s*([\d,]+)\s*円?'
    for match in re.findall(pattern1, line):
        amount_str = match.replace(',', '')
        try:
            value = int(amount_str)
            if 100 <= value <= 10_000_000:  # 妥当な範囲
                amounts.append(value)
        except ValueError:
            continue

    # パターン2: カンマ付きでない3桁以上の数字（年などはあとで除外）
    pattern2 = r'\b(\d{3,})\b'
    for match in re.findall(pattern2, line):
        amount_str = match.replace(',', '')
        try:
            value = int(amount_str)
            if 100 <= value <= 10_000_000:
                amounts.append(value)
        except ValueError:
            continue

    return amounts


def extract_total_amount(lines: List[str]) -> Optional[int]:
    """
    合計金額を抽出する。

    基本方針:
    1. 「合計」を意味するキーワードを含む行から金額を優先的に採用（ルールA/B）
    2. それでも見つからない場合、レシート後半の行を中心にスコアリングして最も「合計らしい」金額を選ぶ（ルールC〜E）
    """
    if not lines:
        return None

    # --- ルールA: 合計キーワード優先 -------------------------------
    strong_keywords = ["お支払い合計", "お支払合計", "ご利用金額", "総計", "合計"]
    weak_keywords = ["税込合計", "計"]

    def has_any(line: str, keywords: List[str]) -> bool:
        return any(k in line for k in keywords)

    # 「小計」は明示的に除外したいのでここで弾く
    def is_subtotal_line(line: str) -> bool:
        return "小計" in line

    # 電話番号行かどうか
    def is_phone_line(line: str) -> bool:
        return "-" in line and re.search(r'\d{2,4}-\d{2,4}-\d{3,4}', line) is not None

    # 日付行かどうか（年・月・日を含むもの）
    def is_date_line(line: str) -> bool:
        return bool(re.search(r'\d{4}年|\d{1,2}月|\d{1,2}日', line))

    # 税・内訳・預かり・お釣りなど「合計そのものではない」行
    def is_tax_or_deposit_line(line: str) -> bool:
        ng_words = ["内消費税", "税額", "対象", "預り", "お預り", "お預かり", "お釣り", "釣"]
        return any(w in line for w in ng_words)

    # まずは強いキーワードだけを見る
    for line in lines:
        if is_subtotal_line(line) or is_phone_line(line):
            continue
        if has_any(line, strong_keywords):
            amounts = _extract_amounts_from_line(line)
            if amounts:
                # 合計っぽい行の中の金額だけをそのまま採用
                chosen = max(amounts)
                logger.info(f"合計金額抽出（強キーワード）: {chosen}円, 行='{line}'")
                return chosen

    # 次に弱めのキーワード
    for line in lines:
        if is_subtotal_line(line) or is_phone_line(line):
            continue
        if has_any(line, weak_keywords):
            amounts = _extract_amounts_from_line(line)
            if amounts:
                chosen = max(amounts)
                logger.info(f"合計金額抽出（弱キーワード）: {chosen}円, 行='{line}'")
                return chosen

    # --- ルールC〜E: スコアリングによるフォールバック ----------------
    # 合計はレシートの後半にあることが多いので、後半40%を優先的に見る
    n = len(lines)
    start_idx = int(n * 0.6)

    best_score = float('-inf')
    best_amount: Optional[int] = None

    def score_candidate(line_idx: int, line: str, amount: int, count_in_line: int) -> float:
        score = 0.0

        # E: 行に「合計」系キーワードがあれば大きく加点
        if has_any(line, strong_keywords):
            score += 100
        if has_any(line, weak_keywords):
            score += 40

        # C-1: レシート後半にあるほど加点
        if line_idx >= start_idx:
            score += 20

        # 円記号・「円」が付いていれば加点
        if "円" in line or "¥" in line or "￥" in line:
            score += 10

        # 税・内訳・預かり・お釣りなどが含まれていなければ加点
        if not is_tax_or_deposit_line(line):
            score += 10

        # 数字が1つだけならより「合計っぽい」
        if count_in_line == 1:
            score += 5

        return score

    # まずは後半40%の行を見てスコアリング
    for idx in range(start_idx, n):
        line = lines[idx]
        if is_phone_line(line) or is_date_line(line):
            continue
        if is_tax_or_deposit_line(line):
            continue

        amounts = _extract_amounts_from_line(line)
        if not amounts:
            continue

        count_in_line = len(amounts)
        for amt in amounts:
            # 年っぽい値（1900〜2100）は除外
            if 1900 <= amt <= 2100:
                continue
            s = score_candidate(idx, line, amt, count_in_line)
            if s > best_score:
                best_score = s
                best_amount = amt

    # それでも見つからない場合、全行を対象に同じスコアリング
    if best_amount is None:
        for idx, line in enumerate(lines):
            if is_phone_line(line) or is_date_line(line):
                continue
            if is_tax_or_deposit_line(line):
                continue

            amounts = _extract_amounts_from_line(line)
            if not amounts:
                continue

            count_in_line = len(amounts)
            for amt in amounts:
                if 1900 <= amt <= 2100:
                    continue
                s = score_candidate(idx, line, amt, count_in_line)
                if s > best_score:
                    best_score = s
                    best_amount = amt

    if best_amount is not None:
        logger.info(f"合計金額抽出（スコアリング）: {best_amount}円（スコア: {best_score:.2f}）")
        return best_amount

    logger.warning("合計金額が見つかりませんでした")
    return None


def extract_tax_amount(lines: List[str]) -> Optional[int]:
    """
    税額を抽出
    
    「消費税」または「税」を含む行から数値を抽出
    
    Args:
        lines: テキストの行リスト
    
    Returns:
        税額（整数）、見つからない場合はNone
    """
    for line in lines:
        # 「消費税」「税」を含む行を検索
        if '消費税' in line or ('税' in line and '税込' not in line and '税抜' not in line):
            # 金額パターンを検索
            pattern = r'([\d,]+)'
            matches = re.findall(pattern, line)
            for match in matches:
                amount_str = match.replace(',', '')
                try:
                    amount = int(amount_str)
                    if 1 <= amount <= 1000000:  # 妥当な範囲
                        logger.info(f"税額抽出: {amount}円")
                        return amount
                except ValueError:
                    pass
    
    logger.warning("税額が見つかりませんでした")
    return None


def count_digits(text: str) -> int:
    """
    テキスト内の数字の数をカウント
    
    Args:
        text: テキスト
    
    Returns:
        数字の数
    """
    return len(re.findall(r'\d', text))


# 将来的な拡張案（コメント）

# 1. 店名抽出の改善
# - よくある店名パターンの辞書追加
#   STORE_NAMES = ["セブンイレブン", "ファミリーマート", "ローソン", ...]
#   if any(store in line for store in STORE_NAMES):
#       score += 10
#
# - レシート上部の位置情報をより重視
#   if i == 0:  # 最初の行
#       score += 5
#
# - 文字種の分析（店名は漢字・カタカナが多い）
#   kanji_count = len(re.findall(r'[\u4e00-\u9faf]', line))
#   katakana_count = len(re.findall(r'[\u30a0-\u30ff]', line))
#   if kanji_count + katakana_count > len(line) * 0.5:
#       score += 2

# 2. 日付抽出の改善
# - 和暦対応（令和、平成など）
#   era_pattern = r'(令和|平成|昭和)(\d{1,2})年\s*(\d{1,2})月\s*(\d{1,2})日'
#   def convert_era_to_western(era, year, month, day):
#       if era == "令和":
#           western_year = 2018 + int(year)
#       elif era == "平成":
#           western_year = 1988 + int(year)
#       ...
#
# - 相対日付（「本日」「昨日」など）
#   if "本日" in text or "今日" in text:
#       return datetime.now().strftime('%Y-%m-%d')

# 3. 金額抽出の改善
# - 「合計」「総額」などのキーワード検索
#   for line in lines:
#       if "合計" in line or "総額" in line:
#           amount = extract_amount_from_line(line)
#           if amount:
#               return amount
#
# - 複数の金額候補から最大値を選択するロジック強化
#   - 位置情報を考慮（下部にある金額を優先）
#   - キーワードの有無を考慮
#   - 金額の妥当性チェック（税込金額 > 税抜金額 + 税額）

# 4. 人の修正ログを学習データに
# - 修正前後のデータをJSON形式で保存
#   {
#       "original": {...},
#       "corrected": {...},
#       "timestamp": "...",
#       "user": "..."
#   }
# - 将来的に機械学習モデルに活用可能な構造
# - 修正パターンを分析してルールを改善

# 5. その他のフィールド抽出
# - 支払方法: "現金", "カード", "電子マネー" などのキーワード検索
# - カテゴリ: 店名からカテゴリを推測（コンビニ、スーパー、レストランなど）
# - プロジェクト名: 手動入力またはデフォルト値
