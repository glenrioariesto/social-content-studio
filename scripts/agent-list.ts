import { AGENT_TOOLS } from '../packages/shared/src/agent'

console.log('Studio Agent tools (8 intent-only):')
for (const tool of AGENT_TOOLS) {
  console.log(`- ${tool.name} [${tool.sideEffect}] -> ${tool.channel}`)
  for (const input of tool.inputs) {
    console.log(`    arg: ${input.name}${input.required ? ' (required)' : ''} <${input.kind}>`)
  }
}
