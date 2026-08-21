// Creates .env from .env.example on a clean clone so `pnpm test:all` is genuinely one command.
//
// Never overwrites an existing .env — a developer's real keys are not this script's business,
// and silently rewriting a secrets file is a bad trade for a little convenience. It only fills
// BETTER_AUTH_SECRET, which is the one blank .env.example ships that nothing works without;
// ANTHROPIC_API_KEY and R2_* stay empty on purpose, and the tests that need them skip.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const target = '.env'
const template = '.env.example'

if (existsSync(target)) {
  console.log('ensure-env — .env already exists, leaving it alone.')
  process.exit(0)
}

if (!existsSync(template)) {
  console.error(`ensure-env — ${template} is missing; cannot bootstrap ${target}.`)
  process.exit(1)
}

const filled = readFileSync(template, 'utf8').replace(
  /^BETTER_AUTH_SECRET=\s*$/m,
  `BETTER_AUTH_SECRET=${randomBytes(32).toString('base64')}`,
)

writeFileSync(target, filled)
console.log('ensure-env — wrote .env from .env.example with a generated BETTER_AUTH_SECRET.')
