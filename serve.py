"""Local server for testing the Word Inferences experiment.

Run from the experiment/ folder:
    python3 serve.py
then open http://127.0.0.1:8000/

Same as `python3 -m http.server`, except the browser is told never to cache
files, so edits always show up on reload. Data is NOT saved here: it goes to
DataPipe -> Zenodo (see js/datapipe.js).
"""

import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
HERE = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def end_headers(self):
        # Always serve the latest files (avoids the browser running stale code).
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Experiment running at http://127.0.0.1:{PORT}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
