"""Structured performer fields -> tags. No image analysis or free-text inference."""
import json
import re
import sqlite3
from datetime import date
from pathlib import Path
import sys
from bridge_runtime import API as BaseAPI, State as BaseState, exclusive_lock, log, schedule_pending
from attribute_inference import DEFAULT_BODY_RULES, DEFAULT_CUP_MAP, body_rules, infer_body, infer_cup, infer_bra_size, field_plan, positive_number
from measurement_inference import (DEFAULT_BUST_RULES, DEFAULT_SHAPE_RULES, SHAPE_FIELDS,
                                   measurement_rules, infer_measurements, unit_mode)
from metadata_cleanup import clean_urls

ROOT = Path(__file__).resolve().parent
PLUGIN_ID = 'LynxPerformerAttributeTags'
TASK_NAME = 'Lynx attribut – bearbeta köade ändringar'
FIELDS = ('id name birthdate death_date country ethnicity hair_color eye_color fake_tits tattoos piercings '
          'height_cm weight measurements urls custom_fields tags { id name }')
WATCHED = {'birthdate', 'death_date', 'country', 'ethnicity', 'hair_color', 'eye_color', 'fake_tits', 'tattoos', 'piercings', 'custom_fields', 'height_cm', 'weight', 'measurements', 'urls'}
DEFAULTS = {key: False for key in ('automatic', 'createTags', 'removeStale', 'country',
            'ethnicity', 'hair', 'eyes', 'breasts', 'breastSize', 'tattoos', 'piercings', 'body', 'age', 'manageMappedTags', 'inferBody', 'inferBreastSize', 'inferBreastNumeric', 'inferBodyMeasurements')}
DEFAULTS.update({key: '' for key in ('countryMap', 'ethnicityMap', 'hairMap', 'eyesMap', 'breastsMap',
                                     'tattooTag', 'veryInkedTag', 'tattooLevelField',
                                      'breastSizeField', 'breastSizeMap', 'braSizeField',
                                     'piercingTag', 'bodyField', 'bodyMap', 'ageMap', 'tattooLevelMap', 'bodyInferenceRules', 'cupInferenceMap', 'bustInferenceRules', 'shapeInferenceRules', 'measurementUnits')})


class PreviewState:
    """Read provenance without creating a DB, acquiring a job lock or changing queues."""
    def __init__(self, path):
        self.db = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True, timeout=5) if path.exists() else None
        self.tables = {row[0] for row in self.db.execute('SELECT name FROM sqlite_master WHERE type="table"')} if self.db else set()

    def inherited(self, kind, identifier):
        if 'inherited' not in self.tables:
            return set()
        return {row[0] for row in self.db.execute('SELECT tag_id FROM inherited WHERE kind=? AND object_id=?', (kind, str(identifier)))}

    def inferred(self, identifier):
        if 'inferred_fields' not in self.tables:
            return {}
        return dict(self.db.execute('SELECT field,value FROM inferred_fields WHERE object_id=?', (str(identifier),)))

    def close(self):
        if self.db:
            self.db.close()


class State(BaseState):
    def __init__(self, path):
        super().__init__(path)
        self.db.execute('CREATE TABLE IF NOT EXISTS inferred_fields '
                        '(object_id TEXT, field TEXT, value TEXT, PRIMARY KEY(object_id,field))')
        self.db.commit()

    def inferred(self, identifier):
        return dict(self.db.execute('SELECT field,value FROM inferred_fields WHERE object_id=?', (str(identifier),)))

    def set_inferred(self, identifier, field, value):
        if value is None:
            self.db.execute('DELETE FROM inferred_fields WHERE object_id=? AND field=?', (str(identifier), field))
        else:
            self.db.execute('INSERT OR REPLACE INTO inferred_fields VALUES (?,?,?)', (str(identifier), field, value))
        self.db.commit()
