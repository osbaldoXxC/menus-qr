import gzip
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'ssm-deploy.sh'

class SsmDeploymentTest(unittest.TestCase):
    def run_deploy(self, health_fails=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('bin', 'app', 'backups'):
                (root / name).mkdir()
            image = root / 'image.gz'
            image.write_bytes(gzip.compress(b'synthetic image archive'))
            digest = hashlib.sha256(image.read_bytes()).hexdigest()
            source = SCRIPT.read_text().replace('{{ ReleaseId }}', 'a'*40 + '/1-1').replace('{{ ImageSha256 }}', digest).replace('{{ Operation }}', 'deploy')
            source = source.replace('base=/home/ubuntu/app', f'base={root}/app').replace('backup=/mnt/ebs/mexxicanmx-backups', f'backup={root}/backups').replace('/snap/bin/aws', 'aws')
            script = root / 'ssm.sh'
            script.write_text(source, newline='\n')
            docker = r'''#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "$MOCK_LOG"
case "$*" in
  *'ps -q backend'*) echo backend-id ;;
  *'ps -q ml-service'*) echo ml-id ;;
  *'ps -q ai-engine'*) echo ai-id ;;
  inspect*) echo sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ;;
  exec*) echo synthetic-sql ;;
  load*) cat >/dev/null ;;
esac
'''
            aws = '#!/usr/bin/env bash\ncp "$MOCK_IMAGE" "$4"\n'
            curl = '#!/usr/bin/env bash\n[[ "${HEALTH_FAIL:-0}" != 1 ]]\n'
            sleep = '#!/usr/bin/env bash\nexit 0\n'
            for name, content in (('docker', docker), ('aws', aws), ('curl', curl), ('sleep', sleep)):
                path = root / 'bin' / name
                path.write_text(content, newline='\n')
                path.chmod(0o755)
            env = dict(os.environ, PATH=f"{root / 'bin'}:{os.environ['PATH']}", MOCK_LOG=str(root/'calls'), MOCK_IMAGE=str(image), HEALTH_FAIL='1' if health_fails else '0')
            result = subprocess.run(['bash', str(script)], cwd=root, env=env, capture_output=True, text=True)
            calls = (root/'calls').read_text()
            backup = root/'backups'/('a'*40)/'1-1'/'postgres.sql.gz'
            return result, calls, gzip.decompress(backup.read_bytes()) if backup.exists() else b''

    def test_deploy_creates_verified_database_backup(self):
        result, calls, backup = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(backup, b'synthetic-sql\n')
        self.assertEqual(calls.count(' up -d --no-deps '), 1)

    def test_failed_health_restores_previous_images(self):
        result, calls, backup = self.run_deploy(health_fails=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(backup, b'synthetic-sql\n')
        self.assertEqual(calls.count(' up -d --no-deps '), 2)
        self.assertIn('restoring previous application images', result.stderr)
