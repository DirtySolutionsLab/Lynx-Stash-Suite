"""Bounded public Mature.nl requests. Standard library only; no gate bypass."""
import base64
import hashlib
import time
import re
import urllib.request
import urllib.error
from urllib.parse import urlsplit,urlunsplit,urlencode
from mature_core import BASE,Document,profile_url,portrait_url,parse_profile,search_results,next_page

def public_url(url):
    p=urlsplit(url)
    if p.scheme!='https' or p.hostname not in ('www.mature.nl','mature.nl') or p.username or p.password or p.port not in (None,443):
        raise ValueError('Only public HTTPS Mature.nl requests are allowed.')
    if p.path.startswith('/en/model/'):
        profile_url(url)
    elif not re.fullmatch(r'/en/models(?:/[1-9]\d*)?/?',p.path):
        raise ValueError('Only the English public model directory and model profiles are allowed.')
    return url

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        if urlsplit(req.full_url).hostname=='s.cdn.mature.nl':
            identifier=urlsplit(req.full_url).path.rsplit('/',1)[-1].split('.')[0];portrait_url(newurl,identifier)
        else:
            public_url(newurl)
            if '/model/' in urlsplit(req.full_url).path:
                if profile_url(req.full_url).split('/')[5]!=profile_url(newurl).split('/')[5]:
                    raise ValueError('The profile redirect changed the model ID.')
        return super().redirect_request(req,fp,code,msg,headers,newurl)

class Client:
    def __init__(self):self.opener=urllib.request.build_opener(SafeRedirect())
    def fetch(self,url,timeout=15):
        public_url(url)
        request=urllib.request.Request(url,headers={'User-Agent':'LynxScrapingSuite-MatureNL/1.0 public-metadata','Accept':'text/html'})
        try:
            with self.opener.open(request,timeout=timeout) as r:
                public_url(r.url);data=r.read(3_000_001)
                if len(data)>3_000_000:raise ValueError('Page exceeds the metadata size limit.')
                html=data.decode(r.headers.get_content_charset() or 'utf-8',errors='replace')
        except (urllib.error.URLError,TimeoutError) as error:raise ValueError('Could not read the public Mature.nl page: '+str(error)) from error
        headings=' '.join(n.text() for n in Document(html).root.walk() if n.tag in ('title','h1','h2')).casefold()
        if any(s in headings for s in ('access denied','verify you are human','security check','age verification')):
            raise ValueError('Mature.nl requires an access check. Nothing was saved; this scraper does not bypass checks.')
        return html
    def profile(self,url):
        url=profile_url(url);return parse_profile(self.fetch(url),url)
    def search(self,query):
        query=' '.join(str(query).split())
        if not 1<=len(query)<=100:raise ValueError('Enter a performer name of 1–100 characters.')
        url=BASE+'/en/models/1?'+urlencode({'name':query});started=time.monotonic();results={};warning=''
        for _ in range(3):
            remaining=40-(time.monotonic()-started)
            if remaining<2:warning='Search time limit reached. Paste the profile URL if the correct model is missing.';break
            html=self.fetch(url,timeout=min(15,remaining))
            results.update((r['url'],r) for r in search_results(html,query))
            following=next_page(html,url)
            if not following:break
            url=following
        else:warning='Search limited to three result pages. Use a more specific name or profile URL.'
        return {'results':list(results.values()),'warning':warning}
    def image(self,url):
        portrait_url(url)
        request=urllib.request.Request(url,headers={'User-Agent':'LynxScrapingSuite-MatureNL/1.0 public-metadata','Accept':'image/jpeg,image/png,image/webp'})
        try:
            with self.opener.open(request,timeout=15) as r:
                identifier=urlsplit(url).path.rsplit('/',1)[-1].split('.')[0];portrait_url(r.url,identifier);data=r.read(5_000_001)
        except (urllib.error.URLError,TimeoutError) as e:raise ValueError('Could not read the public profile image.') from e
        if not data or len(data)>5_000_000:raise ValueError('Portrait is empty or exceeds 5 MB.')
        if data.startswith(b'\xff\xd8\xff'):mime='image/jpeg'
        elif data.startswith(b'\x89PNG\r\n\x1a\n'):mime='image/png'
        elif data[:4]==b'RIFF' and data[8:12]==b'WEBP':mime='image/webp'
        else:raise ValueError('Portrait response is not a supported image.')
        # The site's signed query changes over time. Stable path + content hash
        # identifies an image across fresh previews/imports without persisting tokens.
        p=urlsplit(url);identity=urlunsplit((p.scheme,p.netloc,p.path,'',''))
        return {'url':identity,'sha256':hashlib.sha256(data).hexdigest(),
                'data_uri':'data:'+mime+';base64,'+base64.b64encode(data).decode('ascii')}
