"""Explicit, editable BWH library heuristics. Never derive a bra cup from girth."""
import re

DEFAULT_BUST_RULES = 'bust<85=Small Tits;bust<100=Normal Tits;bust<115=Big Tits;bust>=115=Huge Tits'
DEFAULT_SHAPE_RULES = 'waist_bust<=0.8,waist_hip<=0.8,bust_hip>=0.85,bust_hip<=1.15=Curvy'
SHAPE_FIELDS = {'bust', 'waist', 'hips', 'waist_bust', 'waist_hip', 'bust_hip'}
NUMBER = r'(\d+(?:[.,]\d+)?)'
UNIT = r'\s*(cm|centimeters?|centimetres?|inches|inch|in|tum|")?'
TRIPLE = re.compile(r'^\s*' + NUMBER + UNIT + r'\s*[-/x×]\s*' +
                    NUMBER + UNIT + r'\s*[-/x×]\s*' + NUMBER + UNIT + r'\s*$', re.I)


def unit_name(value):
    return 'cm' if value.lower().startswith('c') else 'inches'


def unit_mode(value):
    value = str(value or 'auto').strip().lower()
    if value in ('in', 'inch', 'inches', 'tum'):
        return 'inches'
    if value in ('auto', 'cm'):
        return value
    raise ValueError('Measurement units must be auto, cm or inches.')


def numeric_measurements(text, mode='auto'):
    mode = unit_mode(mode)
    text = str(text or '').strip().replace('–', '-').replace('—', '-').replace('”', '"')
    text = re.sub(r'\((cm|inches|inch|in|tum)\)\s*$', r'\1', text, flags=re.I)
    match = TRIPLE.fullmatch(text)
    if not match:
        return None, 'requires three numeric bust–waist–hip measurements, not a bra band/cup code'
    values = [float(match[index].replace(',', '.')) for index in (1, 3, 5)]
    units = [unit_name(match[index]) if match[index] else None for index in (2, 4, 6)]
    declared = set(units) - {None}
    if len(declared) == 1:
        units = [next(iter(declared))] * 3
        evidence = 'explicit unit'
    elif len(declared) > 1:
        if None in units:
            return None, 'mixed units without a unit for all three measurements'
        evidence = 'explicit mixed units'
    elif mode != 'auto':
        units = [mode] * 3
        evidence = 'unit setting ' + mode
    else:
        bust, waist, hips = values
        inches = 20 <= bust <= 60 and 15 <= waist <= 60 and 20 <= hips <= 65
        cm = 55 <= bust <= 250 and 35 <= waist <= 250 and 55 <= hips <= 300
        if inches == cm:
            return None, 'ambiguous or invalid units; include cm/inches in Measurements'
        units = ['inches' if inches else 'cm'] * 3
        evidence = 'auto: tolkat som ' + units[0] + ' (heuristik)'
    converted = [value * (2.54 if unit == 'inches' else 1) for value, unit in zip(values, units)]
    bust, waist, hips = converted
    if not (55 <= bust <= 250 and 35 <= waist <= 250 and 55 <= hips <= 300):
        return None, 'numeric circumference measurements are outside parsing limits'
    return {'bust': bust, 'waist': waist, 'hips': hips,
            'waist_bust': waist / bust, 'waist_hip': waist / hips,
            'bust_hip': bust / hips}, evidence


def measurement_rules(text, allowed):
    rules = []
    for row in str(text).split(';'):
        if not row.strip():
            continue
        conditions, separator, target = row.rpartition('=')
        if not separator or not target.strip():
            raise ValueError('Invalid measurement rule: ' + row)
        parsed = []
        for condition in conditions.split(','):
            match = re.fullmatch(r'\s*([a-z_]+)\s*(<=|>=|<|>|==)\s*(\d+(?:\.\d+)?)\s*', condition)
            if not match or match[1] not in allowed:
                raise ValueError('Unknown measurement/condition: ' + condition)
            threshold = float(match[3])
            limit = 5 if '_' in match[1] else 300
            if not 0 < threshold <= limit:
                raise ValueError('Invalid measurement threshold: ' + condition)
            parsed.append((match[1], match[2], threshold))
        rules.append((parsed, target.strip(), row.strip()))
    if not rules:
        raise ValueError('At least one measurement rule is required.')
    return rules


def infer_measurements(text, rules, mode='auto'):
    values, evidence = numeric_measurements(text, mode)
    if values is None:
        return None, evidence
    comparisons = {'<=': lambda a,b:a<=b, '>=':lambda a,b:a>=b,
                   '<':lambda a,b:a<b, '>':lambda a,b:a>b, '==':lambda a,b:a==b}
    for conditions, target, label in rules:
        if all(comparisons[operator](values[field], threshold) for field, operator, threshold in conditions):
            return target, 'BWH %.2f/%.2f/%.2f cm; %s; rule %s' % (
                values['bust'], values['waist'], values['hips'], evidence, label)
    return None, 'no numeric measurement rules match; ' + evidence
