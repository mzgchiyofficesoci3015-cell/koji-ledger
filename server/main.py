"""
工事台帳 サーバー v3
- LINEなし・Webアプリ専用
- JWT認証（ID/パスワード）
- Claude APIで画像読み取り
- PCエージェント向けキューAPI
"""
import os, json, base64, re, hashlib, secrets, io, tempfile
from pathlib import Path
from datetime import datetime, timedelta

import anthropic
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Google Drive
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseUpload
    GDRIVE_AVAILABLE = True
except ImportError:
    GDRIVE_AVAILABLE = False

app = FastAPI()

# CORS（Webアプリからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番時はフロントのURLに絞る
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# 設定
# =========================================================
CLAUDE_KEY  = os.environ["ANTHROPIC_API_KEY"]
JWT_SECRET  = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_EXPIRE  = 60 * 24 * 7  # 7日間（分）
DATA_FILE   = Path("data/store.json")
DATA_FILE.parent.mkdir(exist_ok=True)

CATEGORIES  = ["材料費", "人件費", "外注費", "経費"]
security    = HTTPBearer()
CAT_COLORS  = {"材料費": "1565C0", "人件費": "2E7D32", "外注費": "6A1B9A", "経費": "E65100"}
GDRIVE_FOLDER_ID = os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "")

def get_drive_service():
    """Google Drive サービスを取得"""
    if not GDRIVE_AVAILABLE or not GDRIVE_FOLDER_ID:
        return None
    creds_b64 = os.environ.get("GOOGLE_CREDENTIALS_B64", "")
    if not creds_b64:
        return None
    try:
        # 改行・スペース・不要文字を除去してからデコード
        creds_b64_clean = re.sub(r'[\s]', '', creds_b64)
        # base64パディング補正
        padding = 4 - len(creds_b64_clean) % 4
        if padding != 4:
            creds_b64_clean += '=' * padding
        creds_json = base64.b64decode(creds_b64_clean).decode("utf-8")
        # JSONの余分な文字を除去
        creds_json = creds_json.strip()
        # 複数のJSONが連結されている場合は最初のJSONオブジェクトだけ使う
        brace_count = 0
        end_idx = 0
        for i, ch in enumerate(creds_json):
            if ch == '{':
                brace_count += 1
            elif ch == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i + 1
                    break
        creds_json = creds_json[:end_idx]
        creds_info = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(
            creds_info,
            scopes=["https://www.googleapis.com/auth/drive"]
        )
        return build("drive", "v3", credentials=creds)
    except Exception as e:
        print(f"Google Drive接続エラー: {e}")
        return None

# =========================================================
# データ管理
# =========================================================
def load() -> dict:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return {"users": [], "projects": [], "queue": []}

def save(data: dict):
    DATA_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def active_projects(data: dict) -> list:
    return [p for p in data["projects"] if not p.get("done")]

# =========================================================
# 認証
# =========================================================
def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(minutes=JWT_EXPIRE),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "トークンが期限切れです")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "認証エラーです")

# =========================================================
# 認証エンドポイント
# =========================================================
@app.post("/api/auth/register")
async def register(request: Request):
    body = await request.json()
    username = body.get("username", "").strip()
    password = body.get("password", "")
    if not username or not password:
        raise HTTPException(400, "ユーザー名とパスワードを入力してください")
    data = load()
    if any(u["username"] == username for u in data["users"]):
        raise HTTPException(409, "このユーザー名はすでに使われています")
    user = {"id": f"U{int(datetime.now().timestamp())}", "username": username, "password": hash_password(password)}
    data["users"].append(user)
    save(data)
    return {"token": create_token(user["id"]), "username": username}

@app.post("/api/auth/login")
async def login(request: Request):
    body = await request.json()
    username = body.get("username", "").strip()
    password = body.get("password", "")
    data = load()
    user = next((u for u in data["users"] if u["username"] == username and u["password"] == hash_password(password)), None)
    if not user:
        raise HTTPException(401, "ユーザー名またはパスワードが違います")
    return {"token": create_token(user["id"]), "username": username}

# =========================================================
# 工事管理
# =========================================================
@app.get("/api/projects")
async def get_projects(user_id: str = Depends(verify_token)):
    data = load()
    return {"projects": [p for p in data["projects"] if p.get("owner") == user_id]}

