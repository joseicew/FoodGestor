#!/usr/bin/env python
# -*- coding: utf-8 -*-

try:
    from app import create_app
    app = create_app()

    # Verificar rutas OCR
    ocr_routes = []
    for rule in app.url_map.iter_rules():
        if 'ocr' in rule.rule:
            ocr_routes.append(f"{rule.methods} {rule.rule}")

    if ocr_routes:
        print("OCR Routes found:")
        for r in sorted(ocr_routes):
            print(f"  {r}")
    else:
        print("NO OCR routes found!")
        print("\nAll registered routes:")
        for rule in app.url_map.iter_rules():
            if not rule.rule.startswith('/static'):
                print(f"  {rule.methods} {rule.rule}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