DEFAULT_AGE_MAP = '18-19=18-19;20-29=20s;30-39=30s;40-49=40s;50-59=50s;60-69=60s;70+=70 Plus'
MAPS = {
    'ethnicity': 'Caucasian=White;White=White;Asian=Asian;Black=Black;'
                 'Latina=Latina;Latin=Latina;Latino=Latina;Hispanic=Latina;Middle Eastern=Middle Eastern;'
                 'Indian=Indian;Mixed=Mixed;Other=Other',
    'country': 'SE=Sweden;Sweden=Sweden;US=United States;United States=United States;'
               'GB=United Kingdom;UK=United Kingdom;United Kingdom=United Kingdom;'
               'RU=Russia;Russia=Russia;BR=Brazil;Brazil=Brazil;CA=Canada;Canada=Canada;'
               'DE=Germany;Germany=Germany;FR=France;France=France;IT=Italy;Italy=Italy;'
               'ES=Spain;Spain=Spain;NO=Norway;Norway=Norway;DK=Denmark;Denmark=Denmark;'
               'FI=Finland;Finland=Finland;CZ=Czech Republic;Czech Republic=Czech Republic;'
               'HU=Hungary;Hungary=Hungary;UA=Ukraine;Ukraine=Ukraine;CH=Switzerland;'
               'Switzerland=Switzerland;NL=Netherlands;Netherlands=Netherlands;'
               'PL=Poland;Poland=Poland;AU=Australia;Australia=Australia;JP=Japan;Japan=Japan;'
               'CN=China;China=China;TH=Thailand;Thailand=Thailand;MX=Mexico;Mexico=Mexico;'
               'CO=Colombia;Colombia=Colombia;VE=Venezuela;Venezuela=Venezuela;'
               'PR=Puerto Rico;Puerto Rico=Puerto Rico',
    'hair': 'Blonde=Blonde;Blond=Blonde;Brunette=Brunette;Black=Black Hair;'
            'Red=Redhead;Redhead=Redhead;Auburn=Auburn Hair;Brown=Brown Hair;'
            'Grey=Grey Hair;Gray=Grey Hair;White=White Hair;Bald=Bald;Various=Various Hair;'
            'Green=Green Hair;Blue=Blue Hair;Pink=Pink Hair;Purple=Purple Hair;'
            'Orange=Orange Hair;Silver=Silver Hair',
    'eyes': 'Blue=Blue Eyes;Brown=Brown Eyes;Green=Green Eyes;Hazel=Hazel Eyes;'
            'Grey=Grey Eyes;Gray=Grey Eyes;Amber=Amber Eyes',
    'breasts': 'Fake=Fake Breasts;Augmented=Fake Breasts;Natural=Natural Breasts',
    'breastSize': 'Small=Small Tits;Small Tits=Small Tits;Normal=Normal Tits;Normal Tits=Normal Tits;Big=Big Tits;Big Tits=Big Tits;Huge=Huge Tits;Huge Tits=Huge Tits',
    'body': 'BBW=BBW;Large=BBW;Slim=Slim;Athletic=Athletic;Average=Average;Curvy=Curvy;Plus Size=Plus Size;Muscular=Muscular;Voluptuous=Voluptuous;SSBBW=SSBBW;Petite=Petite',
}
NEGATIVE = {'', 'none', 'no', 'unknown', 'n/a', 'na', 'false', '0', '-', 'null',
            'not known', 'not specified', 'ingen', 'inga', 'nej', 'okänd', 'okänt',
            'no tattoos', 'no piercings', 'none known', 'no ink'}


def normalized(value):
    return str(value or '').strip().casefold()


ETHNICITY_VALUES = {
    'caucasian': 'White', 'white': 'White', 'latin': 'Latina',
    'latino': 'Latina', 'latina': 'Latina', 'latinx': 'Latina',
    'hispanic': 'Latina', 'asian': 'Asian', 'black': 'Black',
    'middle eastern': 'Middle Eastern', 'indian': 'Indian',
    'mixed': 'Mixed', 'other': 'Other',
}
BREAST_TYPE_VALUES = {
    'natural': 'Natural', 'natural tits': 'Natural', 'natural breasts': 'Natural',
    'fake': 'Fake', 'fake tits': 'Fake', 'fake breasts': 'Fake',
    'augmented': 'Fake', 'augmented tits': 'Fake', 'augmented breasts': 'Fake',
    'breast implants': 'Fake',
}
PIERCING_VALUES = {
    'none': 'None', 'no piercings': 'None', 'no piercing': 'None',
    'piercing': 'Pierced', 'piercings': 'Pierced', 'pierced': 'Pierced',
    'ears': 'Pierced', 'nose': 'Pierced', 'navel': 'Pierced', 'nipples': 'Pierced',
    'ear piercing': 'Pierced', 'nose piercing': 'Pierced',
    'navel piercing': 'Pierced', 'nipple piercing': 'Pierced',
    'multiple': 'Multiple Piercings', 'multiple piercings': 'Multiple Piercings',
    'several piercings': 'Multiple Piercings',
}
PIERCING_LOCATIONS = {'ears', 'nose', 'navel', 'nipples', 'ear piercing',
                      'nose piercing', 'navel piercing', 'nipple piercing'}
NATIVE_VALUE_MAPS = {'ethnicity': ETHNICITY_VALUES, 'fake_tits': BREAST_TYPE_VALUES,
                     'piercings': PIERCING_VALUES}