@app.post("/api/projects")
async def create_project(request: Request, user_id: str = Depends(verify_token)):
    body    = await request.json()
    name    = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, "工事名を入力してください")
    data    = load()
    num     = body.get("num") or f"{datetime.now().year}-{len(data['projects'])+1:03d}"
    project = {
        "id":     f"P{int(datetime.now().timestamp())}",
        "name":   name,
        "num":    num,
        "start":  body.get("start", datetime.now().strftime("%Y-%m-%d")),
        "person": body.get("person", ""),
        "done":   False,
        "owner":  user_id,
    }
    data["projects"].append(project)
    save(data)
    return {"project": project}

@app.patch("/api/projects/{project_id}/done")
async def complete_project(project_id: str, user_id: str = Depends(verify_token)):
    data = load()
    for p in data["projects"]:
        if p["id"] == project_id and p.get("owner") == user_id:
            p["done"] = True
            save(data)
            return {"ok": True}
    raise HTTPException(404, "工事が見つかりません")

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str, user_id: str = Depends(verify_token)):
    data = load()
    before = len(data["projects"])
    data["projects"] = [p for p in data["projects"] if not (p["id"] == project_id and p.get("owner") == user_id)]
    if len(data["projects"]) == before:
        raise HTTPException(404, "工事が見つかりません")
    data["queue"] = [r for r in data["queue"] if r["project_id"] != project_id]
    save(data)
    return {"ok": True}

# =========================================================
# AI画像読み取り → キューへ追加
# =========================================================
@app.post("/api/records")
async def create_record(request: Request, user_id: str = Depends(verify_token)):
    body       = await request.json()
    project_id = body.get("project_id")
    category   = body.get("category")
    image_b64  = body.get("image_b64")  # base64エンコード済み画像

    if not all([project_id, category, image_b64]):
        raise HTTPException(400, "project_id・category・image_b64 は必須です")
    if category not in CATEGORIES:
        raise HTTPException(400, f"費目は {CATEGORIES} のいずれかを指定してください")

    data    = load()
    project = next((p for p in data["projects"] if p["id"] == project_id), None)
    if not project:
        raise HTTPException(404, "工事が見つかりません")

    # Claude APIで読み取り
    try:
        result = await ai_read(base64.b64decode(image_b64), category)
    except ValueError:
        raise HTTPException(422, "画像を読み取れませんでした。明るく・文字がはっきり写った写真で再度お試しください。")
    except Exception:
        raise HTTPException(500, "AI読み取り中にエラーが発生しました。時間をおいて再度お試しください。")

    # キューに追加
    record = {
        "id":           f"R{int(datetime.now().timestamp())}",
        "project_id":   project_id,
        "project_name": project["name"],
        "project_num":  project["num"],
        "category":     category,
        "ai_result":    result,
        "queued_at":    datetime.now().isoformat(),
        "done":         False,
    }
    data["queue"].append(record)
    save(data)
    return {"record": record, "ai_result": result}

