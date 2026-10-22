"""Configurable library classification, not medical or visual assessment."""
import math
import re

DEFAULT_BODY_RULES = 'height<=160,weight<=50=Petite'
DEFAULT_CUP_MAP = ('AA=Small Tits;A=Small Tits;B=Normal Tits;C=Normal Tits;'
                   'D=Normal Tits;E=Normal Tits;F=Big Tits;G=Big Tits;'
                   'H=Huge Tits;I=Huge Tits;J=Huge Tits;K=Huge Tits')


def body_rules(text):
    rules = []
    for row in str(text).split(';'):
        if not row.strip():
            continue
        conditions, separator, target = row.rpartition('=')
        if not separator or not target.strip():
            raise ValueError('Invalid body-type rule: ' + row)
        parsed = []
        for condition in conditions.split(','):
            match = re.fullmatch(r'\s*(height|weight)\s*(<=|>=|<|>|==)\s*(\d+(?:\.\d+)?)\s*', condition)
            if not match:
                raise ValueError('Use height<=160,weight<=50=Petite. Invalid condition: ' + condition)
            threshold = float(match[3])
            if not 0 < threshold <= (300 if match[1] == 'height' else 500):
                raise ValueError('Invalid body-type threshold: ' + condition)
            parsed.append((match[1], match[2], threshold))
        rules.append((parsed, target.strip(), row.strip()))
    if not rules:
        raise ValueError('At least one body-type rule is required.')
    return rules


def positive_number(value, maximum):
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (ValueError, TypeError):
        return None
    minimum = 50 if maximum == 300 else 10
    return number if math.isfinite(number) and minimum <= number <= maximum else None


def infer_body(performer, rules):
    values = {'height': positive_number(performer.get('height_cm'), 300),
              'weight': positive_number(performer.get('weight'), 500)}
    comparisons = {'<=': lambda a,b:a<=b, '>=':lambda a,b:a>=b,
                   '<':lambda a,b:a<b, '>':lambda a,b:a>b, '==':lambda a,b:a==b}
    for conditions, target, label in rules:
        if all(values[field] is not None and comparisons[operator](values[field], threshold)
               for field, operator, threshold in conditions):
            return target, '%s cm / %s kg; rule %s' % (values['height'], values['weight'], label)
    return None, 'no rule matches or required height/weight data is missing'


def infer_cup(measurements, rules):
    text = str(measurements or '').strip().upper()
    # A named cup may stand alone or follow a band size. Numeric measurements
    # alone never imply a cup; multiple different sizes are treated as ambiguous.
    units = {'CM', 'MM', 'IN', 'INCH'}
    matches = [cup for cup in re.findall(
        r'(?<![\w.])\d{2,3}\s*([A-Z]{1,4})(?=$|[\s,;/\-])', text)
        if cup not in units]
    if not matches and text not in units and re.fullmatch(r'[A-Z]{1,4}', text):
        matches = [text]
    if len(set(matches)) != 1:
        return None, 'no clear cup code or several different cups'
    cup = matches[0]
    target = rules.get(cup.casefold())
    return target, ('Measurements=%s; cup %s' % (measurements, cup) if target else
                    'cup %s has no mapping; no size conversion is performed' % cup)


def infer_bra_size(measurements):
    """Extract an explicit band/cup code; never infer a cup from BWH numbers."""
    text = str(measurements or '').strip().upper()
    matches = []
    for band, cup in re.findall(r'(?<![\w.])(\d{2,3})\s*([A-Z]{1,4})(?=$|[\s,;/\-])', text):
        # Accept inch or centimetre bands and conventional repeated-letter cups.
        if 24 <= int(band) <= 120 and len(set(cup)) == 1:
            matches.append(f'{int(band)}{cup}')
    distinct = set(matches)
    if len(distinct) != 1:
        return None, 'no unambiguous full band/cup code in Measurements'
    return matches[0], f'Measurements={measurements}; explicit bra size {matches[0]}'


def field_plan(performer, field_name, owned, target):
    """Only blank fields or exact previously-owned values may be changed."""
    fields = performer.get('custom_fields') or {}
    key = next((key for key in fields if key.strip().casefold() == field_name.casefold()), field_name)
    current = fields.get(key)
    previous = owned.get(key)
    if current not in (None, '') and (previous is None or str(current) != previous):
        return key, None, 'manual value preserved'
    if target is None and previous is None:
        return key, None, 'inget att fylla i'
    next_value = target or ''
    if str(current or '') == next_value:
        return key, None, 'unchanged'
    return key, next_value, 'automatic field'
