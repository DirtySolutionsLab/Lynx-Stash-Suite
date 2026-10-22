import io
import ipaddress
import unittest
from unittest.mock import patch
import online_images as o
import missing_performer_images as p


class OnlineTests(unittest.TestCase):
    def test_block_local_addresses_and_non_web_urls(self):
        for url in ['file:///a', 'http://user:password@example.com/a', 'https://example.com:444/a']:
            with self.assertRaises(ValueError):
                o.public_target(url)
        for ip in ['127.0.0.1', '10.1.1.1', '192.168.1.1', '169.254.169.254', '::1', 'fc00::1', '100.64.0.1']:
            with patch.object(o.socket, 'getaddrinfo', return_value=[(2, 1, 6, '', (ip, 80))]):
                with self.assertRaises(ValueError):
                    o.public_target('http://example.com/image')

    def test_any_private_dns_answer_rejects_host(self):
        with patch.object(o.socket, 'getaddrinfo', return_value=[(2,1,6,'',('8.8.8.8',443)),(2,1,6,'',('127.0.0.1',443))]):
            with self.assertRaises(ValueError):
                o.public_target('https://example.com/image')

    def test_public_dns_address(self):
        with patch.object(o.socket, 'getaddrinfo', return_value=[(2,1,6,'',('8.8.8.8',443))]):
            parsed,port,address=o.public_target('https://example.com/image')
            self.assertEqual((parsed.hostname,port,address),('example.com',443,'8.8.8.8'))

    def download(self, body=b'\x89PNG\r\n\x1a\nabc', status=200, length=None, redirect=None):
        from unittest.mock import MagicMock
        connection=MagicMock()
        response=connection.getresponse.return_value
        response.status=status
        response.getheader.side_effect=lambda key: length if key=='Content-Length' else redirect if key=='Location' else None
        response.read.return_value=body
        with patch.object(o,'public_target',return_value=(o.urlsplit('https://example.com/a'),443,'8.8.8.8')),patch.object(o.http.client,'HTTPSConnection',return_value=connection):
            result=o.fetch_image('https://example.com/a',p.image_mime)
        headers=connection.request.call_args.kwargs['headers']
        self.assertNotIn('Cookie',headers)
        self.assertNotIn('ApiKey',headers)
        self.assertTrue(connection.close.called)
        return result

    def test_validated_image_download(self):
        self.assertTrue(self.download().startswith('data:image/png;base64,'))

    def test_size_and_format_limits(self):
        for kwargs in [{'length':str(o.MAX_BYTES+1)}, {'body':b'x'*(o.MAX_BYTES+1)}, {'body':b'<html>not an image</html>'}, {'status':403}]:
            with self.assertRaises((ValueError,RuntimeError)):
                self.download(**kwargs)

    def test_https_downgrade_refused(self):
        with self.assertRaises(ValueError):
            self.download(status=302,redirect='http://example.com/a')

    def test_redirect_limit(self):
        with self.assertRaisesRegex(ValueError,'Too many'):
            self.download(status=302,redirect='/other')

    def test_fetch_operation_does_not_create_client_or_run_assignment(self):
        stdin=io.StringIO('{"args":{"mode":"fetch_image","url":"https://example.com/a"}}')
        output=io.StringIO()
        with patch.object(p.sys,'stdin',stdin),patch.object(p.sys,'stdout',output),patch.object(o,'fetch_image',return_value='data:image/png;base64,abc'),patch.object(p,'Client') as client,patch.object(p,'run') as run:
            self.assertEqual(p.main(),0)
            client.assert_not_called();run.assert_not_called()
        self.assertIn('image',output.getvalue())


if __name__=='__main__':
    unittest.main()