# =========================================================
# Claude API 画像読み取り（高精度版：Opus + 2段階読み取り）
# =========================================================
async def ai_read(image_bytes: bytes, category: str, media_type: str = "image/jpeg") -> dict:
    client   = anthropic.Anthropic(api_key=CLAUDE_KEY)
    b64      = base64.standard_b64encode(image_bytes).decode()
    is_pdf   = media_type == "application/pdf"

    cat_hint = {
        "材料費": "建築・土木工事の材料購入レシート・納品書（セメント・木材・鉄筋・砂利・塗料・ボルト・釘など）",
        "人件費": "作業員・職人への賃金支払い領収書・作業日報（氏名・作業内容・日数・時間・単価など）",
        "外注費": "下請け業者・専門業者への支払い領収書（業者名・作業内容・工事名・金額）",
        "経費":   "工事に関わる交通費・高速代・駐車場代・消耗品・工具代・ガソリン代などの領収書・レシート",
        "不明":   "建築土木工事に関連する領収書・レシート・納品書・請求書",
    }.get(category, "建築土木工事に関連する領収書・レシート・納品書")

    system = """あなたは建築土木業の経理担当として20年以上の経験を持つ専門家です。
日本の手書き領収書・印刷レシート・納品書・請求書の読み取りに特化しています。

【絶対ルール】
- JSONのみを返す。前置き・説明・```などのコードブロック記号は一切不要
- 読み取れない項目はnullとし、絶対に推測で埋めない
- 金額はカンマ・円記号・¥を除いた整数で返す
- 日付は必ずYYYY-MM-DD形式（和暦→西暦変換必須）

【和暦変換表】
令和7年=2025年、令和6年=2024年、令和5年=2023年、令和4年=2022年
令和3年=2021年、令和2年=2020年、令和元年=2019年

【読み取りのコツ】
- 手書き数字：1と7、6と0、3と8は文脈・桁数から判断
- 金額は「合計」「小計」「税込」「御請求金額」欄を最優先
- 複数の金額欄がある場合は最も大きい「税込合計」を合計金額とする
- 明細が複数行ある場合は全行を抽出する
- 仕入先は書類の発行元（右上・左上のスタンプ・印刷部分）から読む"""

    prompt_1st = f"""【書類の種類】{cat_hint}

この画像を注意深く観察し、以下のJSON形式のみで返してください。

{{
  "日付": "YYYY-MM-DD または null",
  "費目": "{category}",
  "明細": [
    {{
      "品名_作業内容": "文字列 または null",
      "数量": 数値またはnull,
      "単位": "個・本・袋・m・m²・m³・式・人・日・時間 など または null",
      "単価": 数値またはnull,
      "金額": 数値またはnull
    }}
  ],
  "合計金額": 数値またはnull,
  "消費税": 数値またはnull,
  "仕入先_外注先": "店名・会社名・個人名 または null",
  "読み取り信頼度": "高 または 中 または 低",
  "不明瞭箇所": ["読み取りに自信がない項目名をリストで"],
  "備考": "特記事項 または null"
}}"""

    # 1回目の読み取り
    # PDF・画像どちらも対応
    if is_pdf:
        file_content = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
    else:
        file_content = {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}}

    msg1 = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=2000,
        system=system + ("\n- PDFの場合、全ページから情報を読み取り最初のページの書類を優先してください" if is_pdf else "\n- 画像が横向き・逆さでも正しい向きに補正して読み取ってください"),
        messages=[{
            "role": "user",
            "content": [
                file_content,
                {"type": "text", "text": prompt_1st},
            ],
        }],
    )
    raw1   = re.sub(r"```json|```", "", msg1.content[0].text).strip()
    result = json.loads(raw1)

    # 信頼度が低・中の場合は2回目の読み取りで補完
    confidence = result.get("読み取り信頼度", "高")
    unclear    = result.get("不明瞭箇所", [])

    if confidence in ["低", "中"] and unclear:
        unclear_str = "・".join(unclear)
        prompt_2nd = f"""この画像をもう一度注意深く見てください。
特に「{unclear_str}」の部分が不明瞭でした。

前回の読み取り結果：
{json.dumps(result, ensure_ascii=False, indent=2)}

上記の不明瞭だった箇所に集中して再確認し、より正確な値に修正したJSONのみを返してください。
確信が持てない場合はnullのままにしてください。"""

        msg2 = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=2000,
            system=system,
            messages=[
                {
                    "role": "user",
                    "content": [
                        file_content,
                        {"type": "text", "text": prompt_1st},
                    ],
                },
                {"role": "assistant", "content": raw1},
                {"role": "user",     "content": prompt_2nd},
            ],
        )
        raw2 = re.sub(r"```json|```", "", msg2.content[0].text).strip()
        try:
            result2 = json.loads(raw2)
            # 2回目で改善された項目のみ上書き
            for key in ["日付", "合計金額", "消費税", "仕入先_外注先"]:
                if result2.get(key) is not None and result.get(key) is None:
                    result[key] = result2[key]
            if result2.get("明細") and len(result2["明細"]) >= len(result.get("明細") or []):
                result["明細"] = result2["明細"]
            if result2.get("読み取り信頼度") == "高":
                result["読み取り信頼度"] = "高"
            result["備考"] = f"2段階読み取り実施。{result.get('備考') or ''}"
        except Exception as e2:
            # 2回目の解析失敗時は1回目の結果をそのまま使用
            import logging
            logging.warning(f"2段階目の読み取り解析失敗: {e2}")

    # 不明瞭箇所リストは返却不要
    result.pop("不明瞭箇所", None)

    if not result.get("明細") and result.get("合計金額") is None:
        raise ValueError("readable_failed")
    return result

