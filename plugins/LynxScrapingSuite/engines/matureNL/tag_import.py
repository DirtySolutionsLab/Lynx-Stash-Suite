"""Add reviewed source tags and retire only matching legacy source fields."""

LEGACY = {
    'age_range': ('ageField', 'Mature.nl Age Range', 'Age'),
    'height_category': ('heightField', 'Mature.nl Height Category', 'Bodylength'),
    'ethnicity': ('skinField', 'Mature.nl Skin Color', 'Skincolor'),
    'body_mods': ('modsField', 'Mature.nl Body Mods', 'Body mods'),
}


def normalized(value):
    return ' '.join(str(value).split()).casefold()


def matches(tags, name):
    wanted = normalized(name)
    found = {str(tag['id']): tag for tag in tags
             if any(normalized(v) == wanted for v in [tag['name'], *(tag.get('aliases') or [])])}
    if len(found) > 1:
        raise ValueError('More than one tag matches "' + name + '". Resolve the duplicate names/aliases first.')
    return next(iter(found.values()), None)


def prepare(current, profile, settings, custom_names):
    prepared = dict(current)
    tag_fields = profile.get('tag_fields', {})
    for key, name in tag_fields.items():
        prepared[key] = name if matches(current.get('tags') or [], name) else None
    # import_input validates these virtual fields with the same snapshot rules as native fields.
    virtual = {**profile, 'fields': {**profile['fields'], **tag_fields}}
    cleanup = {}
    legacy_fields = {}
    saved = current.get('custom_fields') or {}
    protected = set(custom_names.values())
    for key, (setting, default, source_label) in LEGACY.items():
        raw = profile.get('original', {}).get(source_label)
        names = {default, str(settings.get('mature__' + setting) or default).strip()}
        for name in sorted(names - protected):
            if raw and saved.get(name) == raw:
                cleanup.setdefault(key, []).append(name)
                legacy_fields[name] = raw
    prepared['legacy_fields'] = legacy_fields
    return prepared, virtual, cleanup


def catalog(api):
    return api.gql('{findTags(filter:{per_page:-1}){tags{id name aliases}}}')['findTags']['tags']


def resolve_tags(api, names):
    tags = catalog(api)
    result = []
    for name in dict.fromkeys(names):
        match = matches(tags, name)
        if not match:
            try:
                match = api.gql('mutation($input:TagCreateInput!){tagCreate(input:$input){id name aliases}}',
                                {'input': {'name': name}})['tagCreate']
                tags.append(match)
            except ValueError:
                # Another request may have created the tag or registered an alias meanwhile.
                tags = catalog(api)
                match = matches(tags, name)
                if not match:
                    raise
        result.append(str(match['id']))
    return result


def finish_import(api, current, profile, settings, custom_names, args, update, cleanup):
    chosen = args['fields']
    expected = args.get('expected') or {}
    remove = [name for key in chosen for name in cleanup.get(key, [])]
    for name in remove:
        if expected.get('legacy_fields', {}).get(name) != (current.get('custom_fields') or {}).get(name):
            raise ValueError('A legacy source field changed. Preview again.')
    names = []
    for key, value in profile.get('tag_fields', {}).items():
        update.pop(key, None)
        if key in chosen and not matches(current.get('tags') or [], value):
            names.append(value)
    if names:
        ids = resolve_tags(api, names)
        # Resolve/create tags first, then re-read the performer so unrelated recent tags are retained.
        fresh = api.performer(current['id'])
        for key in ('name', 'country', 'ethnicity', 'details', 'urls', 'custom_fields', 'image_path', 'updated_at'):
            if fresh.get(key) != current.get(key):
                raise ValueError('The performer changed while tags were resolved. Preview again.')
        existing_ids = [str(t['id']) for t in fresh.get('tags') or []]
        combined = list(dict.fromkeys([*existing_ids, *ids]))
        if combined != existing_ids:
            update['tag_ids'] = combined
    if remove:
        update.setdefault('custom_fields', {})['remove'] = sorted(set(remove))
    return update
