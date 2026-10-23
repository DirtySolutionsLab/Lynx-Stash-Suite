"""Shared rule resolution. Never activates automation or writes configuration."""
from pathlib import Path
import copy,json
ATTRIBUTE_DEFAULTS=json.loads(Path(__file__).with_name('attribute-defaults.json').read_text(encoding='utf-8'))

def resolve_module(configuration,legacy,spec):
    own=configuration.get(spec['bundle']) or {}
    previous=configuration.get(legacy) or {}
    values={key[len(spec['prefix']):]:copy.deepcopy(value) for key,value in own.items() if key.startswith(spec['prefix'])}
    if legacy=='LynxPerformerAttributeTags':
        for key,default in ATTRIBUTE_DEFAULTS.items():
            namespaced=spec['prefix']+key
            if namespaced in own:
                value=own[namespaced]
                values[key]=value if isinstance(value,str) and value.strip() else default
            else:
                value=previous.get(key)
                values[key]=value if isinstance(value,str) and value.strip() else default
        if spec['prefix']+'braSizeField' not in own and not previous.get('braSizeField'):
            xl=configuration.get('LynxScrapingSuite') or {}
            values['braSizeField']=xl.get('xl__braField') or (configuration.get('LynxXLGirls') or {}).get('braField') or ATTRIBUTE_DEFAULTS['braSizeField']
    elif legacy in ('LynxTagBridge','LynxPerformerBridge'):
        # Recover scope/filter strings, never old automatic/removal flags.
        keys=('performerAllow','galleryAllow','imageAllow','excluded','syncAllow') if legacy=='LynxTagBridge' else ('galleryIds',)
        for key in keys:
            if spec['prefix']+key not in own and isinstance(previous.get(key),str):values[key]=previous[key]
    return values
