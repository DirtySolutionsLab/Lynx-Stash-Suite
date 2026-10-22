"""Built-in conservative URL cleanup; no inference from unknown domains."""
from urllib.parse import urlsplit, parse_qsl

SOCIAL_ROOTS = frozenset({
    'instagram.com', 'x.com', 'twitter.com', 'facebook.com', 'tiktok.com',
    'onlyfans.com', 'fansly.com', 'patreon.com', 'youtube.com', 'twitch.tv',
    'threads.net', 'threads.com', 'bsky.app', 'snapchat.com', 'linktr.ee',
})


def disposable_url(value):
    if value is None:
        return True
    if not isinstance(value, str):
        return False
    text = value.strip()
    if not text:
        return True
    try:
        parsed = urlsplit(text if '://' in text or text.startswith('//') else 'https://' + text)
        if parsed.scheme and parsed.scheme.lower() not in {'http', 'https'}:
            return False
        host = (parsed.hostname or '').lower()
        if host.startswith('www.'):
            host = host[4:]
        # Preserve unexpected credentials/ports/queries rather than guess.
        if host not in SOCIAL_ROOTS or parsed.username or parsed.password or parsed.port is not None:
            return False
        if parsed.path not in ('', '/'):
            return False
        if parsed.fragment:
            return False
        query = parse_qsl(parsed.query, keep_blank_values=True)
        if parsed.query and not query:
            return False
        return all(key.lower().startswith('utm_') or key.lower() in {'fbclid', 'igsh', 'ref_src'}
                   for key, _ in query)
    except (ValueError, TypeError):
        return False


def clean_urls(values):
    if not isinstance(values, (list, tuple)):
        return values
    # Do not rewrite or deduplicate retained links, including their query data.
    return [value for value in values if not disposable_url(value)]
