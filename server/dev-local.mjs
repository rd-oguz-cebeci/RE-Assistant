import { spawn } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const processSpecs = [
  { name: 'mcp-proxy', script: 'mcp:proxy' },
  { name: 'confluence-proxy', script: 'confluence:proxy' },
  { name: 'vite', script: 'dev' },
]

const children = []
let shuttingDown = false

function prefixStream(stream, name) {
  let buffer = ''
  stream.on('data', (chunk) => {
    buffer += chunk.toString('utf-8')
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      console.log(`[${name}] ${line}`)
    }
  })
  stream.on('end', () => {
    if (buffer.trim()) {
      console.log(`[${name}] ${buffer}`)
    }
  })
}

function startProcess(spec) {
  const child = spawn(`${npmCommand} run ${spec.script}`, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })

  prefixStream(child.stdout, spec.name)
  prefixStream(child.stderr, spec.name)

  child.on('exit', (code, signal) => {
    if (shuttingDown) return

    if (signal) {
      console.log(`[orchestrator] ${spec.name} exited by signal ${signal}.`)
    } else {
      console.log(`[orchestrator] ${spec.name} exited with code ${code}.`)
    }

    if (code !== 0) {
      shutdown(code ?? 1)
    }
  })

  children.push(child)
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGKILL')
      }
    }
    process.exit(exitCode)
  }, 800)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('[orchestrator] starting local stack (vite + mcp-proxy + confluence-proxy)')
for (const spec of processSpecs) {
  startProcess(spec)
}