def native_field_plan(performer, labels_by_id, plugin_owned_ids):
    """Canonicalize known field values; fill blanks only from unambiguous manual tags."""
    changes, warnings = {}, []
    for field, vocabulary in NATIVE_VALUE_MAPS.items():
        raw = str(performer.get(field) or '').strip()
        canonical = vocabulary.get(normalized(raw))
        if canonical:
            if raw != canonical:
                changes[field] = canonical
            continue
        if normalized(raw) not in NEGATIVE:
            # Unknown explicit values are never replaced by tag guesses.
            continue
        candidates, locations = set(), set()
        for tag in performer.get('tags') or []:
            tag_id = str(tag.get('id') or '')
            if tag_id in plugin_owned_ids:
                continue  # Do not recreate a field from a tag Lynx derived from that field.
            labels = {normalized(tag.get('name'))}
            labels.update(normalized(alias) for alias in labels_by_id.get(tag_id, ()))
            found = {vocabulary[label] for label in labels if label in vocabulary
                     and not (field == 'piercings' and label == 'none')}
            if len(found) > 1:
                warnings.append('%s: conflicting name/aliases on tag #%s' % (field, tag_id))
                continue
            candidates.update(found)
            if field == 'piercings' and found == {'Pierced'}:
                if any(label in PIERCING_LOCATIONS for label in labels):
                    locations.add(tag_id)
        if field == 'piercings' and 'None' not in candidates:
            if 'Multiple Piercings' in candidates or len(locations) >= 2:
                candidates = {'Multiple Piercings'}
        if len(candidates) == 1:
            changes[field] = next(iter(candidates))
        elif len(candidates) > 1:
            warnings.append('%s: conflicting tags; field left unchanged' % field)
    return changes, warnings


def mapping(text):
    result = {}
    for row in text.split(';'):
        if not row.strip():
            continue
        source, separator, target = row.partition('=')
        if not separator or not source.strip() or not target.strip():
            raise ValueError('Invalid mapping: %r. Use value=tag;value=tag.' % row)
        key = normalized(source)
        if key in result:
            raise ValueError('Duplicate source value in mapping: ' + source)
        result[key] = target.strip()
    return result


def build_maps(settings):
    result = {key: mapping(settings.get(key + 'Map') or MAPS[key])
              for key in MAPS if settings[key]}
    if settings.get('age'):
        result['age'] = age_ranges(settings.get('ageMap') or DEFAULT_AGE_MAP)
    if settings.get('tattoos') and settings.get('tattooLevelMap'):
        result['tattooLevel'] = mapping(settings['tattooLevelMap'])
    return result


def age_ranges(text):
    ranges = []
    for label, target in mapping(text).items():
        match = re.fullmatch(r'(\d+)\s*(?:-\s*(\d+)|(\+))?', label)
        if not match:
            raise ValueError('Invalid age range: ' + label + '. Use 30-39=tag or 70+=tag.')
        low = int(match[1])
        high = int(match[2]) if match[2] else (120 if match[3] else low)
        if low < 18 or high > 120 or high < low:
            raise ValueError('Age ranges must be between 18 and 120: ' + label)
        if any(low <= other_high and high >= other_low for other_low, other_high, _ in ranges):
            raise ValueError('Overlapping age ranges: ' + label)
        ranges.append((low, high, target))
    return ranges


def performer_age(performer, today=None):
    today = today or date.today()
    try:
        birth_value = str(performer.get('birthdate') or '').strip()
        birth_year_only = bool(re.fullmatch(r'\d{4}', birth_value))
        # Placeholder dates are used only for validation/comparison; never saved.
        born = date(int(birth_value), 1, 1) if birth_year_only else date.fromisoformat(birth_value)
        death_value = str(performer.get('death_date') or '').strip()
        death_year_only = bool(re.fullmatch(r'\d{4}', death_value))
        if death_year_only:
            end = date(int(death_value), 12, 31)
        else:
            end = date.fromisoformat(death_value) if death_value else today
        end = min(end, today)
    except ValueError:
        return None
    if born > end:
        return None
    # With a year-only value, use the age reached that calendar year. Exact
    # dates keep the birthday calculation; no invented month/day is persisted.
    age = end.year - born.year
    if not birth_year_only and not death_year_only:
        age -= (end.month, end.day) < (born.month, born.day)
    return age if 18 <= age <= 120 else None


def hair_targets(value, rules):
    """Exact first, then whole phrases. Never match red inside straight/infrared."""
    # Synonyms are interpretation rules, not additional dropdown entries.
    # Explicit user mappings still take priority over inferred aliases.
    rules = dict(rules)
    for group in (('red', 'redhead'), ('blonde', 'blond'),
                  ('brown', 'brunette'), ('grey', 'gray')):
        target = next((rules[key] for key in group if key in rules), None)
        if target is not None:
            for alias in group:
                rules.setdefault(alias, target)
    text = normalized(value)
    if text in rules:
        return [rules[text]]
    matches = []
    for source, target in sorted(rules.items(), key=lambda row: -len(row[0])):
        for hit in re.finditer(r'(?<!\w)' + re.escape(source) + r'(?!\w)', text):
            prefix = text[max(0, hit.start() - 20):hit.start()]
            if re.search(r'(?:not|no|non|inte|ej)\s*[-:]?\s*$', prefix):
                continue
            if any(hit.start() < end and hit.end() > start for start, end, _ in matches):
                continue
            matches.append((hit.start(), hit.end(), target))
    return list(dict.fromkeys(target for _, _, target in sorted(matches)))


