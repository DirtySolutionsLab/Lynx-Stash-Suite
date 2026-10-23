"""Bundle entry point. Each engine retains its own module directory and DB."""
import json
from pathlib import Path
import subprocess
import sys
import urllib.request

ROOT=Path(__file__).resolve().parent
ENGINES=json.loads((ROOT/'engines.json').read_text(encoding='utf-8'))


def config(connection):
    host=connection.get('Host') or 'localhost'
    if host in ('0.0.0.0','::'):host='localhost'
    if ':' in host and not host.startswith('['):host='['+host+']'
    url=f"{connection.get('Scheme','http')}://{host}:{connection.get('Port',9999)}/graphql"
    headers={'Content-Type':'application/json'}
    if connection.get('ApiKey'):headers['ApiKey']=connection['ApiKey']
    cookie=connection.get('SessionCookie') or {}
    if cookie.get('Value'):headers['Cookie']=cookie.get('Name','session')+'='+cookie['Value']
    request=urllib.request.Request(url,data=json.dumps({'query':'{configuration{plugins}}'}).encode(),headers=headers)
    with urllib.request.urlopen(request,timeout=15) as response:result=json.load(response)
    if result.get('errors'):raise ValueError('Could not read suite configuration.')
    return result['data']['configuration']['plugins'] or {}


def run(payload,configuration=None,invoke=None):
    args=payload.get('args') or {}
    settings=(configuration if configuration is not None else config(payload['server_connection'])).get(ENGINES['bundle']) or {}
    hook=args.get('hookContext')
    if hook:
        selected=[(name,engine) for name,engine in ENGINES['modules'].items() if hook.get('type') in engine['hooks']]
    else:
        name=args.get('module')
        if name not in ENGINES['modules']:raise ValueError('An explicit module is required.')
        selected=[(name,ENGINES['modules'][name])]
    outputs=[]
    for name,engine in selected:
        if settings.get(engine['enabled']) is not True:
            if hook:continue
            raise ValueError('Module disabled: '+name)
        child={**payload,'args':{key:value for key,value in args.items() if key!='module'}}
        if invoke is not None:
            outputs.append(invoke(name,engine,child));continue
        result=subprocess.run([sys.executable,str(ROOT/engine['script'])],input=json.dumps(child),
                              text=True,encoding='utf-8',capture_output=True,cwd=str((ROOT/engine['script']).parent))
        if result.stderr:print(result.stderr,end='',file=sys.stderr,flush=True)
        try:answer=json.loads(result.stdout)
        except ValueError as error:raise ValueError('Engine returned invalid JSON: '+name) from error
        if result.returncode or answer.get('error'):raise ValueError(answer.get('error') or 'Engine failed: '+name)
        outputs.append(answer)
    if not hook and len(outputs)==1:return outputs[0]
    return {'output':'Hooks processed.','modules':outputs}


if __name__=='__main__':
    for stream in (sys.stdin,sys.stdout,sys.stderr):
        if hasattr(stream,'reconfigure'):stream.reconfigure(encoding='utf-8')
    try:print(json.dumps(run(json.load(sys.stdin)),ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'error':str(error)},ensure_ascii=False));sys.exit(1)
