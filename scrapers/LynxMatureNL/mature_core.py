"""Public Mature.nl metadata parsing. No network, inferred dates or Stash writes."""
from html.parser import HTMLParser
import re
from urllib.parse import urljoin, urlsplit, urlunsplit, unquote

BASE='https://www.mature.nl'
EMPTY={'','–','—','-','unknown','n/a','not specified'}

def profile_url(value):
    p=urlsplit(str(value))
    if (p.scheme!='https' or p.hostname not in ('mature.nl','www.mature.nl') or p.username or p.password
            or p.port not in (None,443) or not re.fullmatch(r'/(?:en|nl|de|fr)/model/[1-9]\d*/[A-Za-z0-9%_.-]+/?',p.path)):
        raise ValueError('Enter an HTTPS Mature.nl model profile URL with a model ID.')
    parts=p.path.rstrip('/').split('/');parts[1]='en'
    return urlunsplit(('https','www.mature.nl','/'.join(parts),'',''))

def portrait_url(value,identifier=None):
    p=urlsplit(str(value))
    match=re.fullmatch(r'/model_mugshot/\d+/([1-9]\d*)\.(?:jpg|jpeg|png|webp)',p.path,re.I)
    if (p.scheme!='https' or p.hostname!='s.cdn.mature.nl' or p.username or p.password or p.port not in (None,443)
            or not match or identifier is not None and match[1]!=str(identifier)):
        raise ValueError('Only the public Mature.nl portrait for the selected model is allowed.')
    return value

class Node:
    def __init__(self,tag='',attrs=()):self.tag=tag;self.attrs=dict(attrs);self.children=[]
    def text(self):return ''.join(c if isinstance(c,str) else c.text() for c in self.children)
    def walk(self):
        yield self
        for c in self.children:
            if isinstance(c,Node):yield from c.walk()
    def cls(self,name):return name in (self.attrs.get('class') or '').split()

class Document(HTMLParser):
    VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr','data-src','data-img'}
    def __init__(self,html):
        super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root];self.feed(html);self.close()
    def handle_starttag(self,tag,attrs):
        n=Node(tag,attrs);self.stack[-1].children.append(n)
        if tag=='br':self.stack[-1].children.append('\n')
        if tag not in self.VOID:self.stack.append(n)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:del self.stack[i:];return
    def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.handle_endtag(tag)
    def handle_data(self,data):self.stack[-1].children.append(data)

def clean(text):return ' '.join(str(text).split()).strip()

def search_results(html,query):
    result={};words=clean(query).casefold().split()
    for n in Document(html).root.walk():
        if n.tag!='a':continue
        try:url=profile_url(urljoin(BASE,n.attrs.get('href') or ''))
        except ValueError:continue
        name=clean(n.text())
        if name and all(w in name.casefold() for w in words):result[url]={'name':name,'url':url}
    return sorted(result.values(),key=lambda r:(r['name'].casefold()!=clean(query).casefold(),r['name'].casefold()))

def next_page(html,current):
    current_p=urlsplit(current);path=current_p.path.rstrip('/');match=re.fullmatch(r'/en/models(?:/(\d+))?',path)
    if not match:return None
    wanted=int(match[1] or 1)+1
    for n in Document(html).root.walk():
        if n.tag!='a':continue
        p=urlsplit(urljoin(BASE,n.attrs.get('href') or ''))
        if p.hostname in ('www.mature.nl','mature.nl') and p.path.rstrip('/')==f'/en/models/{wanted}':
            return urlunsplit(('https','www.mature.nl',p.path,current_p.query,''))
    return None

def parse_profile(html,url):
    url=profile_url(url);identifier=url.split('/')[5];nodes=list(Document(html).root.walk())
    titles=[clean(n.text()) for n in nodes if n.tag=='h1' and clean(n.text())]
    if not titles:raise ValueError('No public model name found. The page may require an access check.')
    name=titles[0]
    if any(k in name.casefold() for k in ('access denied','verify','security check','not found','age verification')):
        raise ValueError('The public profile is unavailable or requires an access check.')
    original={}
    for n in nodes:
        if not n.cls('form-group'):continue
        label=next((c for c in n.children if isinstance(c,Node) and c.tag=='span' and c.cls('col-accent')),None)
        if label is not None:
            key=clean(label.text());value=clean(''.join(c if isinstance(c,str) else c.text() for c in n.children if c is not label))
            if key.casefold() in {'age','nationality','bodytype','bodylength','skincolor','breasts','body mods'}:original[key]=value
    if not original:raise ValueError('Public profile attributes were not found. Refusing to scrape an unrelated page.')
    fields={'name':name};custom={};tag_fields={}
    for label,key in [('Bodytype','body_type'),('Breasts','breast_size')]:
        value=original.get(label,'')
        if value.casefold() not in EMPTY:custom[key]=value
    for label,key,prefix in [('Age','age_range','Age '),('Bodylength','height_category',''),('Body mods','body_mods','Body mods: ')]:
        value=original.get(label,'')
        if value.casefold() not in EMPTY:tag_fields[key]=prefix+value
    # Explicit library convention: use the published skin-color label as ethnicity.
    skin=original.get('Skincolor','')
    if skin.casefold() not in EMPTY:fields['ethnicity']=skin
    country=original.get('Nationality','')
    if country.casefold() not in EMPTY:fields['country']=country
    # Text directly within boxes with no profile form rows is the public biography.
    biography=[]
    for n in nodes:
        if not n.cls('box-cnt') or any(c.cls('form-group') for c in n.walk()):continue
        value=n.text().strip()
        if name.casefold() in value.casefold() and len(clean(value))>100:
            value='\n'.join(clean(line) for line in value.splitlines() if clean(line))
            if value not in biography:biography.append(value)
    if biography:fields['details']='\n\n'.join(biography)[:30000]
    picture=None
    for n in nodes:
        if n.tag!='img':continue
        for key in ('data-src','src'):
            candidate=urljoin(BASE,n.attrs.get(key) or '')
            try:portrait_url(candidate,identifier);picture=candidate;break
            except ValueError:continue
        if picture:break
    return {'url':url,'fields':fields,'custom':custom,'tag_fields':tag_fields,'original':original,'image_url':picture,
            'warnings':['Age range, height category and body modifications are added as tags. The published Skincolor value is copied to Ethnicity. Age ranges remain source categories, not calculated current ages.']}
