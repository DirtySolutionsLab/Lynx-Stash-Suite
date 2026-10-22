"""Stash native name/URL performer scraper; never modifies Stash metadata."""
import json
import sys
from mature_client import Client

def main(mode,payload,client=None):
    client=client or Client()
    if mode=='query':
        name=payload.get('name') or payload.get('query') or ''
        found=client.search(name)
        if found.get('warning'):print(found['warning'],file=sys.stderr)
        return [{'name':r['name'],'url':r['url'],'urls':[r['url']]} for r in found['results']]
    if mode!='profile':raise ValueError('Unknown scraper mode.')
    url=payload.get('url') or next((u for u in payload.get('urls',[]) if 'mature.nl/' in u),'')
    profile=client.profile(url);result={**profile['fields'],'url':profile['url'],'urls':[profile['url']]}
    result['tags']=[{'name':name} for name in dict.fromkeys(profile.get('tag_fields',{}).values())]
    if profile.get('image_url'):result['images']=[profile['image_url']]
    return result

if __name__=='__main__':
    for stream in (sys.stdin,sys.stdout,sys.stderr):
        if hasattr(stream,'reconfigure'):stream.reconfigure(encoding='utf-8')
    mode=sys.argv[1] if len(sys.argv)>1 else ''
    try:print(json.dumps(main(mode,json.load(sys.stdin)),ensure_ascii=False))
    except Exception as e:
        print('Lynx Mature.nl: '+str(e),file=sys.stderr)
        print(json.dumps([] if mode=='query' else {}));sys.exit(1)
