"""Redirect only the engine's plugin requests; keep provenance engines isolated."""
from attribute_defaults import resolve_module
import copy
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent
MAP=json.loads((ROOT/'suite-map.json').read_text(encoding='utf-8'))
TASKS=json.loads((ROOT/'task-map.json').read_text(encoding='utf-8'))


def aliases(configuration):
    result=copy.deepcopy(configuration)
    for legacy,spec in MAP.items():
        if legacy==spec['bundle'] and not spec['prefix']:
            continue
        saved=configuration.get(spec['bundle']) or {}
        result[legacy]=resolve_module(configuration,legacy,spec)
        if spec['enabled'] and saved.get(spec['enabled']) is not True:
            result[legacy]['automatic']=False
            result[legacy]['automaticBraSize']=False
    return result


def route(query,variables):
    variables=copy.deepcopy(variables or {})
    if not re.search(r'\b(runPluginTask|configurePlugin)\s*\(',query):
        return query,variables
    match=re.search(r'plugin_id\s*:\s*(?:"([^"]+)"|\$(\w+))',query)
    if not match:
        raise ValueError('Cannot safely route engine request.')
    legacy=match[1] or variables.get(match[2])
    spec=MAP.get(legacy)
    if not spec:
        return query,variables
    if match[1]:
        query=query.replace(match[0],'plugin_id:'+json.dumps(spec['bundle']),1)
    else:
        variables[match[2]]=spec['bundle']
    if 'runPluginTask' in query:
        task=re.search(r'task_name\s*:\s*(?:"([^"]+)"|\$(\w+))',query)
        if not task:
            raise ValueError('A named engine task is required.')
        old=task[1] or variables.get(task[2])
        new=(TASKS.get(legacy) or {}).get(old)
        if not new:
            raise ValueError('Unknown engine task: '+str(old))
        if task[1]:
            query=query.replace(task[0],'task_name:'+json.dumps(new),1)
        else:
            variables[task[2]]=new
    else:
        arg=re.search(r'input\s*:\s*\$(\w+)',query)
        if spec['prefix'] and not arg:
            raise ValueError('Configuration needs explicit input map.')
        if spec['prefix']:
            variables[arg[1]]={spec['prefix']+key:value for key,value in variables.get(arg[1],{}).items()}
    return query,variables


def adapt_api(cls):
    original=cls.gql
    def gql(self,query,variables=None):
        query,variables=route(query,variables)
        result=original(self,query,variables)
        if isinstance(result,dict) and isinstance(result.get('configuration'),dict):
            config=result['configuration']
            if 'plugins' in config:
                config['plugins']=aliases(config['plugins'] or {})
        return result
    cls.gql=gql
