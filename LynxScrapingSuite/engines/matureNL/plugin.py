"""Mature.nl companion: explicit single/batch previews and field imports only."""
import json
import re
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from scraping_support import API,values_of,import_input
from mature_client import Client
from mature_core import profile_url
from tag_import import prepare,finish_import

NATIVE=('name','country','details','ethnicity')
DEFAULT_FIELDS={'body_type':'Body Type','breast_size':'Breast Size'}
SETTING_KEYS={'body_type':'bodyField','breast_size':'breastField'}

def custom_settings(plugins):
    own=plugins.get('LynxScrapingSuite') or {};names={}
    for key,default in DEFAULT_FIELDS.items():
        name=str(own.get('mature__'+SETTING_KEYS[key]) or default).strip()
        if not 1<=len(name)<=100:raise ValueError('Custom field names must have 1–100 characters.')
        names[key]=name
    if len({name.casefold() for name in names.values()})!=len(names):raise ValueError('Custom field names must be different.')
    return names,own

def mapped(profile,settings):
    custom=dict(profile['custom'])
    for key,map_key in [('body_type','bodyMap'),('breast_size','breastMap')]:
        raw=settings.get('mature__'+map_key) or ''
        rules={}
        for row in raw.split(';'):
            if not row.strip():continue
            a,sep,b=row.partition('=')
            if not sep or not a.strip() or not b.strip():raise ValueError('Use source=value;source=value in category mappings.')
            if a.strip().casefold() in rules:raise ValueError('Duplicate category mapping: '+a)
            rules[a.strip().casefold()]=b.strip()
        if key in custom:custom[key]=rules.get(custom[key].casefold(),custom[key])
    return {**profile,'custom':custom}

def profiles(urls):
    result=set()
    for url in urls if isinstance(urls,list) else []:
        try:result.add(profile_url(url))
        except (ValueError,TypeError):pass
    return result

def operation(payload,api=None,client=None):
    args=payload.get('args') or {};mode=args.get('mode')
    if args.get('hookContext'):return {'skipped':'Mature.nl has no automatic update hooks.'}
    if mode not in ('search','preview','import','batch_preview','batch_import'):raise ValueError('Unknown Mature.nl operation.')
    api=api or API(payload['server_connection']);config=api.gql('{configuration{plugins}}')['configuration']['plugins'] or {}
    custom_names,settings=custom_settings(config);client=client or Client()
    if mode=='search':return client.search(args.get('name',''))
    identifier=str(args.get('performer_id',''))
    if not re.fullmatch(r'[1-9]\d*',identifier):raise ValueError('An exact performer ID is required.')
    resolution=None;before=None
    if mode.startswith('batch_'):
        before=api.performer(identifier);saved=profiles(before.get('urls'))
        if len(saved)>1:return {'skipped':'Multiple Mature.nl profiles are saved. Choose the correct profile manually.','performer_name':before['name'],'performer_id':identifier}
        if saved:url=next(iter(saved))
        else:
            name=str(before.get('name') or '').strip();resolution={'name':name}
            if mode=='batch_import' and args.get('resolution')!=resolution:raise ValueError('Name changed since preview.')
            found=client.search(name)
            exact=profiles([r.get('url') for r in found['results'] if ' '.join(r.get('name','').split()).casefold()==' '.join(name.split()).casefold()])
            if found.get('warning') or len(exact)!=1:return {'skipped':'No unique exact name match. Use the Mature.nl button to choose a profile.','performer_name':name,'performer_id':identifier}
            url=next(iter(exact))
        if mode=='batch_import' and args.get('url')!=url:raise ValueError('Source profile changed. Preview again.')
    else:url=args.get('url','')
    profile=mapped(client.profile(url),settings)
    if resolution and ' '.join(profile['fields']['name'].split()).casefold()!=' '.join(resolution['name'].split()).casefold():
        raise ValueError('Profile name does not match the performer. Choose a profile manually.')
    wants_image=mode=='preview' or mode=='batch_preview' and args.get('include_image') is True or 'image' in (args.get('fields') or [])
    if wants_image:
        if profile.get('image_url'):
            try:profile['image']=client.image(profile['image_url'])
            except ValueError as e:
                if mode in ('import','batch_import'):raise
                profile['warnings'].append(str(e)+' Other fields can still be imported.')
        else:profile['warnings'].append('No public portrait was found for this model.')
    current=api.performer(identifier)
    if before and (profiles(current.get('urls'))!=saved or resolution and current.get('name')!=before.get('name')):
        raise ValueError('Name or saved profiles changed during the request. Preview again.')
    prepared,virtual,cleanup=prepare(current,profile,settings,custom_names)
    if mode in ('preview','batch_preview'):
        return {'performer_id':identifier,'performer_name':current['name'],'profile':profile,
                'current':{**values_of(prepared,NATIVE+tuple(virtual['tag_fields']),custom_names),'legacy_fields':prepared['legacy_fields']},
                'cleanup':cleanup,'custom_names':custom_names,'resolution':resolution}
    if args.get('custom_names')!=custom_names:raise ValueError('Custom field settings changed. Preview again.')
    update=import_input(identifier,args.get('fields'),args.get('expected') or {},args.get('source_expected') or {},prepared,virtual,NATIVE+tuple(virtual['tag_fields']),custom_names)
    update=finish_import(api,current,profile,settings,custom_names,args,update,cleanup)
    if len(update)>1:api.gql('mutation($input:PerformerUpdateInput!){performerUpdate(input:$input){id}}',{'input':update})
    return {'saved':True,'changed':len(update)>1,'performer_id':identifier}

if __name__=='__main__':
    for stream in (sys.stdin,sys.stdout,sys.stderr):
        if hasattr(stream,'reconfigure'):stream.reconfigure(encoding='utf-8')
    try:print(json.dumps({'output':operation(json.load(sys.stdin))},ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error':str(e)},ensure_ascii=False));sys.exit(1)
