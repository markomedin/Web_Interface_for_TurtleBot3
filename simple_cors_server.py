#!/usr/bin/env python3
# encoding: utf-8

# Kod u ovom pomoćnom .py fajlu preuzet je sa sledećeg linka: https://gist.github.com/acdha/925e9ffc3d74ad59c3ea
# Namena ovog .py fajla jeste da obezbedi pokretanje lokalnog servera gde je smešten 3D model robota, a sa ciljem pristupa 3D modelu od strane veb aplikacije.

"""Use instead of `python3 -m http.server` when you need CORS"""

from http.server import HTTPServer, SimpleHTTPRequestHandler


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        return super(CORSRequestHandler, self).end_headers()


httpd = HTTPServer(('192.168.1.227', 8000), CORSRequestHandler)
httpd.serve_forever()
