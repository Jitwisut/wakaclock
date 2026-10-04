"""Minimal SigV4 client for the lab bucket, never a configured hosted account."""
import hashlib
import hmac
import urllib.error
import urllib.request
from datetime import datetime, timezone

BUCKET = 'receipt-validation'


def request(settings, method, key='', body=b''):
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    day = stamp[:8]
    path = '/' + BUCKET + ('/' + key if key else '')
    host = '127.0.0.1:59000'
    payload = hashlib.sha256(body).hexdigest()
    headers = {'host': host, 'x-amz-content-sha256': payload, 'x-amz-date': stamp}
    names = ';'.join(sorted(headers))
    canonical_headers = ''.join(name + ':' + headers[name] + '\n' for name in sorted(headers))
    canonical = '\n'.join([method, path, '', canonical_headers, names, payload])
    scope = day + '/us-east-1/s3/aws4_request'
    string = '\n'.join(['AWS4-HMAC-SHA256', stamp, scope, hashlib.sha256(canonical.encode()).hexdigest()])
    signing = ('AWS4' + settings['storage_password']).encode()
    for value in (day, 'us-east-1', 's3', 'aws4_request'):
        signing = hmac.new(signing, value.encode(), hashlib.sha256).digest()
    signature = hmac.new(signing, string.encode(), hashlib.sha256).hexdigest()
    headers['Authorization'] = f'AWS4-HMAC-SHA256 Credential=receipt_validation/{scope}, SignedHeaders={names}, Signature={signature}'
    req = urllib.request.Request('http://' + host + path, data=body if method == 'PUT' else None,
                                 headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, b''
