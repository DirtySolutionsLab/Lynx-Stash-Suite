"""Interactive operations; only explicit import changes one chosen performer."""
import json
import re
import sys
import urllib.request
from xlgirls_client import Client
from xlgirls_core import profile_url


PLUGIN_ID = 'LynxXLGirls'
NATIVE = ('name', 'hair_color', 'eye_color', 'ethnicity', 'height_cm', 'weight', 'measurements', 'birthdate')
KEYS = NATIVE + ('body_type', 'bra_size', 'image')


class API:
    def __init__(self, connection, timeout=30):
        self.timeout = timeout
        host = connection.get('Host') or 'localhost'
        if host in ('0.0.0.0', '::'):
            host = 'localhost'
        if ':' in host and not host.startswith('['):
            host = '[' + host + ']'
        self.url = f"{connection.get('Scheme', 'http')}://{host}:{connection.get('Port', 9999)}/graphql"
        self.headers = {'Content-Type': 'application/json'}
        cookie = connection.get('SessionCookie')
        if cookie and cookie.get('Name') and cookie.get('Value'):
            self.headers['Cookie'] = cookie['Name'] + '=' + cookie['Value']
        if connection.get('ApiKey'):
            self.headers['ApiKey'] = connection['ApiKey']

    def gql(self, query, variables=None):
        request = urllib.request.Request(self.url, data=json.dumps({'query': query, 'variables': variables or {}}).encode(), headers=self.headers)
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            data = json.load(response)
        if data.get('errors'):
            raise ValueError('; '.join(e['message'] for e in data['errors']))
        return data['data']

    def performer(self, identifier):
        result = self.gql('query($id:ID!){findPerformer(id:$id){id name hair_color eye_color ethnicity height_cm weight measurements birthdate urls custom_fields image_path updated_at}}', {'id': identifier})['findPerformer']
        if not result:
            raise ValueError('The performer no longer exists in Stash.')
        return result


def settings_from(config):
    own = config.get(PLUGIN_ID) or {}
    attributes = config.get('LynxPerformerAttributeTags') or {}
    body = (own.get('bodyField') or attributes.get('bodyField') or 'Body Type').strip()
    bra = (own.get('braField') or 'Bra Size').strip()
    if not body or not bra or body == bra or max(len(body), len(bra)) > 100:
        raise ValueError('Body Type and Bra Size need different field names of 1–100 characters.')
    return {'body_type': body, 'bra_size': bra}, own.get('verification') is not False


def values_of(performer, custom_names):
    values = {key: performer.get(key) for key in NATIVE}
    custom = performer.get('custom_fields') or {}
    values.update({key: custom.get(name) for key, name in custom_names.items()})
    values['image'] = {'path': performer.get('image_path'), 'updated_at': performer.get('updated_at')}
    return values


def import_input(identifier, chosen, expected, source_expected, current, profile, custom_names):
    if not isinstance(chosen, list) or not chosen or any(not isinstance(k, str) or k not in KEYS for k in chosen) or len(chosen) != len(set(chosen)):
        raise ValueError('Select at least one available field. No other fields may be updated.')
    source = {**profile['fields'], **profile['custom']}
    existing = values_of(current, custom_names)
    update, partial = {'id': identifier}, {}
    for key in chosen:
        if key == 'image':
            picture = profile.get('image')
            if not picture or not picture.get('data_uri'):
                raise ValueError('Profile image is missing or could not be fetched. Preview again.')
            token = {'url': picture['url'], 'sha256': picture['sha256']}
            if expected.get('image') != existing['image'] or source_expected.get('image') != token:
                raise ValueError('The image or performer changed since the preview. Preview again.')
            update['image'] = picture['data_uri']  # Replace the native profile image, not supporting/gallery images.
            continue
        if key not in source or source[key] in (None, ''):
            raise ValueError('A selected field is missing from XL Girls. Preview again.')
        if key not in expected or existing[key] != expected[key]:
            raise ValueError('Performer information changed since the preview. Preview again.')
        if key not in source_expected or source[key] != source_expected[key]:
            raise ValueError('XL Girls data changed. Preview again before saving.')
        if existing[key] == source[key]:
            continue
        if key in custom_names:
            partial[custom_names[key]] = source[key]
        else:
            update[key] = source[key]
    if partial:
        update['custom_fields'] = {'partial': partial}
    if profile['url'] not in (current.get('urls') or []):
        update['urls'] = [*(current.get('urls') or []), profile['url']]
    return update


