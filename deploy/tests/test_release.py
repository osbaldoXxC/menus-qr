import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'publish-release.sh'

class ReleaseTest(unittest.TestCase):
    def run_release(self, fail=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'bin').mkdir()
            (root / 'tmp').mkdir()
            (root / 'tmp' / 'images.tar.gz').write_bytes(b'synthetic archive')
            for app in ('frontend-comensales', 'frontend-restaurantes', 'admin'):
                dist = root / app / 'dist'
                dist.mkdir(parents=True)
                (dist / 'index.html').write_text('new-index')
            mock = r'''#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "$MOCK_LOG"
if [[ "$1 $2" == 's3 cp' ]]; then
  src=$3; dst=$4
  if [[ "$src" == s3://*/index.html && "$dst" != s3://* ]]; then printf old-index > "$dst"; fi
  if [[ "${FAIL_INDEX:-0}" == 1 && "$src" == frontend-restaurantes/dist/index.html ]]; then exit 1; fi
elif [[ "$1 $2" == 'ssm send-command' ]]; then echo command-id
elif [[ "$1 $2" == 'ssm get-command-invocation' ]]; then echo Success
elif [[ "$1 $2" == 'cloudfront create-invalidation' ]]; then echo invalidation-id
fi
'''
            curl = r'''#!/usr/bin/env bash
set -eu
while [[ $# -gt 0 ]]; do
  if [[ "$1" == '-o' ]]; then printf new-index > "$2"; exit 0; fi
  shift
done
printf '{"status":"UP","database":"connected"}'
'''
            jq = '#!/usr/bin/env bash\nif [[ "$*" == *-cn* ]]; then echo "{}"; else cat >/dev/null; fi\n'
            for name, body in (('aws', mock), ('curl', curl), ('jq', jq)):
                file = root / 'bin' / name
                file.write_text(body, newline='\n')
                file.chmod(0o755)
            env = dict(os.environ, PATH=f"{root / 'bin'}:{os.environ['PATH']}",
                MOCK_LOG=str(root / 'calls'), FAIL_INDEX='1' if fail else '0',
                GITHUB_SHA='a'*40, GITHUB_RUN_ID='12', GITHUB_RUN_ATTEMPT='1', RUNNER_TEMP=str(root / 'tmp'),
                AWS_REGION='us-east-1', RELEASE_BUCKET='releases', DINER_BUCKET='diner',
                RESTAURANT_BUCKET='restaurant', ADMIN_BUCKET='admin', DINER_DISTRIBUTION='D1',
                RESTAURANT_DISTRIBUTION='D2', ADMIN_DISTRIBUTION='D3', DINER_URL='https://diner.test',
                RESTAURANT_URL='https://restaurant.test', ADMIN_URL='https://admin.test', API_URL='https://api.test')
            result = subprocess.run(['bash', str(SCRIPT)], cwd=root, env=env, capture_output=True, text=True)
            calls = (root / 'calls').read_text()
            return result, calls

    def test_success_and_versioned_staging(self):
        result, calls = self.run_release()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls.count('ssm send-command'), 1)
        self.assertIn('/releases/' + 'a'*40 + '/12-1/', calls)

    def test_failed_index_publish_restores_all_entrypoints_and_backend(self):
        result, calls = self.run_release(fail=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls.count('ssm send-command'), 2)
        for app in ('frontend-comensales', 'frontend-restaurantes', 'admin'):
            self.assertIn(f'{app}.html s3://', calls)
        self.assertIn('restoring prior entrypoints', result.stderr)

if __name__ == '__main__':
    unittest.main()
