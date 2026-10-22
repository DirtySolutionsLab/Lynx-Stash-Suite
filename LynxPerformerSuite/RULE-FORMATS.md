# Editable rule formats

These are library categorization heuristics, not reliable anatomical/medical assessments. Preview before applying. Existing custom rules are preserved; consolidation does not replace them with new defaults.

## Value-to-tag mappings

```text
Blonde=Blond;Brunette=Brown Hair;Brown=Brown Hair;Black=Black Hair
```

Separate rules with semicolons. A custom list replaces the built-in mapping list. The left side is the metadata/dropdown value; the right side is the desired tag. Existing aliases resolve to their canonical tag instead of creating duplicates. Country mappings can keep language aliases such as `SE=Swedish;Sweden=Swedish;Sverige=Swedish`.

Dropdown-only choice lists use `choice;another choice`. Field-name settings refer to custom-field storage, not just a display label; do not casually change them on an existing library.

## Body type from height/weight

```text
height<=160,weight<=50=Petite
```

Supported fields: `height` in cm and `weight` in kg. Operators: `<`, `<=`, `>`, `>=`, `==`. Separate conditions with commas, rules with semicolons. First matching rule wins. A condition with missing required data cannot match. Add your own ordered rules rather than assuming weight alone determines a body shape.

## Body shape from measurements

```text
waist_bust<=0.8,waist_hip<=0.8,bust_hip>=0.85,bust_hip<=1.15=Curvy
```

Supported fields: `bust`, `waist`, `hips` in cm, and ratios `waist_bust`, `waist_hip`, `bust_hip`. Unit mode: `auto`, `cm`, or `inches`. Automatic detection can reject ambiguous values. Explicit units are preferable.

Numeric `90-60-90` is a bust–waist–hip triple. A notation such as `32A-25-33` contains a **bra band** and cup code; 32 is not a trustworthy bust circumference. The existing engine does not reinterpret that band as bust circumference merely to force a shape match.

## Breast-size categories

Cup mappings:

```text
AA=Small Tits;A=Small Tits;B=Normal Tits;C=Normal Tits;D=Big Tits;DD=Big Tits;DDD=Big Tits;E=Big Tits;F=Huge Tits
```

These are editable classification choices, not universal international cup conversions. Explicitly list repeated-letter sizes if you want them grouped together.

Numeric circumference rules:

```text
bust<85=Small Tits;bust<100=Normal Tits;bust<115=Big Tits;bust>=115=Huge Tits
```

This estimates a category from circumference; it does not calculate a bra cup. Full Bra Size remains a separate stored source value, such as `36E`.

## Age ranges

```text
18-19=18-19;20-29=20s;30-39=30s;40-49=40s;50-59=50s;60-69=60s;70+=70 Plus
```

Ranges are inclusive and must not overlap. Full dates use date-based age; a year-only birthdate uses an approximation. The engine refreshes when attributes/tasks are processed, not through a newly added midnight scheduler.
