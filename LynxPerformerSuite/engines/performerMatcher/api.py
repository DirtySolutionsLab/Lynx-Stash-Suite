"""Small Stash API client; all mutations use explicit IDs and additive links."""
import json
import urllib.request

PERSON = 'id name disambiguation alias_list image_path'
COMMON = 'id title updated_at performers{id name}'
GALLERY = COMMON + ' files{path} folder{path} image_count cover{paths{thumbnail}}'
IMAGE = COMMON + ' visual_files{... on ImageFile{path} ... on VideoFile{path}} paths{thumbnail} galleries{id}'


class API:
    def __init__(self, connection):
        host = connection.get('Host') or 'localhost'
        if host in ('0.0.0.0', '::'): host = 'localhost'
        if ':' in host and not host.startswith('['): host = '[' + host + ']'
        self.url = f"{connection.get('Scheme','http')}://{host}:{connection.get('Port',9999)}/graphql"
        self.headers = {'Content-Type': 'application/json'}
        if connection.get('ApiKey'): self.headers['ApiKey'] = connection['ApiKey']
        cookie = connection.get('SessionCookie') or {}
        if cookie.get('Value'): self.headers['Cookie'] = cookie.get('Name', 'session') + '=' + cookie['Value']

    def gql(self, query, variables=None):
        request = urllib.request.Request(self.url, data=json.dumps({'query':query,'variables':variables or {}}).encode(),
                                         headers=self.headers)
        with urllib.request.urlopen(request, timeout=60) as response: result = json.load(response)
        if result.get('errors'): raise ValueError('; '.join(e['message'] for e in result['errors']))
        return result['data']

    def settings(self):
        return self.gql('{configuration{plugins}}')['configuration']['plugins'] or {}

    def people(self):
        found = []; page = 1
        while True:
            result = self.gql('query($f:FindFilterType!){findPerformers(filter:$f){performers{' + PERSON + '}}}',
                              {'f':{'page':page,'per_page':1000,'sort':'id','direction':'ASC'}})['findPerformers']['performers']
            found.extend(result)
            if len(result) < 1000: return found
            page += 1
            if page > 200: raise ValueError('The performer catalog exceeds this module\'s limit.')

    def get_many(self, kind, ids):
        if not ids: return []
        fields = IMAGE if kind == 'Image' else GALLERY
        definitions = ','.join('$i%d:ID!' % i for i in range(len(ids)))
        selection = ' '.join('n%d:find%s(id:$i%d){%s}' % (i,kind,i,fields) for i in range(len(ids)))
        data = self.gql('query(' + definitions + '){' + selection + '}',
                        {'i%d'%i:str(identifier) for i,identifier in enumerate(ids)})
        return [self.item(kind,data['n%d'%i]) for i in range(len(ids)) if data.get('n%d'%i)]

    def page(self, kind, criteria, search, page, per_page):
        plural = 'Images' if kind == 'Image' else 'Galleries'
        field = 'images' if kind == 'Image' else 'galleries'
        arg = 'image_filter' if kind == 'Image' else 'gallery_filter'
        fields = IMAGE if kind == 'Image' else GALLERY
        query = 'query($c:%sFilterType!,$f:FindFilterType!){find%s(%s:$c,filter:$f){count %s{%s}}}' % (kind,plural,arg,field,fields)
        result = self.gql(query,{'c':criteria,'f':{'q':search,'page':page,'per_page':per_page,'sort':'id','direction':'ASC'}})['find'+plural]
        return result['count'], [self.item(kind,i) for i in result[field]]

    @staticmethod
    def item(kind, raw):
        paths = []
        for f in raw.get('visual_files' if kind == 'Image' else 'files') or []:
            if f.get('path'): paths.append({'path':f['path'],'is_file':True})
        if kind == 'Gallery' and (raw.get('folder') or {}).get('path'):
            paths.append({'path':raw['folder']['path'],'is_file':False})
        thumb = (raw.get('paths') or {}).get('thumbnail') if kind == 'Image' else (((raw.get('cover') or {}).get('paths') or {}).get('thumbnail'))
        return {'key':kind+':'+raw['id'],'kind':kind,'id':raw['id'],'title':raw.get('title') or '',
                'source_paths':paths,'thumbnail':thumb,'performers':raw.get('performers') or [],
                'galleries':[g['id'] for g in raw.get('galleries') or []],'image_count':raw.get('image_count',0)}

    def create(self, name):
        return self.gql('mutation($i:PerformerCreateInput!){performerCreate(input:$i){'+PERSON+'}}',
                        {'i':{'name':name}})['performerCreate']

    def person(self, identifier):
        return self.gql('query($id:ID!){findPerformer(id:$id){'+PERSON+'}}',
                        {'id':str(identifier)})['findPerformer']

    def add(self, kind, ids, performer, allow_bridge=False):
        self.gql('mutation($i:Bulk%sUpdateInput!){bulk%sUpdate(input:$i){id}}' % (kind,kind),
                 {'i':{'ids':ids,'clientMutationId':'LynxPerformerMatcher+Bridge' if allow_bridge else 'LynxPerformerMatcher',
                       'performer_ids':{'mode':'ADD','ids':[performer]}}})