def catalog_index(tags):
    """Names and aliases resolve to the same canonical Stash tag ID."""
    result = {}
    for tag in tags:
        for name in [tag['name'], *(tag.get('aliases') or [])]:
            key = normalized(name)
            if not key:
                continue
            if key in result and str(result[key]['id']) != str(tag['id']):
                raise ValueError('Ambiguous tag name/alias: ' + name)
            result[key] = tag
    return result


def managed_names(settings, maps):
    """Only outputs of enabled rules may be reclaimed as managed attributes."""
    names = set()
    for key, rules in maps.items():
        if key == 'age':
            names.update(target for _, _, target in rules)
        else:
            names.update(rules.values())
    if settings['tattoos']:
        names.add(settings['tattooTag'].strip() or 'Inked')
        if not settings.get('tattooLevelMap'):
            names.add(settings['veryInkedTag'].strip() or 'Very Inked')
    if settings['piercings']:
        names.add(settings['piercingTag'].strip() or 'Piercing')
    return names


def desired(performer, settings, maps):
    tags, unknown = {}, []
    for key, field in [('country','country'), ('ethnicity','ethnicity'), ('hair','hair_color'), ('eyes','eye_color'),
                       ('breasts','fake_tits'), ('body', 'custom_fields'),
                       ('breastSize', 'custom_fields')]:
        if not settings[key]:
            continue
        if key in ('body', 'breastSize'):
            field_name = settings[key + 'Field'] or {'body':'Body Type', 'breastSize':'Breast Size'}[key]
            values = performer.get('custom_fields') or {}
            value = next((v for k,v in values.items() if normalized(k) == normalized(field_name)), '')
        else:
            value = performer.get(field)
        key_value = normalized(value)
        if key_value in NEGATIVE:
            continue
        targets = hair_targets(value, maps[key]) if key == 'hair' else [maps[key].get(key_value)]
        targets = [target for target in targets if target]
        if targets:
            for target in targets:
                tags.setdefault(target, []).append('%s=%s' % (key, value))
        else:
            unknown.append('%s=%s' % (key, value))
    if settings['tattoos']:
        values = performer.get('custom_fields') or {}
        field_name = settings['tattooLevelField'].strip() or 'Tattoo Level'
        level = next((normalized(v) for k,v in values.items()
                      if normalized(k) == normalized(field_name)), '')
        description = normalized(performer.get('tattoos'))
        # Explicit unified dropdown values override any legacy custom level.
        # Other legacy descriptions/empty values retain the old level fallback.
        if description == 'no ink':
            level = ''
        elif description in {'inked', 'very inked'}:
            level = description
        level_rules = maps.get('tattooLevel')
        if description not in NEGATIVE or level in (level_rules or {'inked', 'very inked'}):
            tags.setdefault(settings['tattooTag'].strip() or 'Inked', []).append('tattoos supplied or selected')
        if level_rules and level in level_rules:
            tags.setdefault(level_rules[level], []).append('Tattoo Level=' + level)
        elif level_rules and level and level not in NEGATIVE:
            unknown.append('tattooLevel=' + level)
        elif not level_rules and level == 'very inked':
            tags.setdefault(settings['veryInkedTag'].strip() or 'Very Inked', []).append('Tattoo Level=Very Inked')
        elif not level_rules and level and level not in NEGATIVE and level != 'inked':
            unknown.append('tattooLevel=' + level)
    for key, field, setting, default in [('piercings','piercings','piercingTag','Piercing')]:
        if settings[key] and normalized(performer.get(field)) not in NEGATIVE:
            tags.setdefault(settings[setting].strip() or default, []).append(field + ' supplied')
    if settings.get('age'):
        age = performer_age(performer)
        if age is not None:
            for low, high, target in maps['age']:
                if low <= age <= high:
                    approximate = any(re.fullmatch(r'\d{4}', str(performer.get(field) or '').strip())
                                      for field in ('birthdate', 'death_date'))
                    tags.setdefault(target, []).append('age=%s (birthdate=%s)%s' %
                        (age, performer['birthdate'], ' – year-only birthdate, approximate age' if approximate else ''))
                    break
        elif performer.get('birthdate'):
            unknown.append('age: invalid birthdate (use YYYY or YYYY-MM-DD) or outside 18–120 years')
    return tags, unknown


