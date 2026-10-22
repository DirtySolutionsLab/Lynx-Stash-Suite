"""Stash standard performer scraper: JSON stdin -> JSON stdout."""
import json
import os
import sys
from xlgirls_client import Client, native_fragment


def main():
    payload = json.load(sys.stdin)
    client = Client(verification=os.environ.get('LYNX_XLGIRLS_VERIFICATION', '1') != '0')
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    if mode == 'query':
        response = client.search(payload.get('name', ''))
        if response['warning']:
            print(response['warning'], file=sys.stderr)
        return response['results']
    if mode == 'profile':
        url = payload.get('url') or next(iter(payload.get('urls') or []), '')
        profile = client.profile(url)
        for warning in profile['warnings']:
            print(warning, file=sys.stderr)
        return native_fragment(profile)
    raise ValueError('Unknown scraper mode.')


if __name__ == '__main__':
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    try:
        print(json.dumps(main(), ensure_ascii=False))
    except Exception as error:
        print(str(error), file=sys.stderr)
        # Keep stdout valid JSON even on failure, rather than triggering EOF
        # while Stash decodes the result. Retain a nonzero failure exit code.
        print(json.dumps([] if len(sys.argv) > 1 and sys.argv[1] == 'query' else {}))
        sys.exit(1)
