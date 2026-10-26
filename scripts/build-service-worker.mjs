// Generates dist/sw.js after `vite build`.
//
// The version is a hash over the whole build output, so any change to any
// shipped file produces a new worker, a new cache and an update prompt. The
// worker itself is left out of both the hash and the precache list.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')
const templatePath = join(root, 'scripts', 'service-worker.js')
const outputPath = join(distDir, 'sw.js')

function listFiles(directory, base = directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFiles(full, base))
    } else if (entry.isFile()) {
      files.push(relative(base, full).split(sep).join('/'))
    }
  }
  return files
}

const files = listFiles(distDir)
  .filter((file) => file !== 'sw.js' && !file.endsWith('.map'))
  .sort()

if (!files.includes('index.html')) {
  console.error('build-service-worker: dist/index.html is missing — run vite build first')
  process.exit(1)
}

const hash = createHash('sha256')
for (const file of files) {
  hash.update(file)
  hash.update('\0')
  hash.update(readFileSync(join(distDir, file)))
  hash.update('\0')
}
const version = hash.digest('hex').slice(0, 12)

// `.` and `index.html` both resolve to the app shell; keeping both means a
// navigation to `/snapbook/` and to `/snapbook/index.html` hit the cache.
const precache = ['.', ...files]
const template = readFileSync(templatePath, 'utf8')

for (const placeholder of ['__SNAPBUILD_VERSION__', '__SNAPBUILD_PRECACHE__']) {
  if (!template.includes(placeholder)) {
    console.error(`build-service-worker: template is missing ${placeholder}`)
    process.exit(1)
  }
}

const source = template
  .replace('__SNAPBUILD_VERSION__', version)
  .replace('__SNAPBUILD_PRECACHE__', JSON.stringify(precache, null, 2))

writeFileSync(outputPath, source)
console.log(`build-service-worker: sw.js ${version} (${precache.length} files)`)