class API(BaseAPI):
    def performer(self, identifier):
        return self.gql('query($id:ID!){findPerformer(id:$id){%s}}' % FIELDS,
                        {'id': str(identifier)})['findPerformer']

    def performers(self):
        page = 1
        while True:
            items = self.gql('query($p:Int!){findPerformers(filter:{page:$p,per_page:100,'
                             'sort:"id",direction:ASC}){performers{%s}}}' % FIELDS,
                             {'p': page})['findPerformers']['performers']
            yield from items
            if len(items) < 100:
                break
            page += 1

    def tags(self):
        page = 1
        while True:
            items = self.gql('query($p:Int!){findTags(filter:{page:$p,per_page:100,'
                             'sort:"id",direction:ASC}){tags{id name aliases}}}',
                             {'p': page})['findTags']['tags']
            yield from items
            if len(items) < 100:
                break
            page += 1

    def create_tag(self, name):
        return self.gql('mutation($i:TagCreateInput!){tagCreate(input:$i){id name aliases}}',
                        {'i': {'name': name}})['tagCreate']

    def remove(self, identifier, ids):
        self.gql('mutation($i:BulkPerformerUpdateInput!){bulkPerformerUpdate(input:$i){id}}',
                 {'i': {'ids': [str(identifier)], 'tag_ids': {'mode': 'REMOVE', 'ids': sorted(ids)}}})

    def update_fields(self, identifier, updates):
        # Partial merge preserves unrelated custom fields and concurrent edits to them.
        return self.gql('mutation($i:PerformerUpdateInput!){performerUpdate(input:$i){%s}}' % FIELDS,
                        {'i': {'id': str(identifier), 'custom_fields': {'partial': updates}}})['performerUpdate']

    def update_native_fields(self, identifier, updates):
        allowed = {'ethnicity', 'fake_tits', 'piercings'}
        if not updates or set(updates) - allowed:
            raise ValueError('Unexpected native performer field update.')
        return self.gql('mutation($i:PerformerUpdateInput!){performerUpdate(input:$i){%s}}' % FIELDS,
                        {'i': {'id': str(identifier), **updates}})['performerUpdate']

    def update_urls(self, identifier, urls):
        return self.gql('mutation($i:PerformerUpdateInput!){performerUpdate(input:$i){%s}}' % FIELDS,
                        {'i': {'id': str(identifier), 'urls': urls}})['performerUpdate']

    def schedule(self):
        return self.gql('mutation($id:ID!,$name:String!){runPluginTask(plugin_id:$id,task_name:$name)}',
                        {'id': PLUGIN_ID, 'name': TASK_NAME})['runPluginTask']


