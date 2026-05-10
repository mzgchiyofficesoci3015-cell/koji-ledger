"""
工事台帳 サーバー v3
- LINEなし・Webアプリ専用
- JWT認証（ID/パスワード）
- Claude APIで画像読み取り
- PCエージェント向けキューAPI
"""
import os, json, base64, re, hashlib, secrets
from pathlib import Path
from datetime import datetime, timedelta

import anthropic
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

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
    return {"projects": data["projects"]}

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
    }
    data["projects"].append(project)
    save(data)
    return {"project": project}

@app.patch("/api/projects/{project_id}/done")
async def complete_project(project_id: str, user_id: str = Depends(verify_token)):
    data = load()
    for p in data["projects"]:
        if p["id"] == project_id:
            p["done"] = True
            save(data)
            return {"ok": True}
    raise HTTPException(404, "工事が見つかりません")

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str, user_id: str = Depends(verify_token)):
    data = load()
    before = len(data["projects"])
    data["projects"] = [p for p in data["projects"] if p["id"] != project_id]
    if len(data["projects"]) == before:
        raise HTTPException(404, "工事が見つかりません")
    # 関連キューも削除
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
# Claude API 画像読み取り
# =========================================================
async def ai_read(image_bytes: bytes, category: str) -> dict:
    client = anthropic.Anthropic(api_key=CLAUDE_KEY)
    b64    = base64.standard_b64encode(image_bytes).decode()
    prompt = f"""この画像（{category}の書類）から情報を読み取り、以下のJSON形式のみで返してください。
{{
  "日付": "YYYY-MM-DD または null",
  "費目": "{category}",
  "明細": [{{"品名_作業内容": "文字列", "数量": 数値またはnull, "単位": "文字列またはnull", "単価": 数値またはnull, "金額": 数値}}],
  "合計金額": 数値またはnull,
  "仕入先_外注先": "文字列またはnull",
  "読み取り信頼度": "高 または 中 または 低",
  "備考": "文字列またはnull"
}}"""
    msg = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system="建築土木業の工事台帳担当。手書き領収書・レシートの画像をJSON形式のみで返す。余分な説明不要。",
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
                {"type": "text", "text": prompt},
            ],
        }],
    )
    raw    = re.sub(r"```json|```", "", msg.content[0].text).strip()
    result = json.loads(raw)
    if not result.get("明細") and result.get("合計金額") is None:
        raise ValueError("readable_failed")
    return result

# =========================================================
# PCエージェント向けAPI（認証不要・内部用）
# =========================================================
@app.get("/api/queue")
async def get_queue():
    data = load()
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
# =========================================================
@app.post("/api/records/temp")
async def read_temp_record(request: Request, user_id: str = Depends(verify_token)):
    body      = await request.json()
    project_id = body.get("project_id")
    image_b64  = body.get("image_b64")
    if not all([project_id, image_b64]):
        raise HTTPException(400, "project_id・image_b64 は必須です")
    data = load()
    project = next((p for p in data["projects"] if p["id"] == project_id), None)
    if not project:
        raise HTTPException(404, "工事が見つかりません")
    try:
        result = await ai_read(base64.b64decode(image_b64), "不明")
    except ValueError:
        raise HTTPException(422, "画像を読み取れませんでした。明るく・文字がはっきり写った写真で再度お試しください。")
    except Exception:
        raise HTTPException(500, "AI読み取り中にエラーが発生しました。")
    return {"ai_result": result}

# =========================================================
# 一時保管からエクスポート（費目を指定してキューへ）
# =========================================================
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
    project = next((p for p in data["projects"] if p["id"] == project_id), None)
    if not project:
        raise HTTPException(404, "工事が見つかりません")
    for i, ai_result in enumerate(records):
        ai_result["費目"] = category
        record = {
            "id":           f"R{int(datetime.now().timestamp())}{i}",
            "project_id":   project_id,
            "project_name": project["name"],
            "project_num":  project["num"],
            "category":     category,
            "ai_result":    ai_result,
            "queued_at":    datetime.now().isoformat(),
            "done":         False,
        }
        data["queue"].append(record)
    save(data)
    return {"ok": True, "queued": len(records)}
