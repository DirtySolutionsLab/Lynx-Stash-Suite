"""Reusable explicit metadata-import support for Lynx source modules."""
import json
import urllib.request

class API:
    def __init__(self,connection,timeout=30):
        host=connection.get('Host') or 'localhost'
        if host in ('0.0.0.0','::'):host='localhost'
        if ':' in host and not host.startswith('['):host='['+host+']'
        self.url=f"{connection.get('Scheme','http')}://{host}:{connection.get('Port',9999)}/graphql";self.timeout=timeout
        self.headers={'Content-Type':'application/json'}
        if connection.get('ApiKey'):self.headers['ApiKey']=connection['ApiKey']
        cookie=connection.get('SessionCookie') or {}
        if cookie.get('Value'):self.headers['Cookie']=cookie.get('Name','session')+'='+cookie['Value']
    def gql(self,query,variables=None):
        req=urllib.request.Request(self.url,data=json.dumps({'query':query,'variables':variables or {}}).encode(),headers=self.headers)
        with urllib.request.urlopen(req,timeout=self.timeout) as response:result=json.load(response)
        if result.get('errors'):raise ValueError('; '.join(e['message'] for e in result['errors']))
        return result['data']
    def performer(self,identifier):
        result=self.gql('query($id:ID!){findPerformer(id:$id){id name country ethnicity details urls tags{id name aliases} custom_fields image_path updated_at}}',{'id':identifier})['findPerformer']
        if not result:raise ValueError('Performer no longer exists.')
        return result

def values_of(performer,native,custom_names):
    values={key:performer.get(key) for key in native};custom=performer.get('custom_fields') or {}
    values.update({key:custom.get(name) for key,name in custom_names.items()})
    values['image']={'path':performer.get('image_path'),'updated_at':performer.get('updated_at')}
    return values

def import_input(identifier,chosen,expected,source_expected,current,profile,native,custom_names):
    allowed=set(native)|set(custom_names)|{'image'}
    if not isinstance(chosen,list) or not chosen or any(not isinstance(k,str) or k not in allowed for k in chosen) or len(set(chosen))!=len(chosen):
        raise ValueError('Choose one or more available fields; other fields cannot be updated.')
    existing=values_of(current,native,custom_names);source={**profile['fields'],**profile['custom']};update={'id':identifier};partial={}
    for key in chosen:
        if key=='image':
            image=profile.get('image')
            if not image:raise ValueError('No valid public portrait. Preview again.')
            if expected.get(key)!=existing[key] or source_expected.get(key)!={'url':image['url'],'sha256':image['sha256']}:
                raise ValueError('The performer image or source image changed. Preview again.')
            update['image']=image['data_uri'];continue
        if key not in source or source[key] in (None,''):raise ValueError('A selected source field is missing. Preview again.')
        if key not in expected or expected[key]!=existing[key]:raise ValueError('The saved performer changed. Preview again.')
        if key not in source_expected or source_expected[key]!=source[key]:raise ValueError('Source data changed. Preview again.')
        if source[key]==existing[key]:continue
        if key in custom_names:partial[custom_names[key]]=source[key]
        else:update[key]=source[key]
    if partial:update['custom_fields']={'partial':partial}
    if profile['url'] not in (current.get('urls') or []):update['urls']=[*(current.get('urls') or []),profile['url']]
    return update