class Worker:
    def __init__(self, api, settings, state, preview=False):
        self.api, self.settings, self.state, self.preview = api, settings, state, preview
        self.maps = build_maps(settings)
        self.body_inference = self.cup_inference = None
        self.bust_inference = self.shape_inference = None
        self.measurement_units = 'auto'
        if settings.get('inferBody'):
            if not settings['body']:
                raise ValueError('Enable Body Type tagging before automatic body-type inference.')
            self.body_inference = body_rules(settings.get('bodyInferenceRules') or DEFAULT_BODY_RULES)
            for _, target, _ in self.body_inference:
                if normalized(target) not in self.maps['body']:
                    raise ValueError('Automatic body type is not a value in the Body Type mapping: ' + target)
        if settings.get('inferBreastSize'):
            if not settings['breastSize']:
                raise ValueError('Enable Breast Size → tag before automatic breast size.')
            self.cup_inference = mapping(settings.get('cupInferenceMap') or DEFAULT_CUP_MAP)
            for cup, target in self.cup_inference.items():
                if not re.fullmatch(r'[a-z]{1,4}', cup) or normalized(target) not in self.maps['breastSize']:
                    raise ValueError('Cup rules must use cup=existing breast-size value: ' + cup + '=' + target)
        if settings.get('inferBreastNumeric') or settings.get('inferBodyMeasurements'):
            self.measurement_units = unit_mode(settings.get('measurementUnits'))
        for flag, family, key, default, allowed, attribute in (
                ('inferBreastNumeric', 'breastSize', 'bustInferenceRules', DEFAULT_BUST_RULES, {'bust'}, 'bust_inference'),
                ('inferBodyMeasurements', 'body', 'shapeInferenceRules', DEFAULT_SHAPE_RULES, SHAPE_FIELDS, 'shape_inference')):
            if not settings.get(flag):
                continue
            if not settings[family]:
                raise ValueError('Enable the attribute → tag rule before its numeric measurement rule: ' + family)
            rules = measurement_rules(settings.get(key) or default, allowed)
            for _, target, _ in rules:
                if normalized(target) not in self.maps[family]:
                    raise ValueError('Measurement result is not a source value in the attribute mapping: ' + target)
            setattr(self, attribute, rules)
        all_tags = list(api.tags())
        self.catalog = catalog_index(all_tags)
        self.tag_labels_by_id = {str(tag['id']): [tag['name'], *(tag.get('aliases') or [])]
                                 for tag in all_tags}
        self.count = self.changed = 0

    def normalize_native_fields(self, performer):
        if not self.preview:
            performer = self.api.performer(performer['id'])
            if not performer:
                return None, False, []
        owned = self.state.inherited('Performer', performer['id'])
        updates, warnings = native_field_plan(performer, self.tag_labels_by_id, owned)
        if not updates:
            return performer, False, warnings
        for field, value in updates.items():
            log('%s performer #%s: %s=%s' % (
                'PLANNED FIELD' if self.preview else 'SAVING FIELD', performer['id'], field, value))
        if self.preview:
            return {**performer, **updates}, True, warnings
        updated = self.api.update_native_fields(performer['id'], updates)
        if not updated:
            raise RuntimeError('performerUpdate returned no saved object for native fields.')
        return updated, True, warnings

    def infer_fields(self, performer):
        if not self.preview:
            performer = self.api.performer(performer['id'])
            if not performer:
                return None, False
        owned = self.state.inferred(performer['id'])
        updates = {}
        for family, default in [('body', 'Body Type'), ('breastSize', 'Breast Size')]:
            primary = self.body_inference if family == 'body' else self.cup_inference
            numeric = self.shape_inference if family == 'body' else self.bust_inference
            if primary is None and numeric is None:
                continue
            field = str(self.settings.get(family + 'Field') or default).strip() or default
            target, reason = (infer_body(performer, primary) if family == 'body' else
                              infer_cup(performer.get('measurements'), primary)) if primary is not None else (None, 'primary measurement rule disabled')
            if target is None and numeric is not None:
                incomplete = (positive_number(performer.get('height_cm'), 300) is None or
                              positive_number(performer.get('weight'), 500) is None)
                if family == 'breastSize' or incomplete:
                    target, reason = infer_measurements(performer.get('measurements'), numeric, self.measurement_units)
                else:
                    reason = 'measurement fallback is used only when height or weight is missing/invalid'
                    if primary is None:
                        if self.preview:
                            log('SKIPPING #%s: %s' % (performer['id'], reason))
                        continue
            key, value, action = field_plan(performer, field, owned, target)
            if action == 'manual value preserved':
                if not self.preview and key in owned:
                    self.state.set_inferred(performer['id'], key, None)
                if self.preview:
                    log('KEEPING #%s: %s is manually selected.' % (performer['id'], key))
                continue
            if value is None:
                if not target and self.preview:
                    log('SKIPPING #%s: %s; %s' % (performer['id'], key, reason))
                continue
            updates[key] = value
            log('%s performer #%s: %s=%s (%s)' % ('PLANNED FIELD' if self.preview else 'SAVING FIELD',
                performer['id'], key, value or 'Ej angivet', reason))
        bra_field = str(self.settings.get('braSizeField') or 'Bra Size').strip() or 'Bra Size'
        bra_target, bra_reason = infer_bra_size(performer.get('measurements'))
        bra_key, bra_value, bra_action = field_plan(performer, bra_field, owned, bra_target)
        if bra_action == 'manual value preserved':
            if not self.preview and bra_key in owned:
                self.state.set_inferred(performer['id'], bra_key, None)
        elif bra_value is not None:
            updates[bra_key] = bra_value
            log('%s performer #%s: %s=%s (%s)' % (
                'PLANNED FIELD' if self.preview else 'SAVING FIELD', performer['id'],
                bra_key, bra_value or 'Not set', bra_reason))
        if not updates:
            return performer, False
        if self.preview:
            return {**performer, 'custom_fields': {**(performer.get('custom_fields') or {}), **updates}}, True
        # Persist ownership before mutation: nested update hooks cannot lose it.
        for key, value in updates.items():
            self.state.set_inferred(performer['id'], key, value)
        try:
            updated = self.api.update_fields(performer['id'], updates)
            if not updated:
                raise RuntimeError('performerUpdate returned no saved object.')
        except Exception:
            # A timeout may occur after commit. Reconcile rather than assuming rollback.
            current = self.api.performer(performer['id'])
            fields = (current or {}).get('custom_fields') or {}
            for key, value in updates.items():
                if str(fields.get(key) or '') != value:
                    self.state.set_inferred(performer['id'], key, owned.get(key))
            raise
        for key, value in updates.items():
            if not value:
                self.state.set_inferred(performer['id'], key, None)
        return updated, True

    def clean_metadata(self, performer):
        original = performer.get('urls') or []
        cleaned = clean_urls(original)
        if cleaned == original:
            return performer, False
        if not self.preview:
            # Re-read before replacing this list; never write a stale batch copy.
            performer = self.api.performer(performer['id'])
            if not performer:
                return None, False
            original = performer.get('urls') or []
            cleaned = clean_urls(original)
            if cleaned == original:
                return performer, False
        removed = len(original) - len(cleaned)
        log('%s performer #%s: remove %s empty/root-only social URL(s).' %
            ('PLANNED URL CLEANUP' if self.preview else 'URL CLEANUP', performer['id'], removed))
        if self.preview:
            return {**performer, 'urls': cleaned}, True
        updated = self.api.update_urls(performer['id'], cleaned)
        if not updated:
            raise RuntimeError('performerUpdate returned no saved object for URL cleanup.')
        return updated, True

    def process(self, performer):
        if not performer:
            return
        original_fields = dict(performer.get('custom_fields') or {})
        original_native = {field: performer.get(field) for field in NATIVE_VALUE_MAPS}
        original_urls = list(performer.get('urls') or [])
        additions, missing_tags = [], []
        self.count += 1
        performer, native_changes, native_warnings = self.normalize_native_fields(performer)
        if not performer:
            return
        performer, field_changes = self.infer_fields(performer)
        if not performer:
            return
        performer, url_changes = self.clean_metadata(performer)
        if not performer:
            return
        wanted, unknown = desired(performer, self.settings, self.maps)
        unknown.extend(native_warnings)
        for value in unknown:
            log('No mapping for performer #%s: %s' % (performer['id'], value), 'w')
        existing = {str(t['id']) for t in performer['tags']}
        owned = self.state.inherited('Performer', performer['id'])
        target_ids, missing = set(), set()
        changes = False
        for name, reasons in wanted.items():
            tag = self.catalog.get(normalized(name))
            if tag is None:
                log('%s #%s: %s → %s (%s)' % ('PLANNED' if self.preview else 'MISSING',
                    performer['id'], ', '.join(reasons), name,
                    'create tag' if self.settings['createTags'] else 'skipped; tag creation disabled'))
                if self.preview:
                    missing_tags.append({'name': name, 'reasons': reasons, 'will_create': bool(self.settings['createTags'])})
                    changes |= self.settings['createTags']
                    continue
                if not self.settings['createTags']:
                    continue
                try:
                    tag = self.api.create_tag(name)
                except Exception:
                    # Another client may have created the same name concurrently.
                    refreshed = catalog_index(self.api.tags())
                    tag = refreshed.get(normalized(name))
                    if tag is None:
                        raise
                    self.catalog.update(refreshed)
                self.catalog.update(catalog_index([tag]))
            identifier = str(tag['id'])
            target_ids.add(identifier)
            if identifier not in existing:
                missing.add(identifier)
                additions.append({'id': identifier, 'name': tag['name'], 'reasons': reasons})
                log('%s performer #%s (%s): %s → %s' %
                    ('PLANNED' if self.preview else 'ADDING', performer['id'],
                     performer['name'], ', '.join(reasons), tag['name']))
        managed = set(owned)
        if self.settings.get('manageMappedTags'):
            managed.update(str(self.catalog[normalized(name)]['id']) for name in managed_names(self.settings, self.maps)
                           if normalized(name) in self.catalog)
        stale = (managed & existing) - target_ids if self.settings['removeStale'] else set()
        for identifier in stale:
            log('%s performer #%s: previously managed attribute tag #%s' %
                 ('PLANERAD BORTTAGNING' if self.preview else 'REMOVING', performer['id'], identifier))
        if missing or stale or changes or native_changes or field_changes or url_changes:
            self.changed += 1
        if self.preview:
            fields = performer.get('custom_fields') or {}
            names = {str(tag['id']): tag['name'] for tag in performer['tags']}
            return {'id': str(performer['id']), 'name': performer['name'],
                    'changed': bool(missing or stale or changes or native_changes or field_changes or url_changes),
                    'fields': ([{'field': key, 'before': original_native.get(key), 'after': performer.get(key)}
                                for key in NATIVE_VALUE_MAPS if original_native.get(key) != performer.get(key)] +
                               [{'field': key, 'before': original_fields.get(key), 'after': value}
                                for key, value in fields.items() if original_fields.get(key) != value]),
                    'urls': {'before': original_urls, 'after': performer.get('urls') or []} if url_changes else None,
                    'add_tags': additions, 'remove_tags': [{'id': key, 'name': names.get(key, key)} for key in sorted(stale)],
                    'missing_tags': missing_tags, 'warnings': unknown}
        if missing:
            self.state.remember('Performer', performer['id'], missing)
            try:
                self.api.add('Performer', performer['id'], missing)
            except Exception:
                current = self.api.performer(performer['id'])
                present = {str(t['id']) for t in (current or {}).get('tags', [])}
                self.state.forget('Performer', performer['id'], missing - owned - present)
                raise
        if stale:
            self.api.remove(performer['id'], stale)
            self.state.forget('Performer', performer['id'], stale)

    def drain(self):
        while True:
            hook = self.state.take()
            if hook is None:
                break
            try:
                self.process(self.api.performer(hook['id']))
            except Exception:
                self.state.enqueue(hook)
                raise