def public_profiles(urls):
    result = set()
    for url in urls if isinstance(urls, list) else []:
        if not isinstance(url, str):
            continue
        try:
            result.add(profile_url(url))
        except ValueError:
            continue
    return result


def bra_hook(payload, api=None, client=None):
    """Complete a saved URL-bearing import, never a scrape preview or tag edit."""
    hook = (payload.get('args') or {}).get('hookContext') or {}
    kind = hook.get('type')
    if kind not in ('Performer.Create.Post', 'Performer.Update.Post'):
        return {'skipped': 'Invalid hook type.'}
    # A scrape may save only changed metadata, not an already-stored URL.
    # Own custom-field writes and tag updates still return before any API work.
    relevant = {'urls', 'url', 'name', 'hair_color', 'eye_color', 'ethnicity',
                'height_cm', 'weight', 'measurements', 'birthdate', 'image'}
    fields = set(hook.get('inputFields') or [])
    if kind == 'Performer.Update.Post' and not fields.intersection(relevant):
        return {'skipped': 'No relevant metadata change.'}
    identifier = str(hook.get('id', ''))
    if not re.fullmatch(r'[1-9]\d*', identifier):
        return {'skipped': 'Invalid performer ID.'}
    original_input = hook.get('input') or {}
    explicit_urls = 'urls' in fields or kind == 'Performer.Create.Post' and original_input.get('urls') is not None
    incoming = original_input.get('urls') if explicit_urls else None
    # Older scraper/update flows can still supply the singular URL field.
    if not explicit_urls and ('url' in fields or kind == 'Performer.Create.Post') and original_input.get('url'):
        incoming = [original_input['url']]
    if incoming is not None and len(public_profiles(incoming)) != 1:
        return {'skipped': 'No unique XL Girls profile in the URL import.'}
    api = api or API(payload['server_connection'], timeout=10)
    config = api.gql('{configuration{plugins}}')['configuration']['plugins'] or {}
    own = config.get(PLUGIN_ID) or {}
    if own.get('automaticBraSize') is not True:
        return {'skipped': 'Automatic bra size disabled.'}
    custom_names, verification = settings_from(config)
    current = api.performer(identifier)
    profiles = public_profiles(incoming if incoming is not None else current.get('urls'))
    if len(profiles) != 1:
        return {'skipped': 'No unique XL Girls profile on the performer.'}
    url = next(iter(profiles))
    if url not in public_profiles(current.get('urls')):
        return {'skipped': 'The profile URL is no longer attached to the performer.'}
    custom = current.get('custom_fields') or {}
    name = custom_names['bra_size']
    key = next((k for k in custom if k.strip().casefold() == name.casefold()), name)
    previous = custom.get(key)
    if str(previous or '').strip() and own.get('replaceBraSize') is not True:
        return {'skipped': 'Existing bra size preserved.'}
    client = client or Client(verification=verification)
    profile = client.profile(url)
    bra = (profile.get('custom') or {}).get('bra_size')
    if not isinstance(bra, str) or not bra.strip():
        return {'skipped': 'XL Girls has no bra size; existing values are preserved.'}
    if bra == previous:
        return {'skipped': 'Bra size is already identical.'}
    # Re-check after the external request, before a partial custom-field merge.
    latest = api.performer(identifier)
    latest_custom = latest.get('custom_fields') or {}
    latest_key = next((k for k in latest_custom if k.strip().casefold() == name.casefold()), name)
    if latest_key != key or latest_custom.get(key) != previous or url not in public_profiles(latest.get('urls')):
        return {'skipped': 'The performer changed during the request; no overwrite.'}
    api.gql('mutation($input:PerformerUpdateInput!){performerUpdate(input:$input){id}}',
            {'input': {'id': identifier, 'custom_fields': {'partial': {key: bra}}}})
    print('\x01i\x02Bra size %s saved for performer #%s from XL Girls.' % (bra, identifier), file=sys.stderr)
    return {'saved': True, 'performer_id': identifier, 'bra_size': bra}