# =========================================================
# PCエージェント向けAPI（認証不要・内部用）
# =========================================================
@app.get("/api/queue")
async def get_queue():
    data = load()
    # PCエージェント向け：全キューと全プロジェクトを返す（PCエージェントは認証なしでアクセス）
    return {"queue": [r for r in data["queue"] if not r["done"]], "projects": data["projects"]}

@app.post("/api/queue/done")
async def mark_queue_done(request: Request):
    body = await request.json()
    ids  = set(body.get("ids", []))
    data = load()
    for r in data["queue"]:
        if r["id"] in ids:
            r["done"] = True
    save(data)
    return {"ok": True}

@app.post("/api/projects/done")
async def mark_project_done_from_pc(request: Request):
    body = await request.json()
    pid  = body.get("project_id")
    data = load()
    for p in data["projects"]:
        if p["id"] == pid:
            p["done"] = True
    save(data)
    return {"ok": True}

@app.get("/")
async def health():
    return {"status": "ok", "version": "3.0"}

# =========================================================
# 手打ち入力 → キューへ追加
# =========================================================
@app.post("/api/records/manual")
async def create_manual_record(request: Request, user_id: str = Depends(verify_token)):
    body          = await request.json()
    project_id    = body.get("project_id")
    category      = body.get("category")
    manual_result = body.get("manual_result")

    if not all([project_id, category, manual_result]):
        raise HTTPException(400, "project_id・category・manual_result は必須です")
    if category not in CATEGORIES:
        raise HTTPException(400, f"費目は {CATEGORIES} のいずれかを指定してください")

    data    = load()
    project = next((p for p in data["projects"] if p["id"] == project_id), None)
    if not project:
        raise HTTPException(404, "工事が見つかりません")

    record = {
        "id":           f"R{int(datetime.now().timestamp())}",
        "project_id":   project_id,
        "project_name": project["name"],
        "project_num":  project["num"],
        "category":     category,
        "ai_result":    manual_result,
        "queued_at":    datetime.now().isoformat(),
        "done":         False,
    }
    data["queue"].append(record)
    save(data)
    return {"record": record}


# =========================================================
# 一時保管用：画像のみAI読み取りしてキューには入れない
# 新規工事の場合は project_id なしで project_name 等を渡すと自動登録
# =========================================================
@app.post("/api/records/temp")
async def read_temp_record(request: Request, user_id: str = Depends(verify_token)):
    body        = await request.json()
    project_id  = body.get("project_id")
    image_b64   = body.get("image_b64")
    project_name= body.get("project_name")
    project_num = body.get("project_num", "")
    project_start=body.get("project_start", datetime.now().strftime("%Y-%m-%d"))
    project_person=body.get("project_person", "")

    if not image_b64:
        raise HTTPException(400, "image_b64 は必須です")

    # メディアタイプ判定（PDF対応）
    media_type = body.get("media_type", "image/jpeg")
    is_pdf = media_type == "application/pdf"

    data = load()

    # project_idがない場合は新規登録
    if not project_id:
        if not project_name:
            raise HTTPException(400, "project_id または project_name が必要です")
        # 同名の工事が既にあれば再利用（同一ユーザーのみ）
        existing = next((p for p in data["projects"] if p["name"] == project_name and not p.get("done") and p.get("owner") == user_id), None)
        if existing:
            project_id = existing["id"]
            project = existing
        else:
            project_id = f"P{int(datetime.now().timestamp())}"
            num = project_num or f"{datetime.now().year}-{len(data['projects'])+1:03d}"
            project = {"id": project_id, "name": project_name, "num": num, "start": project_start, "person": project_person, "done": False, "owner": user_id}
            data["projects"].append(project)
            save(data)
    else:
        project = next((p for p in data["projects"] if p["id"] == project_id and p.get("owner") == user_id), None)
        if not project:
            raise HTTPException(404, "工事が見つかりません")

    try:
        result = await ai_read(base64.b64decode(image_b64), "不明", media_type=body.get("media_type", "image/jpeg"))
    except ValueError as e:
        raise HTTPException(422, detail={
            "message": "画像を読み取れませんでした。明るく・文字がはっきり写った写真で再度お試しください。",
            "error_type": "unreadable",
            "detail": str(e),
        })
    except json.JSONDecodeError as e:
        raise HTTPException(422, detail={
            "message": "AIの応答を解析できませんでした。再度お試しください。",
            "error_type": "json_parse_error",
            "detail": str(e),
        })
    except anthropic.APIError as e:
        raise HTTPException(502, detail={
            "message": f"Claude APIエラーが発生しました。しばらく待ってから再試行してください。",
            "error_type": "api_error",
            "detail": str(e),
        })
    except Exception as e:
        raise HTTPException(500, detail={
            "message": "AI読み取り中に予期しないエラーが発生しました。",
            "error_type": "unknown_error",
            "detail": str(e),
        })
    return {"ai_result": result, "project_id": project_id, "project": project}

