import { randomBytes, scryptSync } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

if (!process.stdin.isTTY) {
  throw new Error('Run this command in an interactive terminal')
}
process.stdout.write('New admin password (hidden, at least 24 characters): ')
spawnSync('stty', ['-echo'], { stdio: 'inherit' })
let input = ''
try {
  for await (const chunk of process.stdin) {
    input += chunk.toString()
    if (input.includes('\n')) {
      break
    }
  }
} finally {
  spawnSync('stty', ['echo'], { stdio: 'inherit' })
  process.stdout.write('\n')
}
const password = input.trimEnd()
if (password.length < 24) {
  throw new Error('Use at least 24 characters')
}
const salt = randomBytes(32).toString('hex')
const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`
const output = process.argv[2]
if (!output) {
  throw new Error('Provide an output filename for the password hash')
}
writeFileSync(output, `ADMIN_PASSWORD_HASH=${hash}\n`, { flag: 'wx', mode: 0o600 })
process.stdout.write(
  'Hash saved. Copy its ADMIN_PASSWORD_HASH entry to the root .env, then delete this file.\n',
)