def operation(payload, api=None, client=None):
    args = payload.get('args') or {}
    if args.get('hookContext'):
        try:
            return bra_hook(payload, api, client)
        except Exception as error:
            # Metadata has already committed. A source failure must not turn a
            # successful performer save into a failed import or clear old values.
            print('\x01w\x02Automatic bra size could not be loaded: ' + str(error), file=sys.stderr)
            return {'warning': str(error), 'saved': False}
    mode = args.get('mode')
    if mode not in ('search', 'preview', 'import', 'batch_preview', 'batch_import'):
        raise ValueError('Unknown operation mode.')
    api = api or API(payload['server_connection'])
    config = api.gql('{configuration{plugins}}')['configuration']['plugins'] or {}
    custom_names, verification = settings_from(config)
    client = client or Client(verification=verification)
    if mode == 'search':
        return client.search(args.get('name', ''))
    identifier = str(args.get('performer_id', ''))
    if not re.fullmatch(r'[1-9]\d*', identifier):
        raise ValueError('An exact performer ID is required.')
    current = None
    resolution = None
    if mode in ('batch_preview', 'batch_import'):
        current = api.performer(identifier)
        profiles = public_profiles(current.get('urls'))
        if len(profiles) > 1:
            return {'skipped': 'Multiple saved XL Girls profiles. Choose the correct profile manually.',
                    'performer_id': identifier, 'performer_name': current['name']}
        if profiles:
            url = next(iter(profiles))
        else:
            # Canonical Stash name, never the decorated card title/disambiguation.
            name = str(current.get('name') or '').strip()
            resolution = {'name': name}
            if mode == 'batch_import' and args.get('resolution') != resolution:
                raise ValueError('The name or search context changed. Preview again.')
            found = client.search(name)
            exact = public_profiles([p.get('url') for p in found.get('results', [])
                                     if ' '.join(str(p.get('name', '')).split()).casefold()
                                     == ' '.join(name.split()).casefold()])
            if found.get('warning') or len(exact) != 1:
                return {'skipped': 'Name search without disambiguation did not return one reliable exact match. Enter the XL Girls profile URL manually.',
                        'performer_id': identifier, 'performer_name': name}
            url = next(iter(exact))
        if mode == 'batch_import' and args.get('url') != url:
            raise ValueError('The profile URL changed after the preview. Preview again.')
    else:
        url = args.get('url', '')
    profile = client.profile(url)
    if resolution and ' '.join(str(profile['fields'].get('name', '')).split()).casefold() != ' '.join(resolution['name'].split()).casefold():
        raise ValueError('The profile name does not match the search name. Choose a profile manually.')
    wants_preview_image = mode == 'preview' or mode == 'batch_preview' and args.get('include_image') is True
    if wants_preview_image or 'image' in (args.get('fields') or []):
        if profile.get('image_url'):
            try:
                profile['image'] = client.image(profile['image_url'])
            except ValueError as error:
                if mode in ('import', 'batch_import'):
                    raise
                profile['warnings'].append(str(error) + ' Other fields can still be imported.')
        elif wants_preview_image:
            profile['warnings'].append('No public profile image for the correct model ID was identified. Other fields can still be imported.')
    current = api.performer(identifier)
    if mode in ('batch_preview', 'batch_import'):
        if public_profiles(current.get('urls')) != profiles:
            raise ValueError('The profile URL changed during the request. Preview again.')
        if resolution and str(current.get('name') or '').strip() != resolution['name']:
            raise ValueError('The name changed during the request. Preview again.')
    if mode in ('preview', 'batch_preview'):
        return {'performer_id': identifier, 'performer_name': current['name'], 'profile': profile,
                'current': values_of(current, custom_names), 'custom_names': custom_names,
                'resolution': resolution}
    if args.get('custom_names') != custom_names:
        raise ValueError('Field names changed in the settings. Preview again.')
    update = import_input(identifier, args.get('fields'), args.get('expected') or {},
                          args.get('source_expected') or {}, current, profile, custom_names)
    if len(update) == 1:
        return {'saved': True, 'changed': False, 'performer_id': identifier}
    api.gql('mutation($input:PerformerUpdateInput!){performerUpdate(input:$input){id}}', {'input': update})
    return {'saved': True, 'changed': True, 'performer_id': identifier}



import sys as _lynx_sys
from pathlib import Path as _LynxPath
_lynx_sys.path.insert(0,str(_LynxPath(__file__).resolve().parents[2]))
from backend_adapter import adapt_api as _lynx_adapt
_lynx_adapt(API)

if __name__ == '__main__':
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    try:
        print(json.dumps({'output': operation(json.load(sys.stdin))}, ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False))
        sys.exit(1)
