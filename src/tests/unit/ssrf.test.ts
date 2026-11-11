import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUrl } from '../../lib/security/ssrf.ts';

test('SSRF Guard: blocks dangerous private IPs and schemes', async () => {
  // Test invalid schemes
  const fileScheme = await validateUrl('file:///etc/passwd');
  assert.equal(fileScheme.valid, false);
  assert.match(fileScheme.error!, /Only http and https/);

  const gopherScheme = await validateUrl('gopher://127.0.0.1:70');
  assert.equal(gopherScheme.valid, false);

  // Test loopback and local hostnames
  const localhost = await validateUrl('http://localhost:8080');
  assert.equal(localhost.valid, false);
  assert.match(localhost.error!, /local and internal hostnames/);

  const dotLocal = await validateUrl('http://myservice.local/test');
  assert.equal(dotLocal.valid, false);

  // Test private IP literal addresses
  const privateIp10 = await validateUrl('http://10.0.0.1/admin');
  assert.equal(privateIp10.valid, false);

  const privateIp192 = await validateUrl('http://192.168.1.1/router');
  assert.equal(privateIp192.valid, false);

  const privateIp172 = await validateUrl('http://172.16.5.4/');
  assert.equal(privateIp172.valid, false);

  // Test AWS/Cloud metadata address
  const awsMetadata = await validateUrl('http://169.254.169.254/latest/meta-data/');
  assert.equal(awsMetadata.valid, false);

  // Test loopback IP
  const loopback = await validateUrl('http://127.0.0.1:3000');
  assert.equal(loopback.valid, false);
});

test('SSRF Guard: permits public https web URLs', async () => {
  const validYoutube = await validateUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { skipDns: true });
  assert.equal(validYoutube.valid, true);
  assert.equal(validYoutube.sanitizedUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  const validSoundcloud = await validateUrl('https://soundcloud.com/artist/track', { skipDns: true });
  assert.equal(validSoundcloud.valid, true);
});
