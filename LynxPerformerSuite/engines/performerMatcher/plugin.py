"""Reviewed batch performer assignment for Images and Galleries."""
import contextlib
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys
import time
import uuid
from api import API
from matching import Index, valid_name

ROOT = Path(__file__).resolve().parent
PAGE = 100
MAX_ITEMS = 10000


def dump(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def fingerprint(item):
    fields = {key:item.get(key) for key in ('kind','id','title','source_paths','galleries')}
    return hashlib.sha256(dump(fields).encode()).hexdigest()


def bridge_enabled(settings):
    own = settings.get('LynxPerformerSuite') or {}
    return own.get('links_enabled') is True and own.get('links__automatic') is True


def and_filter(left, right):
    return {'AND':left, **right} if left else right


class Store:
    def __init__(self, path):
        self.db = sqlite3.connect(path, timeout=5)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, created REAL, data TEXT);
        CREATE TABLE IF NOT EXISTS items(token TEXT, key TEXT, data TEXT, PRIMARY KEY(token,key));
        CREATE TABLE IF NOT EXISTS audit(token TEXT, at REAL, data TEXT);
        ''')
        expired = [r[0] for r in self.db.execute('SELECT token FROM sessions WHERE created<?',(time.time()-7*86400,))]
        for token in expired:
            for table in ('sessions','items','audit'):
                self.db.execute('DELETE FROM '+table+' WHERE token=?',(token,))
        self.db.commit()

    def new(self, data):
        token = uuid.uuid4().hex
        self.db.execute('INSERT INTO sessions VALUES(?,?,?)',(token,time.time(),dump(data))); self.db.commit()
        return token

    def session(self, token):
        if not isinstance(token,str) or not re.fullmatch('[a-f0-9]{32}',token): raise ValueError('Invalid preview session.')
        row = self.db.execute('SELECT data FROM sessions WHERE token=?',(token,)).fetchone()
        if not row: raise ValueError('Preview expired. Scan again.')
        return json.loads(row[0])

    def save(self, token, data):
        self.db.execute('UPDATE sessions SET data=? WHERE token=?',(dump(data),token)); self.db.commit()

    def put(self, token, item):
        cursor = self.db.execute('INSERT OR IGNORE INTO items VALUES(?,?,?)',(token,item['key'],dump(item)))
        self.db.commit()
        return cursor.rowcount == 1

    def get(self, token, key):
        row = self.db.execute('SELECT data FROM items WHERE token=? AND key=?',(token,key)).fetchone()
        if not row: raise ValueError('An item was not part of this preview. Scan again.')
        return json.loads(row[0])

    def log(self, token, data):
        self.db.execute('INSERT INTO audit VALUES(?,?,?)',(token,time.time(),dump(data))); self.db.commit()

    def close(self): self.db.close()


@contextlib.contextmanager
def import_lock(path):
    with open(path,'a+b') as handle:
        handle.seek(0,2)
        if not handle.tell(): handle.write(b'0'); handle.flush()
        handle.seek(0)
        try:
            if sys.platform == 'win32':
                import msvcrt
                msvcrt.locking(handle.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError as error:
            raise ValueError('Another Matcher import is running. Wait for it to finish.') from error
        try: yield
        finally:
            handle.seek(0)
            if sys.platform == 'win32': msvcrt.locking(handle.fileno(),msvcrt.LK_UNLCK,1)
            else: fcntl.flock(handle,fcntl.LOCK_UN)


def validate_scope(args):
    kind = args.get('kind')
    if kind not in ('Image','Gallery'): raise ValueError('Choose Images or Galleries.')
    scope = args.get('scope') or {}
    if scope.get('mode') not in ('ids','filter'): raise ValueError('Choose an explicit selection or filter.')
    if scope['mode'] == 'ids':
        ids = scope.get('ids')
        if not isinstance(ids,list) or not 1 <= len(ids) <= MAX_ITEMS or any(not re.fullmatch(r'[1-9]\d*',str(i)) for i in ids):
            raise ValueError('Select 1–10,000 explicit items.')
        scope = {'mode':'ids','ids':list(dict.fromkeys(map(str,ids)))}
    else:
        criteria = scope.get('criteria')
        if not isinstance(criteria,dict) or len(dump(criteria)) > 64000: raise ValueError('A valid captured Stash filter is required.')
        search = scope.get('search') or ''
        if not isinstance(search,str) or len(search)>2000: raise ValueError('Invalid search term.')
        scope = {'mode':'filter','criteria':criteria,'search':search}
    limit = args.get('limit',2000)
    if not isinstance(limit,int) or isinstance(limit,bool) or not 1 <= limit <= MAX_ITEMS: raise ValueError('Scan limit must be 1–10,000.')
    return {'kind':kind,'scope':scope,'only_missing':args.get('only_missing',True) is True,
            'children':kind=='Gallery' and args.get('children') is True,'limit':limit,'cursor':0,'scanned':0,'done':False}


def scan(api, store, token):
    session = store.session(token)
    if session['done']: return {'items':[],'done':True,'scanned':session['scanned'],'total':session.get('total',0)}
    kind, scope = session['kind'], session['scope']
    page_size = 10 if session['children'] else PAGE
    cursor = session['cursor']
    if scope['mode'] == 'ids':
        ids = scope['ids'][cursor:cursor+page_size]
        total = len(scope['ids'])
        items = api.get_many(kind,ids)
    else:
        criteria = scope['criteria']
        if session['only_missing']: criteria = and_filter(criteria,{'performer_count':{'value':0,'modifier':'EQUALS'}})
        total,items = api.page(kind,criteria,scope['search'],cursor//page_size+1,page_size)
    index = Index(session['people'])
    result = []
    session.setdefault('reviewed',0)
    for item in items:
        if session['scanned'] >= session['limit'] or session['reviewed'] >= MAX_ITEMS: break
        session['scanned'] += 1
        if session['only_missing'] and item['performers']: continue
        item['proposal'] = index.propose(item)
        if store.put(token,item):
            result.append(item)
            session['reviewed'] += 1
        if session['children']:
            count, children = api.page('Image',{'galleries':{'value':[item['id']],'modifier':'INCLUDES'},
                                                'performer_count':{'value':0,'modifier':'EQUALS'}},'',1,1001)
            if count > 1000:
                item['child_warning'] = 'More than 1,000 unassigned images. Use the Images list filtered to this gallery to review them.'
                continue
            for child in children:
                if session['reviewed'] >= MAX_ITEMS:
                    item['child_warning'] = 'The 10,000-item review limit was reached. Narrow the scope to review the remaining images.'
                    break
                child['proposal'] = {**item['proposal'],'reason':'From selected gallery: '+(item['title'] or item['id'])}
                if len(child.get('galleries') or []) > 1:
                    child['proposal'] = {**child['proposal'], 'status':'review',
                        'reason':'This image belongs to multiple galleries. Choose its performer explicitly.'}
                child['inherited_from'] = item['id']
                if store.put(token,child):
                    result.append(child)
                    session['reviewed'] += 1
    session['cursor'] += page_size
    session['total'] = total
    session['done'] = session['cursor'] >= total or session['scanned'] >= session['limit'] or session['reviewed'] >= MAX_ITEMS or not items
    store.save(token,session)
    return {'items':result,'scanned':session['scanned'],'total':total,'done':session['done'],
            'limited':session['done'] and (session['scanned'] < total or session['reviewed'] >= MAX_ITEMS)}


def apply(api,store,token,args):
    session = store.session(token)
    keys = args.get('keys')
    if not isinstance(keys,list) or not 1 <= len(keys) <= 100 or len(keys)!=len(set(keys)):
        raise ValueError('Select 1–100 previewed items per request.')
    target = args.get('target') or {}
    if set(target) not in ({'id'},{'create'}): raise ValueError('Choose one existing performer or explicitly create one.')
    if 'create' in target and (not isinstance(target['create'],str) or not valid_name(target['create'])):
        raise ValueError('Enter a valid performer name, not a filename or folder path.')
    originals = [store.get(token,key) for key in keys]
    current = {}
    for kind in ('Image','Gallery'):
        rows = api.get_many(kind,[x['id'] for x in originals if x['kind']==kind])
        current.update({i['key']:i for i in rows})
    results = []; valid = []
    for old in originals:
        fresh = current.get(old['key'])
        if not fresh or fingerprint(old)!=fingerprint(fresh):
            results.append({'key':old['key'],'status':'skipped','message':'Source changed or item removed; preview again.'})
        elif (session['only_missing'] or old.get('inherited_from')) and fresh['performers']:
            results.append({'key':old['key'],'status':'skipped','message':'Already has a performer; preserved.'})
        else: valid.append(fresh)
    if not valid: return {'results':results,'created':None}
    created = None
    if 'id' in target:
        if not re.fullmatch(r'[1-9]\d*',str(target['id'])): raise ValueError('Choose a valid performer ID.')
        person = api.person(str(target['id']))
        if not person: raise ValueError('The selected performer no longer exists.')
    else:
        index = Index(api.people())
        name = str(target['create']).strip()
        matches = index.exact(name)
        if len(matches)>1: raise ValueError('This name or alias now matches several performers. Select the correct existing performer.')
        if matches: person = matches[0]
        else:
            # Record intention before the API call; an interrupted create is never blindly retried.
            store.log(token,{'action':'create_requested','name':name})
            try: person = api.create(name)
            except Exception as error:
                raise ValueError('Performer creation could not be confirmed. Search the library before retrying: '+str(error)) from error
            created = person
            store.log(token,{'action':'created','performer':person})
    identifier = str(person['id'])
    for kind in ('Image','Gallery'):
        pending = []
        for item in valid:
            if item['kind'] != kind: continue
            if any(str(p['id'])==identifier for p in item['performers']):
                results.append({'key':item['key'],'status':'unchanged','performer':person['name']})
            else: pending.append(item)
        if not pending: continue
        store.log(token,{'action':'add_requested','kind':kind,'ids':[i['id'] for i in pending],'performer_id':identifier})
        try:
            api.add(kind,[i['id'] for i in pending],identifier,allow_bridge=args.get('ack_bridge') is True)
            results.extend({'key':i['key'],'status':'saved','performer':person['name'],'performer_id':identifier} for i in pending)
        except Exception as error:
            results.extend({'key':i['key'],'status':'unconfirmed','message':str(error)} for i in pending)
    store.log(token,{'action':'result','results':results})
    return {'results':results,'created':created,'performer':person}


def operation(payload,api=None,store=None):
    args = payload.get('args') or {}
    if args.get('hookContext'): return {'skipped':'Performer Matcher has no automatic hooks.'}
    api = api or API(payload['server_connection'])
    own_store = store is None
    store = store or Store(ROOT/'matcher.sqlite3')
    try:
        mode = args.get('mode')
        if mode=='start':
            session = validate_scope(args)
            session['people'] = api.people()
            session['bridge'] = bridge_enabled(api.settings())
            token = store.new(session)
            return {'token':token,'people':session['people'],'bridge':session['bridge']}
        token = args.get('token'); store.session(token)
        if mode=='scan': return scan(api,store,token)
        if mode=='apply':
            with import_lock(ROOT/'matcher-import.lock'): return apply(api,store,token,args)
        raise ValueError('Unknown Matcher operation.')
    finally:
        if own_store: store.close()


if __name__=='__main__':
    for stream in (sys.stdin,sys.stdout,sys.stderr):
        if hasattr(stream,'reconfigure'): stream.reconfigure(encoding='utf-8')
    try: print(json.dumps({'output':operation(json.load(sys.stdin))},ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'error':str(error)},ensure_ascii=False)); sys.exit(1)
