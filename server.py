import http.server
import socketserver
import json
import os
import sys

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
API_DIR = os.path.join(BASE_DIR, 'api')

class DevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-admin-key')
        self.end_headers()

    def do_POST(self):
        path = self.path.split('?')[0].rstrip('/')
        if path in ('/api/banners', '/api/settings'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(body) if body else {}
                os.makedirs(DATA_DIR, exist_ok=True)
                os.makedirs(API_DIR, exist_ok=True)

                if path == '/api/banners':
                    # Save banners.json and api/banners
                    with open(os.path.join(DATA_DIR, 'banners.json'), 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)
                    with open(os.path.join(API_DIR, 'banners'), 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)

                    # Also save settings
                    settings = {
                        "bannersPublished": data.get("bannersPublished", False),
                        "whatsappNumber": data.get("whatsappNumber", "8801762050353")
                    }
                    with open(os.path.join(DATA_DIR, 'settings.json'), 'w', encoding='utf-8') as f:
                        json.dump(settings, f, indent=2, ensure_ascii=False)
                    with open(os.path.join(API_DIR, 'settings'), 'w', encoding='utf-8') as f:
                        json.dump(settings, f, indent=2, ensure_ascii=False)

                elif path == '/api/settings':
                    # Save settings.json and api/settings
                    current = {}
                    try:
                        with open(os.path.join(DATA_DIR, 'settings.json'), 'r', encoding='utf-8') as f:
                            current = json.load(f)
                    except Exception:
                        pass
                    current.update(data)
                    with open(os.path.join(DATA_DIR, 'settings.json'), 'w', encoding='utf-8') as f:
                        json.dump(current, f, indent=2, ensure_ascii=False)
                    with open(os.path.join(API_DIR, 'settings'), 'w', encoding='utf-8') as f:
                        json.dump(current, f, indent=2, ensure_ascii=False)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
                return
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                return

        return super().do_POST()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    with socketserver.TCPServer(("", port), DevHandler) as httpd:
        print(f"Development server running at http://localhost:{port}/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
