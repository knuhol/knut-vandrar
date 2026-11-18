"""Exercise real shell routing with fake Docker/SSH executables, never live services."""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPOSITORY = Path(__file__).resolve().parents[2]


@pytest.fixture()
def scripts(tmp_path: Path) -> tuple[Path, dict[str, str], Path]:
    root = tmp_path / "checkout"
    (root / "scripts").mkdir(parents=True)
    for name in ("media-common.sh", "media-export.sh", "media-import.sh"):
        shutil.copy2(REPOSITORY / "scripts" / name, root / "scripts" / name)
    for name in (".nvmrc", ".python-version"):
        shutil.copy2(REPOSITORY / name, root / name)
    (root / ".env").write_text("MEDIA_SSH_HOST=\n")
    config = tmp_path / "config"
    config.mkdir()
    (config / "development.env").write_text("DOCKER_TARGET=production\n")
    binaries = tmp_path / "bin"
    binaries.mkdir()
    log = tmp_path / "commands.jsonl"
    docker = binaries / "docker"
    docker.write_text(
        f"#!{sys.executable}\n"
        + """
import json, os, sys
command = sys.argv[1:]
operation = command[command.index('knut_vandrar_backend.media.cli') + 1]
data = sys.stdin.buffer.read() if operation == 'import' else b''
with open(os.environ['MEDIA_TEST_LOG'], 'a') as log:
    log.write(json.dumps({'tool': 'docker', 'args': command, 'data': data.hex()}) + '\\n')
if operation == 'export':
    sys.stdout.buffer.write(b'tar-stream')
sys.exit(int(os.environ.get('MEDIA_TEST_FAILURE', '0')))
"""
    )
    docker.chmod(0o755)
    ssh = binaries / "ssh"
    ssh.write_text(
        f"#!{sys.executable}\n"
        + """
import json, os, subprocess, sys
with open(os.environ['MEDIA_TEST_LOG'], 'a') as log:
    log.write(json.dumps({'tool': 'ssh', 'args': sys.argv[1:]}) + '\\n')
sys.exit(subprocess.run(['bash', '-c', sys.argv[-1]]).returncode)
"""
    )
    ssh.chmod(0o755)
    environment = dict(
        os.environ,
        PATH=f"{binaries}:{os.environ['PATH']}",
        DEPLOY_CONFIG_DIR=str(config),
        MEDIA_TEST_LOG=str(log),
    )
    return root, environment, log


def _run(
    root: Path, environment: dict[str, str], script: str, *args: str
) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        [str(root / "scripts" / script), *args], env=environment, capture_output=True, check=False
    )


def test_local_export_is_private_atomic_and_refuses_overwrites(
    scripts: tuple[Path, dict[str, str], Path],
) -> None:
    root, environment, log = scripts
    (root / ".env").write_text("MEDIA_SSH_HOST=deploy@example.test\n")
    output = root / "output.tar"
    result = _run(root, environment, "media-export.sh", "local", str(output), "--hike", "example")
    assert result.returncode == 0, result.stderr.decode()
    assert b"Media target/source: local (this host)\n" in result.stderr
    assert b"deploy@example.test" not in result.stderr
    assert output.read_bytes() == b"tar-stream"
    assert output.stat().st_mode & 0o777 == 0o600
    command = json.loads(log.read_text())
    assert command["tool"] == "docker"
    assert command["args"][-3:] == ["export", "--hike", "example"]
    assert command["args"][command["args"].index("exec") :][:3] == ["exec", "-T", "backend"]
    result = _run(root, environment, "media-export.sh", "local", str(output))
    assert result.returncode != 0
    assert output.read_bytes() == b"tar-stream"
    assert len(log.read_text().splitlines()) == 1


def test_failed_export_never_publishes_partial_archive(
    scripts: tuple[Path, dict[str, str], Path],
) -> None:
    root, environment, _ = scripts
    environment["MEDIA_TEST_FAILURE"] = "31"
    output = root / "output.tar"
    assert _run(root, environment, "media-export.sh", "local", str(output)).returncode == 31
    assert not output.exists()
    assert not list(root.glob("*.tmp.*"))


@pytest.mark.parametrize("transport", ["arguments", "env", "password"])
def test_remote_import_streams_archive_and_quotes_paths_and_arguments(
    scripts: tuple[Path, dict[str, str], Path],
    tmp_path: Path,
    transport: str,
) -> None:
    root, environment, log = scripts
    remote_checkouts_dir = tmp_path / "remote ' checkouts"
    shutil.copytree(root, remote_checkouts_dir / "dev")
    if transport != "env":
        transport_args = [
            "--ssh",
            "deploy@example.test",
            "--remote-checkouts-dir",
            str(remote_checkouts_dir),
        ]
    else:
        transport_args = []
        (root / ".env").write_text(
            f'MEDIA_SSH_HOST=deploy@example.test\nMEDIA_REMOTE_CHECKOUTS_DIR="{remote_checkouts_dir}"\n'
        )
    if transport == "password":
        transport_args.append("--ssh-password")
    archive = root / "input.tar"
    archive.write_bytes(b"private archive contents")
    argument = "source=target'; touch injected; '"
    result = _run(
        root,
        environment,
        "media-import.sh",
        "dev",
        str(archive),
        *transport_args,
        "--dry-run",
        "--map-hike",
        argument,
    )
    assert result.returncode == 0, result.stderr.decode()
    commands = [json.loads(line) for line in log.read_text().splitlines()]
    assert b"Media target/source: dev (deploy@example.test)\n" in result.stderr
    assert commands[0]["tool"] == "ssh"
    if transport == "password":
        assert "BatchMode=no" in commands[0]["args"]
        assert "PubkeyAuthentication=no" in commands[0]["args"]
    else:
        assert "BatchMode=yes" in commands[0]["args"]
    docker = commands[1]
    assert docker["data"] == archive.read_bytes().hex()
    assert docker["args"][-4:] == ["import", "--dry-run", "--map-hike", argument]
    assert "knut-vandrar-dev" in docker["args"]
    assert "docker-compose.vps.dev.yml" in docker["args"]
    assert not (remote_checkouts_dir / "dev" / "injected").exists()


def test_recover_requires_no_archive_and_routes_to_selected_environment(
    scripts: tuple[Path, dict[str, str], Path],
) -> None:
    root, environment, log = scripts
    result = _run(root, environment, "media-import.sh", "dev", "--recover")
    assert result.returncode == 0, result.stderr.decode()
    assert json.loads(log.read_text())["args"][-1] == "recover"