def selected_ids(value):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            raise ValueError('Selection must be an explicit JSON list of performer IDs.')
    if not isinstance(value, list) or not value or len(value) > 1000:
        raise ValueError('Select between 1 and 1000 performers. Empty selection never processes the whole library.')
    result = []
    for item in value:
        if isinstance(item, bool) or not re.fullmatch(r'[1-9]\d*', str(item)):
            raise ValueError('Invalid performer ID in selection: ' + str(item))
        identifier = str(item)
        if identifier not in result:
            result.append(identifier)
    return result


def main():
    payload = json.load(sys.stdin)
    args = payload.get('args') or {}
    hook = args.get('hookContext')
    mode = args.get('mode')
    scoped = mode in ('preview_selected', 'apply_selected', 'preview_inline')
    identifiers = selected_ids(args.get('performer_ids')) if scoped else None
    # Reject ambiguous modes instead of falling through to the pending queue.
    if not hook and mode not in ('preview', 'apply', 'queued', 'preview_selected', 'apply_selected', 'preview_inline'):
        raise ValueError('Unknown mode. Use the named plugin tasks.')
    # Own tag updates need no attribute recomputation (and must return immediately).
    if hook and '.Update.' in hook['type'] and hook.get('inputFields') and not (
            set(hook['inputFields']) & WATCHED):
        return {'output': 'No attribute change.'}
    api = API(payload['server_connection'])
    config = api.gql('{configuration{plugins}}')['configuration']['plugins'] or {}
    settings = {**DEFAULTS, **config.get(PLUGIN_ID, {})}
    if mode not in ('preview','apply','preview_selected','apply_selected','preview_inline') and not settings['automatic']:
        return {'output': 'Automation disabled.'}
    if mode == 'preview_inline':
        if hook:
            raise ValueError('Inline preview does not accept hooks.')
        if len(identifiers) > 25:
            raise ValueError('Inline preview accepts at most 25 performers per request.')
        state = PreviewState(ROOT / 'attribute-tags.sqlite3')
        try:
            worker = Worker(api, settings, state, preview=True)
            results = []
            for identifier in identifiers:
                try:
                    performer = api.performer(identifier)
                    results.append(worker.process(performer) if performer else
                                   {'id': identifier, 'error': 'Performer no longer exists.'})
                except Exception as error:
                    results.append({'id': identifier, 'error': str(error)})
            return {'output': {'version': 1, 'read_only': True, 'performers': results}}
        finally:
            state.close()
    state = State(ROOT / 'attribute-tags.sqlite3')
    try:
        if hook:
            state.enqueue(hook)
            schedule_pending(api, state, ROOT / 'attribute-tags.lock')
            return {'output': 'Attribute change queued.'}
        with exclusive_lock(ROOT / 'attribute-tags.lock'):
            if not scoped and mode != 'preview':
                state.release_job()
            worker = Worker(api, settings, state, preview=mode in ('preview', 'preview_selected'))
            if scoped:
                log('Scoped selection: %s performers. ID: %s' % (len(identifiers), ', '.join(identifiers)))
                for identifier in identifiers:
                    performer = api.performer(identifier)
                    if performer:
                        worker.process(performer)
                    else:
                        log('Performer #%s no longer exists; skipping.' % identifier, 'w')
            if mode in ('preview','apply'):
                for performer in api.performers():
                    worker.process(performer)
            if not scoped and not worker.preview and settings['automatic']:
                worker.drain()
        if not scoped and not worker.preview and settings['automatic'] and state.has_pending():
            schedule_pending(api, state, ROOT / 'attribute-tags.lock')
        summary = '%s performers checked, %s with %s changes.' % (
            worker.count, worker.changed, 'planned' if worker.preview else 'performed')
        log(summary)
        return {'output': summary}
    finally:
        state.close()



import sys as _lynx_sys
from pathlib import Path as _LynxPath
_lynx_sys.path.insert(0,str(_LynxPath(__file__).resolve().parents[2]))
from backend_adapter import adapt_api as _lynx_adapt
_lynx_adapt(API)

if __name__ == '__main__':
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    try:
        print(json.dumps(main(), ensure_ascii=False))
    except Exception as exc:
        log(str(exc), 'e')
        print(json.dumps({'error': str(exc)}))
        sys.exit(1)