# =========================================================
# 一時保管からエクスポート → Excelをブラウザにダウンロード
# =========================================================

def _border():
    s = Side(style="thin", color="CCCCCC")
    return Border(left=s, right=s, top=s, bottom=s)

def build_excel(project: dict, category: str, records: list) -> bytes:
    """Excelファイルをメモリ上で生成してバイトとして返す"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = category
    color = CAT_COLORS.get(category, "333333")

    # タイトル行
    ws.merge_cells("A1:I1")
    ws["A1"] = f"{project['name']}　{category}台帳"
    ws["A1"].font      = Font(name="游ゴシック", bold=True, size=13, color="FFFFFF")
    ws["A1"].fill      = PatternFill("solid", fgColor=color)
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28

    # 工事情報行
    ws["A2"] = f"工事番号：{project.get('num','')}　開始日：{project.get('start','')}"
    ws["A2"].font = Font(name="游ゴシック", size=10, color="666666")

    # ヘッダー行
    headers = ["日付","費目","品名・作業内容","数量","単位","単価","金額","仕入先・外注先","備考"]
    for col, h in enumerate(headers, 1):
        c = ws.cell(row=3, column=col, value=h)
        c.font      = Font(name="游ゴシック", bold=True, size=10, color="FFFFFF")
        c.fill      = PatternFill("solid", fgColor=color)
        c.alignment = Alignment(horizontal="center", vertical="center")
        c.border    = _border()
    ws.row_dimensions[3].height = 22

    # 列幅
    for i, w in enumerate([12, 10, 30, 8, 6, 10, 12, 20, 20], 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A4"

    # データ行
    row = 4
    for ai in records:
        items = ai.get("明細", []) or [{"品名_作業内容": "", "数量": None, "単位": None, "単価": None, "金額": ai.get("合計金額", 0)}]
        for item in items:
            row_data = [
                ai.get("日付", ""), category,
                item.get("品名_作業内容", ""),
                item.get("数量"), item.get("単位"), item.get("単価"),
                item.get("金額") or 0,
                ai.get("仕入先_外注先", ""), ai.get("備考", ""),
            ]
            for col, val in enumerate(row_data, 1):
                c = ws.cell(row=row, column=col, value=val)
                c.font   = Font(name="游ゴシック", size=10)
                c.border = _border()
                if col == 7 and val:
                    c.number_format = "#,##0"
            row += 1

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()

@app.post("/api/records/export")
async def export_records(request: Request, user_id: str = Depends(verify_token)):
    body       = await request.json()
    project_id = body.get("project_id")
    category   = body.get("category")
    records    = body.get("records", [])

    if not all([project_id, category]) or not records:
        raise HTTPException(400, "project_id・category・records は必須です")
    if category not in CATEGORIES:
        raise HTTPException(400, f"費目は {CATEGORIES} のいずれかを指定してください")

    data    = load()
    project = next((p for p in data["projects"] if p["id"] == project_id and p.get("owner") == user_id), None)
    if not project:
        raise HTTPException(404, "工事が見つかりません")

    # Excelを生成してbase64で返す
    excel_bytes = build_excel(project, category, records)
    excel_b64   = base64.b64encode(excel_bytes).decode()
    safe_name   = project["name"].replace("/", "／")
    timestamp   = datetime.now().strftime("%Y%m%d_%H%M")
    filename    = f"{safe_name}_{category}_{timestamp}.xlsx"

    return {"ok": True, "excel_b64": excel_b64, "filename": filename}


