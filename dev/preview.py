"""로컬 미리보기 서버 (Supabase 없이 가짜 데이터로 화면 확인용).

    python dev/preview.py        →  http://localhost:8765

web/ 파일을 그대로 보여 주되, index.html 의 supabase-js 스크립트를
dev/mock.js(가짜 로그인·가짜 물건 목록)로 바꿔서 내보내요.
실제 데이터에는 접근하지 않아요. web/ 은 고치지 않아요.
"""
import http.server
import pathlib
import re
import socketserver
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
MOCK = ROOT / "dev" / "mock.js"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(WEB), **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _send(self, body, ctype):
        data = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            html = (WEB / "index.html").read_text(encoding="utf-8")
            html = re.sub(r'<script src="[^"]*supabase-js[^"]*"></script>',
                          '<script src="mock.js"></script>', html)
            return self._send(html, "text/html; charset=utf-8")
        if path == "/mock.js":
            return self._send(MOCK.read_text(encoding="utf-8"), "application/javascript; charset=utf-8")
        return super().do_GET()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"미리보기: http://localhost:{PORT}  (Ctrl+C 로 종료)")
    httpd.serve_forever()
